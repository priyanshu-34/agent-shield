import path from "node:path";
import picomatch from "picomatch";
import type { ArgRule, ShieldConfig, ToolPolicy } from "./config.js";

export type Verdict = "allow" | "block" | "ask";

export interface SessionState {
  taintSources: string[];
  // sources where Check In found something that looks like an attack
  flaggedSources: string[];
  callCounts: Record<string, number>;
  blockCount: number;
}

export const newSession = (): SessionState => ({ taintSources: [], flaggedSources: [], callCounts: {}, blockCount: 0 });

export interface CheckOutResult {
  verdict: Verdict;
  reasons: string[];
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ["api key (sk-)", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

export function policyFor(config: ShieldConfig, toolName: string): ToolPolicy {
  return config.tools[toolName] ?? { risk: config.defaults.unknownTool, approval: "auto", output: "untrusted", description: "trusted", allowUrlData: false };
}

export function checkOut(
  config: ShieldConfig,
  toolName: string,
  args: unknown,
  state: SessionState,
): CheckOutResult {
  const policy = policyFor(config, toolName);
  const { maxBlocks } = config.defaults;
  if (maxBlocks > 0 && state.blockCount >= maxBlocks) {
    return { verdict: "block", reasons: [`${state.blockCount} calls were blocked in this conversation, so all tools are locked. Stop and tell the user what happened`] };
  }
  if (policy.risk === "blocked") return { verdict: "block", reasons: [`tool "${toolName}" is blocked`] };

  // rules and secret checks apply to every tool; taint only gates risky ones
  const reasons: string[] = [];
  const argObj = (args ?? {}) as Record<string, unknown>;
  for (const [argName, rule] of Object.entries(policy.rules ?? {})) {
    reasons.push(...checkArg(argName, argObj[argName], rule));
  }
  for (const secret of findSecrets(args)) reasons.push(`arguments contain a ${secret}`);
  // only after untrusted content is read; before that, URLs came from the user, not an attacker
  if (!policy.allowUrlData && state.taintSources.length) reasons.push(...findUrlData(args));
  const count = state.callCounts[toolName] ?? 0;
  if (policy.maxPerSession !== undefined && count >= policy.maxPerSession) {
    reasons.push(`"${toolName}" already called ${count} times (limit ${policy.maxPerSession})`);
  }
  if (reasons.length) return { verdict: "block", reasons };

  if (policy.risk === "risky" && policy.approval === "always") {
    return { verdict: "ask", reasons: [`"${toolName}" always needs approval`] };
  }
  if (policy.risk === "risky" && state.taintSources.length) {
    const flagged = state.flaggedSources.length ? `; flagged as a possible attack: ${state.flaggedSources.join(", ")}` : "";
    return { verdict: "ask", reasons: [`untrusted content was read earlier (${state.taintSources.join(", ")}${flagged})`] };
  }
  return { verdict: "allow", reasons: [] };
}

function checkArg(name: string, value: unknown, rule: ArgRule): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  const reasons: string[] = [];
  for (const v of values) {
    const s = String(v);
    if (rule.allow && !rule.allow.some((p) => wildcard(p, s))) reasons.push(`${name} "${s}" is not in the allow list`);
    // deny matches anywhere, so "x && rm -rf /" is still caught
    if (rule.deny?.some((p) => (isRegex(p) ? toRegex(p).test(s) : wildcard(`*${p}*`, s, ".*")))) reasons.push(`${name} "${s}" matches a deny rule`);
    if (rule.allowEmails) {
      const emails = emailsIn(s);
      if (!emails) reasons.push(`${name} "${s}" is not a valid email address list`);
      else for (const e of emails) if (!emailAllowed(e, rule.allowEmails)) reasons.push(`${name} "${e}" is not an allowed email address`);
    }
    if (rule.allowDomains && !domainAllowed(s, rule.allowDomains)) reasons.push(`${name} "${s}" is not an allowed domain`);
    if (rule.max !== undefined && !(Number(v) <= rule.max)) reasons.push(`${name} ${s} is over the limit ${rule.max}`);
    if (rule.allowPaths || rule.denyPaths) reasons.push(...checkPath(name, s, rule));
  }
  return reasons;
}

// "*" matches anything, case-insensitive.
// "*" matches anything for deny; for allow it matches one token, so "x@evil.com, a@ok.com" can't pass "*@ok.com".
function wildcard(pattern: string, value: string, star = "[^\\s,;<>]*"): boolean {
  const re = pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(star);
  return new RegExp(`^${re}$`, "is").test(value.trim());
}

const isRegex = (p: string) => p.length > 2 && p.startsWith("/") && p.endsWith("/");
const toRegex = (p: string) => new RegExp(p.slice(1, -1), "i");

// Reads "a@x.com, B <b@y.com>; c@z.com" into addresses; anything that isn't an address fails the check.
function emailsIn(value: string): string[] | undefined {
  const parts = value.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const addr = (part.match(/<([^<>]+)>\s*$/)?.[1] ?? part).trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(addr)) return undefined;
    out.push(addr);
  }
  return out.length ? out : undefined;
}

