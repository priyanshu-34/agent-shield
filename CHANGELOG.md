# Changelog

## 0.1.1 — 2026-10-05

**Security fix.** In 0.1.0, an `allow` pattern like `*@mycompany.com` accepted strings such as
`"x@evil.com, boss@mycompany.com"`, because `*` matched anything, including commas and spaces.
An attacker could add their own recipient as long as the string ended with an allowed value. Please upgrade.

- `*` in `allow` patterns now matches a single token (no spaces, `,`, `;`, `<` or `>`). `deny` patterns still match anywhere.
- New `allowEmails` rule: reads recipient lists (`a@x.com, B <b@y.com>; c@z.com`) and checks every address
  against allowed domains (`mycompany.com`, `*.partner.com`) or full addresses. Use it for `to`, `cc` and `bcc`.

## 0.1.0 — 2026-10-03

First release.

- **Check Out:** per-tool rules (allow/deny patterns, allowed domains, allowed/denied paths, number limits, per-session call limits), secret check, data-in-URL check, taint tracking per conversation, lockdown after repeated blocks, `monitor` and `enforce` modes.
- **Check In:** removes hidden HTML, invisible unicode and smuggled tag characters; decodes base64/hex/URL-encoded text; flags common attack phrases; wraps content as `<untrusted>`; `label`, `redact` or `drop` for flagged content.
- **Approvals:** callback, `terminalApproval()`, and LangGraph `interruptApproval`.
- **Classifier (optional):** `@priyans34/agent-shield/classifier`, a local model (Horizon-Labs prompt-injection-guard-small) chosen by benchmark.
- **Output check:** removes images and data-carrying links that would leak to other sites.
- **Tool descriptions:** scanned when wrapped; `description: untrusted` for third-party tools.
- **Adapters:** `@priyans34/agent-shield/langchain`, `@priyans34/agent-shield/langgraph`, `@priyans34/agent-shield/mastra`.
- **Evaluation:** `npm run eval` (see bench/eval-results.md).
