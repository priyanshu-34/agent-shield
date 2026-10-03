# Changelog

## 0.1.0 — 2026-10-03

First release.

- **Check Out:** per-tool rules (allow/deny patterns, allowed domains, allowed/denied paths, number limits, per-session call limits), secret check, data-in-URL check, taint tracking per conversation, lockdown after repeated blocks, `monitor` and `enforce` modes.
- **Check In:** removes hidden HTML, invisible unicode and smuggled tag characters; decodes base64/hex/URL-encoded text; flags common attack phrases; wraps content as `<untrusted>`; `label`, `redact` or `drop` for flagged content.
- **Approvals:** callback, `terminalApproval()`, and LangGraph `interruptApproval`.
- **Classifier (optional):** `agent-shield/classifier`, a local model (Horizon-Labs prompt-injection-guard-small) chosen by benchmark.
- **Output check:** removes images and data-carrying links that would leak to other sites.
- **Tool descriptions:** scanned when wrapped; `description: untrusted` for third-party tools.
- **Adapters:** `agent-shield/langchain`, `agent-shield/langgraph`, `agent-shield/mastra`.
- **Evaluation:** `npm run eval` (see bench/eval-results.md).
