import path from "node:path";
import picomatch from "picomatch";
import type { ArgRule, ShieldConfig, ToolPolicy } from "./config.js";

export type Verdict = "allow" | "block" | "ask";

export interface SessionState {
  taintSources: string[];
  callCounts: Record<string, number>;
}

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
  return config.tools[toolName] ?? { risk: config.defaults.unknownTool, output: "untrusted" };
}

export function checkOut(
  config: ShieldConfig,
  toolName: string,
  args: unknown,
  state: SessionState,
): CheckOutResult {
  const policy = policyFor(config, toolName);
  if (policy.risk === "blocked") return { verdict: "block", reasons: [`tool "${toolName}" is blocked`] };

  // rules and secret checks apply to every tool; taint only gates risky ones
  const reasons: string[] = [];
  const argObj = (args ?? {}) as Record<string, unknown>;
  for (const [argName, rule] of Object.entries(policy.rules ?? {})) {
    reasons.push(...checkArg(argName, argObj[argName], rule));
  }
  for (const secret of findSecrets(args)) reasons.push(`arguments contain a ${secret}`);
  const count = state.callCounts[toolName] ?? 0;
  if (policy.maxPerSession !== undefined && count >= policy.maxPerSession) {
    reasons.push(`"${toolName}" already called ${count} times (limit ${policy.maxPerSession})`);
  }
  if (reasons.length) return { verdict: "block", reasons };

  if (policy.risk === "risky" && state.taintSources.length) {
    return { verdict: "ask", reasons: [`untrusted content was read earlier (${state.taintSources.join(", ")})`] };
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
    if (rule.deny?.some((p) => wildcard(`*${p}*`, s))) reasons.push(`${name} "${s}" matches a deny rule`);
    if (rule.allowDomains && !domainAllowed(s, rule.allowDomains)) reasons.push(`${name} "${s}" is not an allowed domain`);
    if (rule.max !== undefined && !(Number(v) <= rule.max)) reasons.push(`${name} ${s} is over the limit ${rule.max}`);
    if (rule.allowPaths || rule.denyPaths) reasons.push(...checkPath(name, s, rule));
  }
  return reasons;
}

// "*" matches anything, case-insensitive.
function wildcard(pattern: string, value: string): boolean {
  const re = pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${re}$`, "is").test(value.trim());
}

function domainAllowed(url: string, domains: string[]): boolean {
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
