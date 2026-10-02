import { appendFileSync } from "node:fs";
import { checkIn as runCheckIn, type Detection } from "./check-in.js";
import { checkOut, policyFor, redactSecrets, type SessionState, type Verdict } from "./check-out.js";
import { loadConfig, type ShieldConfig, type ShieldConfigInput } from "./config.js";

export interface ApprovalRequest {
  tool: string;
  args: unknown;
  reasons: string[];
  sessionId: string;
}

export interface CheckOutEvent {
  time: string;
  sessionId: string;
  stage: "check_out";
  tool: string;
  decision: Verdict;
  // what the decision would have been in enforce mode
  wouldBe?: Verdict;
  reasons: string[];
  taintSources: string[];
  args: string;
}

export interface CheckInEvent {
  time: string;
  sessionId: string;
  stage: "check_in";
  source: string;
  flagged: boolean;
  detections: Detection[];
  removed: string[];
  error?: string;
}

export type ShieldEvent = CheckOutEvent | CheckInEvent;

export interface ShieldOptions {
  config: ShieldConfigInput | string;
  onApproval?: (request: ApprovalRequest) => Promise<"allow" | "block">;
  log?: (event: ShieldEvent) => void;
}

export type GuardResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const DEFAULT_SESSION = "default";

export function createShield(options: ShieldOptions) {
  const config: ShieldConfig = loadConfig(options.config);
  const log = options.log ?? consoleLogger;
  // ponytail: in-memory sessions, never evicted; add a TTL/LRU if long-running servers need it
  const sessions = new Map<string, SessionState>();

  function session(id = DEFAULT_SESSION): SessionState {
    let s = sessions.get(id);
    if (!s) sessions.set(id, (s = { taintSources: [], callCounts: {} }));
    return s;
  }

  function safeCheckOut(tool: string, args: unknown, state: SessionState) {
    try {
      return checkOut(config, tool, args, state);
    } catch (err) {
      const fallback = policyFor(config, tool).risk === "safe" ? "allow" : config.defaults.onError;
      return { verdict: fallback, reasons: [`shield error: ${(err as Error).message}`] };
    }
  }

  async function ask(request: ApprovalRequest): Promise<{ verdict: Verdict; reasons: string[] }> {
    const reasons = [...request.reasons];
    if (!options.onApproval) return { verdict: "block", reasons: [...reasons, "needs human approval but no approver is set"] };
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((r) => (timer = setTimeout(() => r("timeout"), config.defaults.approvalTimeoutMs)));
    try {
      const answer = await Promise.race([options.onApproval(request), timeout]);
      if (answer === "allow") return { verdict: "allow", reasons: [...reasons, "approved by human"] };
      return { verdict: "block", reasons: [...reasons, answer === "timeout" ? "approval timed out" : "rejected by human"] };
    } catch (err) {
      return { verdict: "block", reasons: [...reasons, `approval failed: ${(err as Error).message}`] };
    } finally {
      clearTimeout(timer);
    }
  }

  // Runs one tool call through Check Out, then marks the session tainted if the output is untrusted.
  async function guard<T>(tool: string, args: unknown, run: () => Promise<T>, sessionId = DEFAULT_SESSION): Promise<GuardResult<T>> {
    const state = session(sessionId);
    let result = safeCheckOut(tool, args, state);
    // reserve the call slot before any await, so parallel calls can't all slip under the limit
    const reserved = result.verdict !== "block";
    if (reserved) state.callCounts[tool] = (state.callCounts[tool] ?? 0) + 1;
    if (result.verdict === "ask" && config.mode === "enforce") result = await ask({ tool, args, reasons: result.reasons, sessionId });
    const decision: Verdict = config.mode === "monitor" ? "allow" : result.verdict;
    if (reserved && decision !== "allow") state.callCounts[tool]--;
    log({
      time: new Date().toISOString(),
      sessionId,
      stage: "check_out",
      tool,
      decision,
      ...(decision !== result.verdict && { wouldBe: result.verdict }),
      reasons: result.reasons.map(redactSecrets),
      taintSources: [...state.taintSources],
      args: redactSecrets(JSON.stringify(args ?? {})),
    });
    if (decision !== "allow") return { ok: false, message: `Blocked by agent-shield: ${result.reasons.map(redactSecrets).join("; ")}` };

    const value = await run();
    if (policyFor(config, tool).output === "trusted") return { ok: true, value };
    return { ok: true, value: checkIn(value, { source: `tool:${tool}`, sessionId }) as T };
  }

  // Cleans and labels untrusted content, and marks the session tainted.
  function checkIn(value: unknown, { source = "external", sessionId = DEFAULT_SESSION } = {}): unknown {
    const state = session(sessionId);
    if (!state.taintSources.includes(source)) state.taintSources.push(source);
    if (!config.checkIn.enabled) return value;
    const event = { time: new Date().toISOString(), sessionId, stage: "check_in" as const, source };
    try {
      const r = runCheckIn(value, source, config.checkIn.onFlagged);
      log({ ...event, flagged: r.flagged, detections: r.detections.map((d) => ({ ...d, match: redactSecrets(d.match) })), removed: r.removed });
      return config.mode === "monitor" ? value : r.value;
    } catch (err) {
      // content stays tainted, so risky actions still need approval
      log({ ...event, flagged: false, detections: [], removed: [], error: (err as Error).message });
      return value;
    }
  }

  return {
    config,
    guard,
    checkIn,
    isTainted: (sessionId = DEFAULT_SESSION) => session(sessionId).taintSources.length > 0,
    reset: (sessionId = DEFAULT_SESSION) => void sessions.delete(sessionId),
  };
}

export type Shield = ReturnType<typeof createShield>;

export function consoleLogger(event: ShieldEvent) {
  if (event.stage === "check_in") {
    if (event.flagged || event.removed.length) {
      const rules = [...new Set(event.detections.map((d) => d.rule))];
      console.warn(`[agent-shield] check-in ${event.source}: ${[...event.removed.map((r) => `removed ${r}`), ...rules.map((r) => `flagged ${r}`)].join("; ")}`);
    }
    return;
  }
  if (event.decision !== "allow" || event.wouldBe) {
    console.warn(`[agent-shield] ${event.wouldBe ?? event.decision} ${event.tool}: ${event.reasons.join("; ")}`);
  }
}

export function fileLogger(file: string) {
  return (event: ShieldEvent) => appendFileSync(file, JSON.stringify(event) + "\n");
}
