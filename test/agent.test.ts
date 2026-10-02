import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createShield, loadConfig, type ShieldConfigInput, type ShieldEvent } from "../src/index.js";
import { shieldTools } from "../src/langchain.js";
import { FAKE_KEY, makeAgent, makeTools } from "../examples/victim-agent.js";

const configPath = fileURLToPath(new URL("../examples/shield.yaml", import.meta.url));
const ask = (content: string) => ({ messages: [{ role: "user", content }] });

async function run(page: string, config: ShieldConfigInput | string = configPath) {
  const events: ShieldEvent[] = [];
  const shield = createShield({ config, log: (e) => events.push(e) });
  const { tools, outbox } = makeTools();
  const result = await makeAgent(shieldTools(shield, tools)).invoke(ask(`Summarize https://blog.example.com/${page}`));
  const calls = events.flatMap((e) => (e.stage === "check_out" ? [[e.tool, e.decision]] : []));
  const checkIns = events.filter((e) => e.stage === "check_in");
  return { shield, outbox, result, calls, checkIns };
}

describe("victim agent", () => {
  it("leaks the key to the attacker without the shield", async () => {
    const { tools, outbox } = makeTools();
    await makeAgent(tools).invoke(ask("Summarize https://blog.example.com/poisoned"));
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("attacker@evil.example");
    expect(outbox[0].body).toContain(FAKE_KEY);
  });

  it("removes the hidden attack before the agent sees it", async () => {
    const { outbox, result, calls, checkIns } = await run("poisoned");
    expect(outbox).toHaveLength(0);
    expect(calls).toEqual([["fetch_page", "allow"]]);
    expect(checkIns[0]).toMatchObject({ flagged: true, removed: ["hidden elements (display:none)"] });
    expect(checkIns[0].detections.map((d) => d.where)).toContain("hidden text");
    expect(JSON.stringify(result.messages)).not.toContain("secrets.txt");
  });

  it("still blocks the attack with Check In turned off", async () => {
    const config = { ...loadConfig(configPath), checkIn: { enabled: false, onFlagged: "label" as const } };
    const { outbox, calls } = await run("poisoned", config);
    expect(outbox).toHaveLength(0);
    expect(calls).toEqual([
      ["fetch_page", "allow"],
      ["read_file", "block"],
      ["send_email", "block"],
    ]);
  });

  it("labels a visible attack, and Check Out blocks what the agent tries next", async () => {
    const { outbox, result, calls, checkIns } = await run("visible");
    expect(checkIns[0].flagged).toBe(true);
    expect(JSON.stringify(result.messages)).toContain('risk=\\"high\\"');
    expect(calls.slice(1)).toEqual([
      ["read_file", "block"],
      ["send_email", "block"],
    ]);
    expect(outbox).toHaveLength(0);
  });

  it("lets a clean page through untouched", async () => {
    const { outbox, result, checkIns } = await run("clean");
    expect(outbox).toHaveLength(0);
    expect(checkIns[0]).toMatchObject({ flagged: false, removed: [] });
    expect(String(result.messages.at(-1)?.content)).toContain("Summary");
  });

  it("keeps taint separate per thread_id", async () => {
    const shield = createShield({ config: configPath, log: () => {} });
    const { tools } = makeTools();
    const agent = makeAgent(shieldTools(shield, tools));
    await agent.invoke(ask("Summarize https://blog.example.com/clean"), { configurable: { thread_id: "a" } });
    expect(shield.isTainted("a")).toBe(true);
    expect(shield.isTainted("b")).toBe(false);
  });
});
