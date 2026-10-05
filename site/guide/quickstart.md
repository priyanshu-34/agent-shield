# Quickstart

Protect an agent in about two minutes.

## 1. Install

```bash
npm install @priyans34/agent-shield
```

Node 22 or newer.

## 2. Create a config

```bash
npx @priyans34/agent-shield init
```

It asks which framework you use and what your agent can do (send email, browse, read files, run commands…), then writes `shield.yaml`. Use `--yes` to skip the questions and take the defaults.

The file starts in **monitor** mode: the shield logs what it *would* block and blocks nothing. Your agent keeps working while you check the log.

```yaml
mode: monitor
packs:
  browser:
    tools: [fetch_page]
  files:
    read: [read_file]
    write: [write_file]
    root: .
  email:
    tools: [send_email]
    allowEmails: [mycompany.com]
```

## 3. Wrap your tools

::: code-group

```ts [LangChain / LangGraph]
import { createShield } from "@priyans34/agent-shield";
import { shieldTools } from "@priyans34/agent-shield/langchain";

const shield = createShield({ config: "./shield.yaml" });
const agent = createAgent({ model, tools: shieldTools(shield, tools) });

await agent.invoke(input, { configurable: { thread_id: conversationId } });
```

```ts [Mastra]
import { createShield } from "@priyans34/agent-shield";
import { shieldMastraTools } from "@priyans34/agent-shield/mastra";

const shield = createShield({ config: "./shield.yaml" });
const agent = new Agent({ ...yourAgent, tools: shieldMastraTools(shield, tools) });
```

```ts [Anything else]
import { createShield } from "@priyans34/agent-shield";

const shield = createShield({ config: "./shield.yaml" });
const result = await shield.guard("send_email", args, () => sendEmail(args), conversationId);
// result.ok ? result.value : result.message
```

:::

Pass a conversation id (`thread_id` in LangGraph, `threadId` in Mastra). The shield remembers what each conversation has read.

## 4. Watch the log, then enforce

Run your agent as usual. Lines like these show what would have happened:

```text
[agent-shield] check-in tool:fetch_page: removed hidden elements (display:none); flagged ignore-previous
[agent-shield] ask send_email: untrusted content was read earlier (tool:fetch_page)
```

When the log looks right, change `mode: monitor` to `mode: enforce`, and add an approver so risky actions can be approved by a person: see [Asking a human](./approvals).

## Next

- [How it works](./concepts): Check In, Check Out and taint in five minutes.
- [Rule packs](../reference/packs): every pack and its options.
- [Going to production](./production): a short checklist.
