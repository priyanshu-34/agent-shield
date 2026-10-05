import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { DEFAULT_ANSWERS, main, renderConfig, type Answers } from "../src/cli.js";
import { loadConfig } from "../src/index.js";
import type { PacksInput } from "../src/packs.js";

const ALL: Required<PacksInput> = {
  email: { tools: ["send_email"], allowEmails: ["mycompany.com"] },
  browser: { tools: ["fetch_page"], allowDomains: ["*.example.com"] },
  http: { tools: ["http_request"] },
  files: { read: ["read_file"], write: ["write_file"], root: "workspace" },
  shell: { tools: ["run_command"], alwaysAsk: true },
  payments: { tools: ["refund"], maxAmount: 100 },
  mcp: { tools: ["weather"] },
  memory: { tools: ["save_memory"] },
};

describe("init", () => {
  it("writes a config that loads for every combination of packs", () => {
    const names = Object.keys(ALL) as (keyof PacksInput)[];
    for (let mask = 0; mask < 2 ** names.length; mask++) {
      const packs = Object.fromEntries(names.filter((_, i) => mask & (1 << i)).map((n) => [n, ALL[n]]));
      const answers: Answers = { framework: "langgraph", packs };
      const config = loadConfig(parse(renderConfig(answers)));
      expect(config.mode).toBe("monitor");
    }
  });

  it("writes defaults with --yes, and won't overwrite without --force", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "agent-shield-init-"));
    const out = path.join(dir, "shield.yaml");
    expect(await main(["init", "--yes", "--out", out])).toBe(0);
    expect(loadConfig(out).tools.send_email).toMatchObject({ risk: "risky" });
    expect(readFileSync(out, "utf8")).toBe(renderConfig(DEFAULT_ANSWERS));

    writeFileSync(out, "mode: enforce\n");
    expect(await main(["init", "--yes", "--out", out])).toBe(1);
    expect(readFileSync(out, "utf8")).toBe("mode: enforce\n");
    expect(await main(["init", "--yes", "--force", "--out", out])).toBe(0);
  });

  it("prints usage for anything else", async () => {
    expect(await main([])).toBe(0);
    expect(await main(["deploy"])).toBe(1);
  });
});
