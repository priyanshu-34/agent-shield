---
layout: home
hero:
  name: agent-shield
  text: Stop AI agents from acting on hidden instructions
  tagline: You can't stop a model from being fooled by a web page. You can stop it from acting on it.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: How it works
      link: /guide/concepts
    - theme: alt
      text: GitHub
      link: https://github.com/priyanshu-34/agent-shield
features:
  - title: Check Out guards every action
    details: Before a tool runs, plain-code rules decide allow, block or ask a human. Even a fully fooled model can't email outsiders, touch secrets or run curl | sh.
  - title: Check In cleans what the agent reads
    details: Hidden HTML, invisible unicode, encoded text and known attack phrases are removed or flagged before the model sees them. An optional local classifier catches rewordings.
  - title: Rule packs and one command to start
    details: Ready-made rules for email, browsing, files, shell, payments, MCP and memory. `npx @priyans34/agent-shield init` writes a starter config.
  - title: LangGraph, Mastra or anything
    details: One wrapper around your tools. Approvals in the terminal, through a LangGraph interrupt, or any async function.
---

![agent-shield demo: an agent leaks a key without the shield; with it, every attack is blocked](/demo.svg)
