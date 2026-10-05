# The local classifier

Phrase rules only catch known wordings. The optional classifier is a small AI model that runs **on your machine** (no API key, no cost) and catches reworded attacks.

```bash
npm install @huggingface/transformers
```

```ts
import { createClassifier } from "@priyans34/agent-shield/classifier";

const classifier = createClassifier();   // Horizon-Labs prompt-injection-guard-small
await classifier.warmup();               // optional: download + load at startup
const shield = createShield({ config: "./shield.yaml", classifier });
```

- The model (~268 MB) downloads once on first use and is cached in `~/.cache/agent-shield`. It's pinned to a fixed version.
- Offline: run `warmup()` once with internet, copy the cache folder, then use `createClassifier({ offline: true, cacheDir })`.
- Long content is read in overlapping chunks, so an attack at the bottom of a long page is still seen.
- If the model fails or takes longer than `checkIn.classifierTimeoutMs` (10 s), it's skipped with a warning. The content is still tainted, so Check Out keeps protecting.
- Bring your own: any `async (text) => ({ score })` function works, with an optional `.threshold`.

## Should I turn it on?

It flags almost every attack, but it also over-flags normal emails and adds noticeable time per tool result. With the default `onFlagged: label`, a false alarm only adds a warning label, so content is never lost. Avoid `drop` with the classifier.

Use it where a little delay is fine. Otherwise rely on phrase rules plus Check Out, which does the real protecting. The measured numbers are on the [Results](../results) page.

## Other models

```ts
createClassifier({ model: "protectai-deberta-v2" });   // or "prompt-guard-2-86m"
createClassifier({ threshold: 0.95 });                 // stricter
```

These were compared in the benchmark; see [Results](../results).
