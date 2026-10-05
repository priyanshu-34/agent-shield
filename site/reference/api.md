# API

## `createShield(options)`

```ts
import { createShield } from "@priyans34/agent-shield";

const shield = createShield({
  config: "./shield.yaml",          // path to YAML, or a config object
  onApproval: async (request) => "allow" | "block",
  log: (event) => {},               // default: prints blocks, flags and warnings
  classifier,                       // optional, from createClassifier()
});
```

| Method | What it does |
|---|---|
| `guard(tool, args, run, sessionId?)` | Check Out → `run()` → Check In. Returns `{ ok: true, value }` or `{ ok: false, message }`. |
| `checkIn(value, { source, sessionId })` | Clean and label untrusted content; taints the conversation. Async. |
| `checkOutput(text, { sessionId })` | Clean a final answer before it's shown. |
| `checkToolDescription(name, description)` | Scan a tool description; returns it, with a warning in front if flagged. |
| `checkToolArgs(name, argNames)` | Warn about rules on arguments the tool doesn't have. |
| `isTainted(sessionId?)` | Has this conversation read untrusted content? |
| `reset(sessionId?)` | Forget a conversation. |
| `config` | The loaded config. |

## Adapters

| Import | Function |
|---|---|
| `@priyans34/agent-shield/langchain` | `shieldTools(shield, tools)` |
| `@priyans34/agent-shield/mastra` | `shieldMastraTools(shield, tools)` |
| `@priyans34/agent-shield/langgraph` | `interruptApproval` |
| `@priyans34/agent-shield/classifier` | `createClassifier({ model?, threshold?, cacheDir?, offline? })` |

## Helpers

| Export | What it does |
|---|---|
| `defineConfig(config)` | Typed config object. |
| `loadConfig(source)` | Load and validate a config; throws with a readable message. |
| `terminalApproval()` | Approver that asks y/N in the terminal. |
| `consoleLogger`, `fileLogger(path)` | Loggers. `fileLogger` writes one JSON line per decision. |
| `checkInText(text)` | Clean and scan one string, without a shield. |
| `checkOutput(text, allowImageDomains)` | The output check, without a shield. |
| `findSecrets(value)`, `redactSecrets(text)` | Secret detection and hiding. |
| `SECRET_PATHS`, `SHELL_DENY` | The lists the packs use. |

## Log events

Every event has `time` and `stage`:

| `stage` | Extra fields |
|---|---|
| `check_out` | `tool`, `decision` (`allow`/`block`/`ask`), `wouldBe` (monitor mode), `pending`, `reasons`, `taintSources`, `args` (secrets hidden) |
| `check_in` | `source`, `flagged`, `detections`, `removed`, `error` |
| `output` | `removed` |
| `config` | `tool`, `message` |
