# Results

agent-shield is measured, not just described. The numbers live in one place in the repo, so they can't drift:

- **[Evaluation results](https://github.com/priyanshu-34/agent-shield/blob/main/bench/eval-results.md)**: content detection, agent scenarios and speed, scored with all settings frozen first, mostly on content the shield was never tuned on (new hand-written items and emails from Microsoft's LLMail-Inject challenge).
- **[Classifier benchmark](https://github.com/priyanshu-34/agent-shield/blob/main/bench/results.md)**: how the default local model was chosen, with the rule for picking it written before running.

Run them yourself:

```bash
npm run eval    # needs the classifier model (~268 MB, downloaded once)
npm run bench   # compares three models (~1.3 GB of downloads)
```

## What the results say

- **Check Out does the real protecting.** In the agent scenarios, run with a scripted model that obeys every instruction it reads (the worst case), Check Out stopped every tool-based attack, as long as third-party tool descriptions were marked `untrusted`.
- **Phrase rules alone flag few attacks.** Attackers reword. That's fine, because untrusted content is tainted either way, so Check Out still guards risky actions.
- **The classifier flags almost everything but over-flags** some normal emails, and it adds noticeable time. Keep `onFlagged: label` when you use it.
- **The scenarios are a worst case, not a real-model attack success rate.** That hasn't been measured yet.

Testing also found and fixed real bugs before users did: a poisoned tool description reaching an allowed address, and an email allow list that a crafted recipient string could get around (fixed in 0.1.1).
