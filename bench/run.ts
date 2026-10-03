// Compares the candidate classifiers on bench/dataset.ts (+ a public slice) and writes bench/results.md.
//
// Winner rule, fixed before running:
//   1. Pick each model's threshold on the safe items so it has at most 5% false alarms (2 of 40).
//   2. Winner = most attacks caught by patterns + model together at that threshold.
//   3. Within 2 attacks of each other → smaller download wins, then faster.
//   4. A model whose license isn't Apache-2.0/MIT can't become the default without asking the owner.
import { readFileSync, writeFileSync } from "node:fs";
import { checkInText, chunk } from "../src/check-in.js";
import { createClassifier, MODELS, type ModelName } from "../src/classifier.js";
import { ATTACKS, DATASET, SAFE } from "./dataset.js";

const INFO: Record<ModelName, { sizeMb: number; license: string }> = {
  "protectai-deberta-v2": { sizeMb: 739, license: "Apache-2.0" },
  "horizon-guard-small": { sizeMb: 268, license: "Apache-2.0" },
  "prompt-guard-2-86m": { sizeMb: 281, license: "Llama 4 (community ONNX copy of a gated model)" },
};
const MAX_FALSE_ALARMS = Math.floor(SAFE.length * 0.05);
const publicSlice: { text: string; attack: boolean }[] = JSON.parse(readFileSync(new URL("./data/deepset-test.json", import.meta.url), "utf8")).rows;

const patternHit = (text: string) => checkInText(text).flagged;
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`;

type Row = { name: string; threshold: string; caught: number; falseAlarms: number; alone: number; aloneFa: number; pubRecall: string; pubFa: string; ms: number; sizeMb: number; license: string };
const rows: Row[] = [];

const patternCaught = ATTACKS.filter((i) => patternHit(i.text)).length;
const patternFa = SAFE.filter((i) => patternHit(i.text)).length;
const pubPat = publicSlice.filter((r) => patternHit(r.text));
rows.push({
  name: "patterns only", threshold: "-", caught: patternCaught, falseAlarms: patternFa, alone: patternCaught, aloneFa: patternFa,
  pubRecall: pct(pubPat.filter((r) => r.attack).length, publicSlice.filter((r) => r.attack).length),
  pubFa: pct(pubPat.filter((r) => !r.attack).length, publicSlice.filter((r) => !r.attack).length), ms: 0, sizeMb: 0, license: "-",
});

for (const name of Object.keys(MODELS) as ModelName[]) {
  const model = createClassifier({ model: name });
  await model.warmup();
  // score what the model sees in real use: Check In's cleaned text, hidden text and decoded text, in chunks
  const scoreItem = async (text: string) => {
    let max = 0;
    for (const t of checkInText(text).texts) for (const c of chunk(t.text.replace(/\s+/g, " ").trim())) max = Math.max(max, (await model(c)).score);
    return max;
  };
  const started = Date.now();
  const scores = new Map<string, number>();
  for (const item of DATASET) scores.set(item.id, await scoreItem(item.text));
  const ms = (Date.now() - started) / DATASET.length;

  const safeScores = SAFE.map((i) => scores.get(i.id)!).sort((a, b) => b - a);
  const threshold = Math.min(0.99, Math.max(0.5, (safeScores[MAX_FALSE_ALARMS] ?? 0) + 1e-6));
  const modelHit = (i: { id: string }) => scores.get(i.id)! >= threshold;
  const pub = await Promise.all(publicSlice.map(async (r) => ({ ...r, hit: (await model(r.text)).score >= threshold })));

  rows.push({
    name, threshold: threshold.toFixed(3),
    caught: ATTACKS.filter((i) => modelHit(i) || patternHit(i.text)).length,
    falseAlarms: SAFE.filter((i) => modelHit(i) || patternHit(i.text)).length,
    alone: ATTACKS.filter(modelHit).length,
    aloneFa: SAFE.filter(modelHit).length,
    pubRecall: pct(pub.filter((r) => r.attack && r.hit).length, pub.filter((r) => r.attack).length),
    pubFa: pct(pub.filter((r) => !r.attack && r.hit).length, pub.filter((r) => !r.attack).length),
    ms: Math.round(ms), ...INFO[name],
  });
  const missed = ATTACKS.filter((i) => !modelHit(i) && !patternHit(i.text)).map((i) => i.id);
  const fa = SAFE.filter((i) => modelHit(i)).map((i) => `${i.id}(${scores.get(i.id)!.toFixed(2)})`);
  console.log(`${name}: threshold ${threshold.toFixed(3)}, missed ${missed.join(" ") || "none"}; model false alarms ${fa.join(" ") || "none"}`);
}

const models = rows.slice(1).sort((a, b) => b.caught - a.caught || a.sizeMb - b.sizeMb || a.ms - b.ms);
const best = models[0];
const winner = models.filter((m) => best.caught - m.caught <= 2).sort((a, b) => a.sizeMb - b.sizeMb || a.ms - b.ms)[0];

const table = [
  `| | Threshold | Attacks caught (patterns + model) | False alarms (patterns + model) | Model alone: caught / false alarms | Public slice (deepset): caught / false alarms | ms per item | Download | License |`,
  `|---|---|---|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.name} | ${r.threshold} | ${r.caught}/${ATTACKS.length} (${pct(r.caught, ATTACKS.length)}) | ${r.falseAlarms}/${SAFE.length} | ${r.alone} / ${r.aloneFa} | ${r.pubRecall} / ${r.pubFa} | ${r.ms} | ${r.sizeMb ? `${r.sizeMb} MB` : "-"} | ${r.license} |`),
].join("\n");
const report = `# Classifier benchmark (v0)

Run: ${new Date().toISOString().slice(0, 10)} · ${ATTACKS.length} attacks + ${SAFE.length} normal items (bench/dataset.ts) · public slice: ${publicSlice.length} rows of deepset/prompt-injections (Apache-2.0).

${table}

Winner by the pre-set rule: **${winner.name}** (threshold ${winner.threshold}).

Notes:
- Small set (80 items); M6 grows it to ~400. Treat differences of 1–2 items as noise.
- The public slice is mostly *direct* injections (some in German) and may be in some models' training data.
- Thresholds are picked on the same safe items they're scored on, so false alarms here are optimistic.
- The \`exfil-secrets\` phrase rule was tightened after seeing a false alarm in this set, so the phrase-rule numbers are slightly tuned to it.
- Models are pinned to the revisions in src/classifier.ts.
`;
writeFileSync(new URL("./results.md", import.meta.url), report);
console.log("\n" + report);
