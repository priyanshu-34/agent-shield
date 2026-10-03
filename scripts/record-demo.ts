// Runs the demo and saves it as an asciinema recording (docs/demo.cast), paced and coloured for reading.
// npm run record-demo also turns it into docs/demo.svg (animated, plays in the README).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const output = execSync("npx tsx examples/victim-demo.ts 2>&1", { encoding: "utf8" });

const c = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
const colour = (line: string) => {
  if (line.startsWith("===")) return c("1;36", line);
  if (line.startsWith("[agent-shield] block")) return c("31", line);
  if (line.startsWith("[agent-shield]")) return c("33", line);
  if (line === "Emails sent: []") return c("1;32", `${line}   ✔ nothing leaked`);
  if (/attacker@evil\.example|sk-demo-/.test(line)) return c("1;31", line);
  return line;
};

const events: [number, "o", string][] = [];
let t = 0.5;
const emit = (text: string, wait: number) => {
  events.push([Number(t.toFixed(3)), "o", text]);
  t += wait;
};

// type the command like a person would
emit(c("1;35", "$ "), 0.4);
for (const ch of "npm run demo") emit(ch, 0.07);
emit("\r\n", 0.8);

for (const line of output.split("\n")) {
  if (line.startsWith("=== ") && events.length > 20) emit("\r\n", 1.6);
  emit(colour(line) + "\r\n", line.startsWith("===") ? 0.9 : 0.25);
}
emit("", 3);

const header = { version: 2, width: 132, height: 40, title: "agent-shield demo", env: { TERM: "xterm-256color", SHELL: "/bin/zsh" } };
writeFileSync(new URL("../docs/demo.cast", import.meta.url), [JSON.stringify(header), ...events.map((e) => JSON.stringify(e))].join("\n") + "\n");
console.log(`docs/demo.cast: ${events.length} events, ${t.toFixed(1)}s`);
