# Going to production

A short checklist.

1. **Start in `monitor` mode** and run real traffic for a few days. Read what would have been blocked.
2. **Fix config warnings.** Every `config warning … will never run` means a rule isn't protecting anything.
3. **Pass a conversation id** on every call (`thread_id` / `threadId` / the `sessionId` argument).
4. **Add an approver** before switching to `enforce`. Without one, every call that needs approval is blocked.
5. **Mark third-party tools** (MCP) with the `mcp` pack or `description: untrusted`.
6. **Keep allow lists narrow.** Use `allowEmails` for recipients, specific domains rather than `*`.
7. **Mark trusted sources** with `output: trusted` so your own database doesn't taint conversations.
8. **Call `checkOutput`** on final answers if your UI renders markdown or HTML.
9. **Send logs somewhere you'll read them:**
   ```ts
   import { fileLogger } from "@priyans34/agent-shield";
   createShield({ config, log: fileLogger("./shield.log") });
   ```
   Every decision is one JSON line, with secrets hidden.
10. **Switch to `enforce`.**

## What to watch

- Many approvals for normal work: your rules are too broad or a trusted source isn't marked `trusted`.
- `locked` messages: three calls were blocked in one conversation, often an attack being retried, sometimes a too-strict rule.
- Classifier warnings: the model timed out or failed and was skipped.
