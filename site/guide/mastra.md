# Mastra

```bash
npm install @priyans34/agent-shield @mastra/core
```

```ts
import { Agent } from "@mastra/core/agent";
import { createShield } from "@priyans34/agent-shield";
import { shieldMastraTools } from "@priyans34/agent-shield/mastra";

const shield = createShield({ config: "./shield.yaml", onApproval: askUser });

const agent = new Agent({
  id: "assistant",
  name: "Assistant",
  instructions,
  model,
  tools: shieldMastraTools(shield, { sendEmail, fetchPage }),
});

await agent.generate(input, { memory: { thread: "chat-42", resource: "user-1" } });
```

- Taint is tracked per Mastra `threadId`. Use agent memory so each conversation has one.
- The shield uses each tool's `id` to find its rules, so name tools in `shield.yaml` by `id`.
- Wrapped tools keep their own settings (`requireApproval`, input schema, suspend/resume schemas). Only `outputSchema` is removed, because a checked result can be a block message or a labelled string.
- The same [argument-name warning](./langgraph#wrapping-warnings) runs when tools are wrapped.
