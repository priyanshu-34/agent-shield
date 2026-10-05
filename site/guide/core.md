# Any other framework

The core has no framework dependency. Wrap each tool call in `shield.guard`:

```ts
import { createShield } from "@priyans34/agent-shield";

const shield = createShield({ config: "./shield.yaml", onApproval: askUser });

async function runTool(name: string, args: Record<string, unknown>, conversationId: string) {
  const result = await shield.guard(name, args, () => tools[name](args), conversationId);
  return result.ok ? result.value : result.message; // give the message back to the model
}
```

`guard` runs Check Out, then your function, then Check In on what it returns (unless the tool is `output: trusted`). It never throws for a blocked call.

Tool descriptions from third parties should be checked once when you register them:

```ts
const description = shield.checkToolDescription(name, rawDescription);
shield.checkToolArgs(name, Object.keys(argsSchema.properties));
```

See the [API reference](../reference/api) for every function.
