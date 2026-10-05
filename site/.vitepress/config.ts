import { defineConfig } from "vitepress";

const repo = "https://github.com/priyanshu-34/agent-shield";

export default defineConfig({
  title: "agent-shield",
  description: "Stop AI agents from acting on hidden instructions in web pages, emails and files.",
  // GitHub project pages live under /<repo>/
  base: "/agent-shield/",
  cleanUrls: true,
  lastUpdated: true,
  head: [["meta", { name: "theme-color", content: "#6c5ce7" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/quickstart" },
      { text: "Reference", link: "/reference/config" },
      { text: "Results", link: "/results" },
      { text: "npm", link: "https://www.npmjs.com/package/@priyans34/agent-shield" },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Quickstart", link: "/guide/quickstart" },
          { text: "How it works", link: "/guide/concepts" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "LangChain / LangGraph", link: "/guide/langgraph" },
          { text: "Mastra", link: "/guide/mastra" },
          { text: "Any other framework", link: "/guide/core" },
          { text: "Asking a human", link: "/guide/approvals" },
          { text: "MCP and third-party tools", link: "/guide/mcp" },
          { text: "Emails, RAG and final answers", link: "/guide/content" },
          { text: "The local classifier", link: "/guide/classifier" },
          { text: "Going to production", link: "/guide/production" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Config", link: "/reference/config" },
          { text: "Rule packs", link: "/reference/packs" },
          { text: "API", link: "/reference/api" },
          { text: "CLI", link: "/reference/cli" },
        ],
      },
      {
        text: "Trust",
        items: [
          { text: "Results", link: "/results" },
          { text: "Limits", link: "/limits" },
          { text: "FAQ", link: "/faq" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: repo }],
    editLink: { pattern: `${repo}/edit/main/site/:path`, text: "Edit this page on GitHub" },
    search: { provider: "local" },
    footer: { message: "MIT licensed", copyright: "© 2026 Priyanshu Singh" },
  },
});
