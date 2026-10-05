# Config

Write the config as YAML (`createShield({ config: "./shield.yaml" })`) or as an object in TypeScript:

```ts
import { createShield, defineConfig } from "@priyans34/agent-shield";

const config = defineConfig({
  mode: "enforce",
  packs: { email: { tools: ["send_email"], allowEmails: ["mycompany.com"] } },
});
const shield = createShield({ config });
```

Both go through the same validator. A typo or unknown key stops the app at start-up with a clear message.

## Full example

```yaml
mode: enforce

packs:
  email: { tools: [send_email], allowEmails: [mycompany.com] }
  files: { read: [read_file], write: [write_file], root: workspace }

checkIn:
  enabled: true
  onFlagged: label
  classifierTimeoutMs: 10000
  maxChunks: 20

output:
  allowImageDomains: [cdn.mycompany.com]
  hideSecrets: true

tools:
  lookup_order:
    risk: safe
    output: trusted
  refund:
    risk: risky
    approval: always
    rules:
      amount: { max: 500 }
  run_command:
    rules:
      command: { deny: ["/\\bsudo\\b/", "rm -rf *"] }
  delete_account:
    risk: blocked

defaults:
  unknownTool: risky
  approvalTimeoutMs: 300000
  onError: block
  maxBlocks: 3
```

## Top level

| Key | Default | What it does |
|---|---|---|
| `mode` | `enforce` | `monitor` logs what would be blocked and blocks nothing. |
| `packs` | – | Ready-made rules; see [Rule packs](./packs). |
| `tools` | `{}` | Per-tool settings, below. They override pack settings field by field. |
| `checkIn` | | Cleaning incoming content. |
| `output` | | The final-answer check. |
| `defaults` | | Fallbacks and limits. |

## `tools.<name>`

| Key | Default | What it does |
|---|---|---|
| `risk` | `risky` | `safe` never needs approval · `risky` needs approval after untrusted content · `blocked` never runs. |
| `approval` | `auto` | `always`: a risky tool asks a human even in a clean conversation. |
| `output` | `untrusted` | `trusted`: results don't taint the conversation and skip Check In. |
| `description` | `trusted` | `untrusted`: the tool's description taints every conversation (third-party/MCP tools). |
| `maxPerSession` | – | Most calls allowed in one conversation. |
| `allowUrlData` | `false` | Turns off the data-in-URL check (for presigned links and the like). |
| `rules.<argument>` | – | Checks on one argument, below. |

## Rules

| Rule | Passes when |
|---|---|
| `allow` | The value matches a pattern. `*` matches one word (no spaces, commas or `<>`). |
| `deny` | Never matches. Wildcards match anywhere; `"/…/"` is a regular expression. |
| `allowEmails` | Every address in a recipient list is in an allowed domain (`mycompany.com`, `*.partner.com`) or is an allowed address. |
| `allowDomains` | The URL's host is listed (`*.example.com` = any subdomain). |
| `allowPaths` / `denyPaths` | The path is inside / outside these globs. Paths outside the project folder always fail. |
| `max` | The number is not above the limit. |

Every tool also gets a secret check and, after untrusted content, a data-in-URL check.

## `checkIn`

| Key | Default | What it does |
|---|---|---|
| `enabled` | `true` | Turn cleaning off (content is still tainted). |
| `onFlagged` | `label` | `label` · `redact` · `drop`; see [Emails, RAG and final answers](../guide/content). |
| `classifierTimeoutMs` | `10000` | Skip the classifier after this long. |
| `maxChunks` | `20` | Most chunks the classifier reads per piece of content. |

## `output`

| Key | Default | What it does |
|---|---|---|
| `allowImageDomains` | `[]` | Sites images in final answers may load from. |
| `hideSecrets` | `true` | Replace secrets in final answers with `[REDACTED]`. |

## `defaults`

| Key | Default | What it does |
|---|---|---|
| `unknownTool` | `risky` | Risk for tools not in the config. |
| `approvalTimeoutMs` | `300000` | Block when a callback or terminal approver doesn't answer in time. |
| `onError` | `block` | What a risky tool gets if the shield itself fails. |
| `maxBlocks` | `3` | Lock every tool after this many rule blocks in one conversation. `0` turns it off. |
