import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { checkIn as runCheckIn, type Detection } from "./check-in.js";
import { checkOut, newSession, policyFor, redactSecrets, type SessionState, type Verdict } from "./check-out.js";
import { loadConfig, type ShieldConfig, type ShieldConfigInput } from "./config.js";

export interface ApprovalRequest {
  tool: string;
  args: unknown;
  reasons: string[];
  sessionId: string;
  // plain-words explanation to show the person approving
  summary: string;
  taintSources: string[];
  flaggedSources: string[];
}

export interface CheckOutEvent {
  time: string;
  sessionId: string;
  stage: "check_out";
  tool: string;
  decision: Verdict;
  // what the decision would have been in enforce mode
  wouldBe?: Verdict;
  // logged before waiting for a human, so paused calls still show up
  pending?: boolean;
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
    if (!s) sessions.set(id, (s = newSession()));
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
      // framework pause signals (e.g. LangGraph interrupt) must pass through
      if ((err as { is_bubble_up?: boolean })?.is_bubble_up) throw err;
      return { verdict: "block", reasons: [...reasons, `approval failed: ${(err as Error).message}`] };
    } finally {
      clearTimeout(timer);
    }
  }

  // Runs one tool call through Check Out, then marks the session tainted if the output is untrusted.
  async function guard<T>(tool: string, args: unknown, run: () => Promise<T>, sessionId = DEFAULT_SESSION): Promise<GuardResult<T>> {
    const state = session(sessionId);
    const enforce = config.mode === "enforce";
    let result = safeCheckOut(tool, args, state);
    // only rule blocks count toward lockdown, not missing approvers or human rejections
    if (result.verdict === "block" && enforce) state.blockCount++;
    // reserve the call slot before any await, so parallel calls can't all slip under the limit
    const reserved = result.verdict !== "block";
    if (reserved) state.callCounts[tool] = (state.callCounts[tool] ?? 0) + 1;
    const event = () => ({
      time: new Date().toISOString(),
      sessionId,
      stage: "check_out" as const,
      tool,
      reasons: result.reasons.map(redactSecrets),
      taintSources: [...state.taintSources],
      args: redactSecrets(JSON.stringify(args ?? {})),
    });

    if (result.verdict === "ask" && enforce) {
      log({ ...event(), decision: "ask", pending: true });
      try {
        result = await ask({ tool, args, reasons: result.reasons, sessionId, ...describe(tool, args, state) });
      } catch (err) {
        if (reserved) state.callCounts[tool]--;
        throw err;
      }
    }
    const decision: Verdict = enforce ? result.verdict : "allow";
    if (reserved && decision !== "allow") state.callCounts[tool]--;
    log({ ...event(), decision, ...(decision !== result.verdict && { wouldBe: result.verdict }) });
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
      if (r.flagged && !state.flaggedSources.includes(source)) state.flaggedSources.push(source);
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

function describe(tool: string, args: unknown, state: SessionState) {
  const shownArgs = redactSecrets(JSON.stringify(args ?? {}));
  const flagged = state.flaggedSources.length
    ? `Some of it was flagged as a possible attack (${state.flaggedSources.join(", ")}).`
    : "None of it was flagged as an attack.";
  return {
    summary: `The agent wants to run "${tool}" with ${shownArgs.length > 300 ? shownArgs.slice(0, 300) + "…" : shownArgs}. ` +
      `Earlier in this conversation it read untrusted content (${state.taintSources.join(", ")}). ${flagged}`,
    taintSources: [...state.taintSources],
    flaggedSources: [...state.flaggedSources],
  };
}

// Asks in the terminal, one question at a time; blocks when there is no terminal (e.g. CI).
export function terminalApproval(input: NodeJS.ReadableStream & { isTTY?: boolean } = process.stdin, output: NodeJS.WritableStream = process.stderr) {
  let queue: Promise<unknown> = Promise.resolve();
  return (request: ApprovalRequest): Promise<"allow" | "block"> => {
    const answer = queue.then(async () => {
      if (!input.isTTY) return "block" as const;
      const rl = createInterface({ input, output });
      try {
        const reply = await rl.question(`\n[agent-shield] ${request.summary}\nAllow? (y/N) `);
        return /^y(es)?$/i.test(reply.trim()) ? ("allow" as const) : ("block" as const);
      } finally {
        rl.close();
      }
    });
    queue = answer.catch(() => {});
    return answer;
  };
}

export function consoleLogger(event: ShieldEvent) {
  if (event.stage === "check_in") {
    if (event.flagged || event.removed.length) {
      const rules = [...new Set(event.detections.map((d) => d.rule))];
      console.warn(`[agent-shield] check-in ${event.source}: ${[...event.removed.map((r) => `removed ${r}`), ...rules.map((r) => `flagged ${r}`)].join("; ")}`);
    }
    return;
  }
  if (event.pending) {
    console.warn(`[agent-shield] waiting for approval: ${event.tool}`);
    return;
  }
  if (event.decision !== "allow" || event.wouldBe) {
    console.warn(`[agent-shield] ${event.wouldBe ?? event.decision} ${event.tool}: ${event.reasons.join("; ")}`);
  }
}

export function fileLogger(file: string) {
  return (event: ShieldEvent) => appendFileSync(file, JSON.stringify(event) + "\n");
}
