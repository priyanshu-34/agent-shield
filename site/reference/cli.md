# CLI

```bash
npx @priyans34/agent-shield init
```

Asks a few questions and writes a starter `shield.yaml`:

1. Which framework you use (LangChain/LangGraph, Mastra, other).
2. What your agent can do: email, browser, http, files, shell, payments, mcp, memory.
3. For each: your tool names, and allowed domains or addresses where it matters.

The file uses [rule packs](./packs) and starts in `monitor` mode. Afterwards it prints the code to add to your agent.

| Flag | What it does |
|---|---|
| `--yes` | No questions; write the defaults (browser, files and email packs). |
| `--out <file>` | Write somewhere other than `shield.yaml`. |
| `--force` | Overwrite an existing file. Without it, `init` never overwrites. |

With no terminal (for example in CI), `init` uses the defaults.
