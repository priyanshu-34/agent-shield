# LangChain / LangGraph

```bash
npm install @priyans34/agent-shield @langchain/core
```

## Wrap your tools

```ts
import { createAgent } from "langchain";
import { createShield } from "@priyans34/agent-shield";
import { shieldTools } from "@priyans34/agent-shield/langchain";

const shield = createShield({ config: "./shield.yaml", onApproval: askUser });
const agent = createAgent({ model, tools: shieldTools(shield, tools) });

await agent.invoke(input, { configurable: { thread_id: "chat-42" } });
```

`shieldTools` returns new tools with the same name, description and schema. Each call runs Check Out first, then the real tool, then Check In on the result. It works with `createAgent`, `createReactAgent`, a `ToolNode` in your own graph, or calling `tool.invoke()` yourself.

## Conversations

The shield tracks taint per `thread_id`. Without one, every call shares a single default conversation. That's stricter, never looser, but one tainted conversation then makes risky actions ask for approval everywhere, so pass a `thread_id`.

## Pausing for approval

In a LangGraph app, the natural way to ask a human is to pause the run, show the request in your UI, and resume later:

```ts
import { Command, MemorySaver } from "@langchain/langgraph";
import { interruptApproval } from "@priyans34/agent-shield/langgraph";

const shield = createShield({ config: "./shield.yaml", onApproval: interruptApproval });
const agent = createAgent({ model, tools: shieldTools(shield, tools), checkpointer: new MemorySaver() });

const paused = await agent.invoke(input, thread);
// paused.__interrupt__[0].value is the approval request: tool, args, reasons, summary
await agent.invoke(new Command({ resume: "allow" }), thread); // or "block"
```

This needs a checkpointer and a `thread_id`. Without them, the interrupt can't pause and the call is blocked.

::: warning Same process
Taint lives in memory. Resume in the same process that paused, or the shield forgets that the conversation was tainted.
:::

## Wrapping warnings

When tools are wrapped, the shield checks that every rule points at an argument the tool really has. If your email tool calls its argument `recipient` but the rule guards `to`, you'll see:

```text
[agent-shield] config warning for send_email: rules for "to" will never run: the tool's arguments are "recipient", "body". …
```

Fix it with the pack's `args` option (`args: [recipient]`) or rename the rule.
