import { fileURLToPath } from "node:url";
import { createShield } from "../src/index.js";
import { shieldTools } from "../src/langchain.js";
import { makeAgent, makeTools } from "./victim-agent.js";

const config = fileURLToPath(new URL("./shield.yaml", import.meta.url));
const ask = (page: string) => ({ messages: [{ role: "user", content: `Summarize https://blog.example.com/${page}` }] });

console.log("\n=== 1. Without agent-shield: hidden attack ===");
const plain = makeTools();
await makeAgent(plain.tools).invoke(ask("poisoned"));
console.log("Emails sent:", plain.outbox);

console.log("\n=== 2. With agent-shield: hidden attack is stripped by Check In ===");
const guarded = makeTools();
await makeAgent(shieldTools(createShield({ config }), guarded.tools)).invoke(ask("poisoned"));
console.log("Emails sent:", guarded.outbox);

console.log("\n=== 3. With agent-shield: visible attack gets through Check In, Check Out stops it ===");
const visible = makeTools();
await makeAgent(shieldTools(createShield({ config }), visible.tools)).invoke(ask("visible"));
console.log("Emails sent:", visible.outbox);

console.log("\n=== 4. User asks to email the summary after reading a web page: shield asks a human ===");
const approval = makeTools();
const askHuman = createShield({
  config,
  onApproval: async (request) => {
    console.log(`Approval request: ${request.summary}`);
    console.log("(this demo answers: block)");
    return "block";
  },
});
await makeAgent(shieldTools(askHuman, approval.tools)).invoke({
  messages: [{ role: "user", content: "Summarize https://blog.example.com/clean and email it to boss@mycompany.com" }],
});
console.log("Emails sent:", approval.outbox);
