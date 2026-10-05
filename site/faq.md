# FAQ

**Does it call an LLM or send my data anywhere?**
No. Everything runs in your process. The optional classifier is a local model that runs on your machine.

**Will it slow my agent down?**
Check Out and the phrase rules take well under a millisecond. The optional classifier adds noticeable time per tool result; see [Results](./results).

**Will it break my agent?**
Start in `monitor` mode: it only logs. Blocked calls return a message to the model instead of throwing, so the agent keeps going.

**Why does it ask for approval so often?**
After a conversation reads untrusted content, every `risky` action needs approval. Mark tools that have no side effects `safe`, mark trusted sources `output: trusted`, and keep third-party tools to what you need.

**Isn't a better system prompt enough?**
It helps, but attackers keep finding new wordings and one success is enough. agent-shield puts plain-code checks around actions so the model doesn't have to be perfect.

**Does it stop jailbreaks typed by the user?**
No. It's built for *indirect* injection: attacks inside content the agent reads.

**Which frameworks?**
LangChain / LangGraph and Mastra have adapters. Anything else can use `shield.guard`.

**Python?**
Not yet.

**License?**
MIT.
