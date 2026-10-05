# Asking a human

When a call needs approval, the shield calls your `onApproval` function and waits. If there's no approver, the call is blocked.

```ts
const shield = createShield({
  config: "./shield.yaml",
  onApproval: async (request) => ((await askUser(request.summary)) ? "allow" : "block"),
});
```

The request has everything a person needs:

| Field | What it is |
|---|---|
| `tool`, `args` | The call the agent wants to make. |
| `reasons` | Why it needs approval. |
| `summary` | A plain-words explanation you can show as-is. |
| `taintSources`, `flaggedSources` | What untrusted content was read, and which of it looked like an attack. |
| `sessionId` | The conversation. |

An example `summary`:

> The agent wants to run "send_email" with {"to":"boss@mycompany.com",…}. Earlier in this conversation it read untrusted content (tool:fetch_page). None of it was flagged as an attack.

## Ready-made approvers

```ts
import { terminalApproval } from "@priyans34/agent-shield";
import { interruptApproval } from "@priyans34/agent-shield/langgraph";

// local scripts: y/N in the terminal, one question at a time; blocks when there's no terminal (CI)
createShield({ config, onApproval: terminalApproval() });

// LangGraph apps: pause the run and resume later
createShield({ config, onApproval: interruptApproval });
```

## Timeouts

Callback and terminal approvers that don't answer in 5 minutes are blocked (`defaults.approvalTimeoutMs`). LangGraph interrupts have no timeout: the run stays paused until you resume it.

## When approval is needed

- A `risky` tool after the conversation read untrusted content.
- A tool with `approval: always`, every time (the payments pack does this by default).
- Never for `safe` tools, and never when a rule already blocked the call.
