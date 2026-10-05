#!/usr/bin/env node
import { existsSync, realpathSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import type { PacksInput } from "./packs.js";

export type Framework = "langgraph" | "mastra" | "other";
export interface Answers {
  framework: Framework;
  packs: PacksInput;
}

const PACK_CHOICES = ["email", "browser", "http", "files", "shell", "payments", "mcp", "memory"] as const;
type PackName = (typeof PACK_CHOICES)[number];

export const DEFAULT_ANSWERS: Answers = {
  framework: "langgraph",
  packs: {
    browser: { tools: ["fetch_page"] },
    files: { read: ["read_file"], write: ["write_file"], root: "." },
    email: { tools: ["send_email"], allowEmails: ["mycompany.com"] },
  },
};

export function renderConfig(answers: Answers): string {
  const body = stringify({ mode: "monitor", packs: answers.packs });
  return `# agent-shield config: https://github.com/priyanshu-34/agent-shield
# Starts in "monitor" mode: it logs what it WOULD block and blocks nothing.
# When the log looks right, change mode to "enforce".
# Tool names and allowed domains below are starting points: check them against your agent.
${body}`;
}

export function snippet(framework: Framework, file: string): string {
  if (framework === "mastra") {
    return `import { createShield } from "@priyans34/agent-shield";
import { shieldMastraTools } from "@priyans34/agent-shield/mastra";

const shield = createShield({ config: "./${file}" });
const agent = new Agent({ ...yourAgent, tools: shieldMastraTools(shield, tools) });`;
  }
  if (framework === "langgraph") {
    return `import { createShield } from "@priyans34/agent-shield";
import { shieldTools } from "@priyans34/agent-shield/langchain";

const shield = createShield({ config: "./${file}" });
const agent = createAgent({ model, tools: shieldTools(shield, tools) });
await agent.invoke(input, { configurable: { thread_id: conversationId } });`;
  }
  return `import { createShield } from "@priyans34/agent-shield";

const shield = createShield({ config: "./${file}" });
const result = await shield.guard("send_email", args, () => sendEmail(args), conversationId);`;
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

async function ask(): Promise<Answers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const q = async (text: string, fallback = "") => (await rl.question(`${text}${fallback ? ` [${fallback}]` : ""}: `)).trim() || fallback;
  try {
    const fw = await q("Framework: 1) LangChain/LangGraph  2) Mastra  3) Other", "1");
    const framework: Framework = fw === "2" ? "mastra" : fw === "3" ? "other" : "langgraph";
    console.log(`What can your agent do?\n${PACK_CHOICES.map((p, i) => `  ${i + 1}) ${p}`).join("\n")}`);
    const picked = list(await q("Numbers, comma-separated", "1,2,4"))
      .map((n) => PACK_CHOICES[Number(n) - 1])
      .filter(Boolean) as PackName[];

    const packs: PacksInput = {};
    for (const pack of new Set(picked)) {
      if (pack === "email") packs.email = { tools: list(await q("  email: tool names", "send_email")), allowEmails: list(await q("  email: allowed domains or addresses", "mycompany.com")) };
      if (pack === "browser") {
        const domains = list(await q("  browser: allowed sites (blank = any)"));
        packs.browser = { tools: list(await q("  browser: tool names", "fetch_page")), ...(domains.length && { allowDomains: domains }) };
      }
      if (pack === "http") {
        const domains = list(await q("  http: allowed sites (blank = any)"));
        packs.http = { tools: list(await q("  http: tool names", "http_request")), ...(domains.length && { allowDomains: domains }) };
      }
      if (pack === "files") {
        packs.files = { read: list(await q("  files: read tools", "read_file")), write: list(await q("  files: write tools", "write_file")), root: await q("  files: folder the agent may use", ".") };
      }
      if (pack === "shell") packs.shell = { tools: list(await q("  shell: tool names", "run_command")), alwaysAsk: /^y/i.test(await q("  shell: always ask before running a command? (y/n)", "n")) };
      if (pack === "payments") packs.payments = { tools: list(await q("  payments: tool names", "refund")), maxAmount: Number(await q("  payments: largest amount allowed", "100")) };
      if (pack === "mcp") {
        const tools = list(await q("  mcp: tool names from third-party MCP servers"));
        if (tools.length) packs.mcp = { tools };
      }
      if (pack === "memory") packs.memory = { tools: list(await q("  memory: tool names", "save_memory")) };
    }
    return { framework, packs };
  } finally {
    rl.close();
  }
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...flags] = argv;
  if (command !== "init") {
    console.log("Usage: agent-shield init [--yes] [--force] [--out shield.yaml]");
    return command === undefined || command === "--help" || command === "-h" ? 0 : 1;
  }
  const outIndex = flags.indexOf("--out");
  const out = outIndex >= 0 ? flags[outIndex + 1] : "shield.yaml";
  if (!out) {
    console.error("--out needs a file name");
    return 1;
  }
  if (existsSync(out) && !flags.includes("--force")) {
    console.error(`${out} already exists. Use --force to overwrite it.`);
    return 1;
  }
  const interactive = !flags.includes("--yes") && process.stdin.isTTY;
  if (!interactive && !flags.includes("--yes")) console.log("No terminal to ask questions in, so using the defaults.");
  const answers = interactive ? await ask() : DEFAULT_ANSWERS;

  writeFileSync(out, renderConfig(answers));
  console.log(`\nWrote ${out} (monitor mode: logs only, blocks nothing).\n\nAdd it to your agent:\n\n${snippet(answers.framework, out)}\n`);
  return 0;
}

// run only when executed as the CLI (npx follows a symlink, hence realpath), not when imported by tests
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main(process.argv.slice(2)).then((code) => (process.exitCode = code));
}
