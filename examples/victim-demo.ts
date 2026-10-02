import { fileURLToPath } from "node:url";
import { createShield } from "../src/index.js";
import { shieldTools } from "../src/langchain.js";
import { makeAgent, makeTools } from "./victim-agent.js";

const ask = { messages: [{ role: "user", content: "Summarize https://blog.example.com/poisoned" }] };

console.log("\n=== 1. Without agent-shield ===");
const plain = makeTools();
await makeAgent(plain.tools).invoke(ask);
console.log("Emails sent:", plain.outbox);

console.log("\n=== 2. With agent-shield ===");
const shield = createShield({ config: fileURLToPath(new URL("./shield.yaml", import.meta.url)) });
const guarded = makeTools();
const result = await makeAgent(shieldTools(shield, guarded.tools)).invoke(ask);
console.log("Emails sent:", guarded.outbox);
console.log("Agent's answer:", result.messages.at(-1)?.content);