function emailAllowed(addr: string, allowed: string[]): boolean {
  const domain = addr.split("@")[1];
  return allowed.some((a) => {
    a = a.toLowerCase();
    if (a.includes("@")) return a === addr;
    return a.startsWith("*.") ? domain.endsWith(a.slice(1)) : domain === a;
  });
}

export function domainAllowed(url: string, domains: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => {
    d = d.toLowerCase();
    return d.startsWith("*.") ? host.endsWith(d.slice(1)) : host === d;
  });
}

function checkPath(name: string, value: string, rule: ArgRule): string[] {
  const rel = path.relative(process.cwd(), path.resolve(value));
  if (value.startsWith("~") || rel.startsWith("..") || path.isAbsolute(rel)) return [`${name} "${value}" is outside the project folder`];
  const match = (patterns: string[]) => picomatch(patterns.map((p) => p.replace(/^\.\//, "")), { dot: true })(rel);
  if (rule.denyPaths && match(rule.denyPaths)) return [`${name} "${value}" is a protected path`];
  if (rule.allowPaths && !match(rule.allowPaths)) return [`${name} "${value}" is not in an allowed folder`];
  return [];
}

// Long encoded-looking chunks in a URL are how agents get tricked into leaking data with a simple GET.
export function findUrlData(value: unknown): string[] {
  const reasons: string[] = [];
  for (const s of strings(value)) {
    if (!/^https?:\/\//i.test(s)) continue;
    let url: URL;
    try {
      url = new URL(s);
    } catch {
      continue;
    }
    const parts = [...url.pathname.split("/"), ...[...url.searchParams.values()], url.hash.slice(1)];
    if (url.search.length + url.hash.length > 500) reasons.push(`URL to ${url.hostname} carries a lot of data (${url.search.length + url.hash.length} chars)`);
    else if (parts.some(looksLikeBase64)) reasons.push(`URL to ${url.hostname} carries encoded-looking data`);
  }
  return reasons;
}

// ponytail: hex-encoded leaks pass (they look like commit SHAs); hyphenated slugs are not data
function looksLikeBase64(part: string): boolean {
  if (part.length < 40 || !/^[A-Za-z0-9+/=_-]+$/.test(part) || /^[a-z0-9]+(-[a-z0-9]+)+$/i.test(part)) return false;
  return /=$/.test(part) || (/[A-Z]/.test(part) && /[a-z]/.test(part) && /\d/.test(part));
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

export function findSecrets(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const found = SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
  if (hasCardNumber(text)) found.push("card number");
  return found;
}

export function redactSecrets(text: string): string {
  for (const [, re] of SECRET_PATTERNS) text = text.replace(new RegExp(re.source, "g"), "[REDACTED]");
  return text.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhn(m.replace(/\D/g, "")) ? "[REDACTED]" : m));
}

function hasCardNumber(text: string): boolean {
  for (const m of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}
