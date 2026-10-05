# Rule packs

Packs are ready-made rules for common kinds of tools. Each pack maps onto **your** tool names.

```yaml
packs:
  email:    { tools: [send_email, gmail_send], allowEmails: [mycompany.com] }
  browser:  { tools: [fetch_page], allowDomains: ["*.example.com"] }
  http:     { tools: [http_request], allowDomains: [api.github.com] }
  files:    { read: [read_file], write: [write_file], root: workspace }
  shell:    { tools: [run_command] }
  payments: { tools: [refund], maxAmount: 500 }
  mcp:      { tools: [weather] }
  memory:   { tools: [save_memory] }
```

- A tool can be in only one pack; otherwise the config won't load.
- Your own `tools:` entry for the same tool overrides the pack field by field. For `rules`, your rule for an argument replaces the pack's rule for that argument.
- If your tool's arguments are named differently, map them with `arg` / `args`. The shield warns when a rule points at an argument the tool doesn't have.

## email

| Option | Default | |
|---|---|---|
| `tools` | required | Your email-sending tools. |
| `allowEmails` | – | Allowed domains or addresses. Without it, sending only needs approval after untrusted content. |
| `args` | `[to, cc, bcc]` | Arguments holding recipients. Every address in each must be allowed. |
| `maxPerSession` | – | Most emails per conversation. |

Risk: `risky`.

## browser

| Option | Default | |
|---|---|---|
| `tools` | required | Tools that read web pages. |
| `allowDomains` | any | Sites the agent may open. |
| `arg` | `url` | |

Risk: `safe`. Pages taint the conversation and go through Check In.

## http

Same options as `browser`, but `risky`: for tools that send requests with side effects.

## files

| Option | Default | |
|---|---|---|
| `read` / `write` | `[]` | Tools that read (`safe`) and write (`risky`). At least one. |
| `root` | `.` | The folder the agent may use, relative to where your app runs. |
| `arg` | `path` | |
| `denyPaths` | `[]` | Extra paths to protect. |

Always denied: `.env` files, `*.pem`, `*.key`, SSH keys, `.ssh/`, `.aws/`, `.git/`, `.npmrc`, `secrets.*`, and anything outside the project folder.

## shell

| Option | Default | |
|---|---|---|
| `tools` | required | |
| `arg` | `command` | |
| `alwaysAsk` | `false` | Ask a human before every command. |
| `deny` | `[]` | Extra deny patterns. |

Blocks piping downloads into a shell (`curl … \| sh`), `base64 -d \| sh`, `rm -rf /` or `~`, `chmod 777`, `sudo`, `mkfs`, `dd if=`, fork bombs, `/dev/tcp` and `nc -e` reverse shells, `eval`, `shutdown`/`reboot`.

::: warning A deny list is only an extra layer
Commands are easy to disguise. The real protection is that shell tools are `risky`: after the agent reads untrusted content, every command needs approval. For agents that run commands often, consider `alwaysAsk: true`.
:::

## payments

| Option | Default | |
|---|---|---|
| `tools` | required | |
| `arg` | `amount` | |
| `maxAmount` | – | Calls above this are blocked. |
| `alwaysAsk` | `true` | Ask a human before every payment. |

## mcp

`tools`: tools from third-party MCP servers. They become `risky` with `description: untrusted`, which taints every conversation; see [MCP and third-party tools](../guide/mcp).

## memory

`tools`: tools that write long-term memory. `risky`, so content the agent read can't plant memories without approval.
