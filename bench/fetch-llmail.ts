// Builds bench/data/llmail-sample.json from microsoft/llmail-inject-challenge (MIT), the same way every time.
// Attacks: Phase2 labelled submissions (downloaded once, ~69 MB, cached); safe: the dataset's emails for false-positive tests.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "https://huggingface.co/datasets/microsoft/llmail-inject-challenge/resolve/main/data";
const ATTACKS = 120;
const SAFE = 120;

// small seeded random, so the sample is reproducible
let seed = 42;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const shuffle = <T>(a: T[]) => a.map((x) => [rand(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);

async function cached(file: string): Promise<string> {
  const dir = path.join(os.homedir(), ".cache", "agent-shield", "data");
  const local = path.join(dir, file);
  if (!existsSync(local)) {
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) throw new Error(`${res.status} downloading ${file}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(local, "utf8");
}

// keys are the full email text ("Subject of the email: … Body: …"), same layout as the safe emails
const labelled = JSON.parse(await cached("labelled_unique_submissions_phase2.json")) as Record<string, { attack_attempt: string; reason: string }>;
const seen = new Set<string>();
const attacks = shuffle(Object.entries(labelled))
  .filter(([text, label]) => {
    if (label.attack_attempt !== "True" || text.length < 120) return false;
    // drop near-duplicates (teams submitted many small variants)
    const key = text.toLowerCase().replace(/\W+/g, "").slice(0, 150);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .slice(0, ATTACKS)
  .map(([text, label], i) => ({ id: `llm-a-${i}`, attack: true, source: "email", reason: label.reason, text }));

const safeEmails = JSON.parse(await cached("emails_for_fp_tests.json")) as string[];
const safe = shuffle(safeEmails.map((text, i) => ({ id: `llm-s-${i}`, attack: false, source: "email", text }))).slice(0, SAFE);

writeFileSync(
  new URL("./data/llmail-sample.json", import.meta.url),
  JSON.stringify({ source: "microsoft/llmail-inject-challenge (MIT): labelled_unique_submissions_phase2.json + emails_for_fp_tests.json, seed 42", attacks, safe }, null, 1),
);
const reasons = attacks.reduce<Record<string, number>>((n, a) => ({ ...n, [a.reason]: (n[a.reason] ?? 0) + 1 }), {});
console.log(`attacks: ${attacks.length} ${JSON.stringify(reasons)}, safe: ${safe.length}`);
