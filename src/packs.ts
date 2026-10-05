import { z } from "zod";

const toolList = z.array(z.string().min(1)).min(1);

// Ready-made rules for common tool types; `tools` maps a pack onto your own tool names.
export const packsSchema = z
  .object({
    email: z
      .object({
        tools: toolList,
        allowEmails: z.array(z.string()).optional(),
        args: z.array(z.string()).default(["to", "cc", "bcc"]),
        maxPerSession: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    browser: z.object({ tools: toolList, allowDomains: z.array(z.string()).optional(), arg: z.string().default("url") }).strict().optional(),
    http: z.object({ tools: toolList, allowDomains: z.array(z.string()).optional(), arg: z.string().default("url") }).strict().optional(),
    files: z
      .object({
        read: z.array(z.string()).default([]),
        write: z.array(z.string()).default([]),
        // folder the agent may use, relative to where the app runs (process.cwd())
        root: z.string().default("."),
        arg: z.string().default("path"),
        denyPaths: z.array(z.string()).default([]),
      })
      .strict()
      .refine((f) => f.read.length + f.write.length > 0, "files pack needs at least one tool in read or write")
      .optional(),
    shell: z
      .object({ tools: toolList, arg: z.string().default("command"), alwaysAsk: z.boolean().default(false), deny: z.array(z.string()).default([]) })
      .strict()
      .optional(),
    payments: z
      .object({ tools: toolList, arg: z.string().default("amount"), maxAmount: z.number().positive().optional(), alwaysAsk: z.boolean().default(true) })
      .strict()
      .optional(),
    mcp: z.object({ tools: toolList }).strict().optional(),
    memory: z.object({ tools: toolList }).strict().optional(),
  })
  .strict();

export type PacksInput = z.input<typeof packsSchema>;

export const SECRET_PATHS = ["**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/id_rsa*", "**/id_ed25519*", "**/.ssh/**", "**/.aws/**", "**/.git/**", "**/.npmrc", "**/secrets.*"];

// An extra layer only: deny lists are easy to dodge, so shell tools stay `risky` and need approval after untrusted content.
export const SHELL_DENY = [
  "/(curl|wget)[^|;&]*\\|\\s*(ba|z|da)?sh\\b/",
  "/base64\\s+(-d|--decode)[^|]*\\|\\s*(ba|z)?sh\\b/",
  "/\\brm\\s+-[a-z]*[rf][a-z]*\\s+(\\/|~|\\*|\\$HOME)/",
  "/\\bchmod\\s+(-R\\s+)?777\\b/",
  "/\\bsudo\\b/",
  "/\\bmkfs\\b/",
  "/\\bdd\\s+if=/",
  "/:\\(\\)\\s*\\{/",
  "/\\/dev\\/tcp\\//",
  "/\\bnc\\b[^|;&]*\\s-e\\s/",
  "/\\beval\\b/",
  "/\\b(shutdown|reboot)\\b/",
];

type ToolInput = Record<string, unknown> & { rules?: Record<string, Record<string, unknown>> };

const rootGlob = (root: string) => {
  const r = root.replace(/^\.\/?/, "").replace(/\/+$/, "");
  return r ? `${r}/**` : "**";
};

// Turns packs into per-tool policies; a tool may only belong to one pack.
export function expandPacks(input: unknown): Record<string, ToolInput> {
  const packs = packsSchema.parse(input ?? {});
  const out: Record<string, ToolInput> = {};
  const add = (pack: string, names: string[], policy: (name: string) => ToolInput) => {
    for (const name of names) {
      if (out[name]) throw new Error(`tool "${name}" is in more than one pack (${out[name].__pack} and ${pack})`);
      out[name] = { ...policy(name), __pack: pack };
    }
  };

  if (packs.email) {
    const e = packs.email;
    add("email", e.tools, () => ({
      risk: "risky",
      ...(e.maxPerSession && { maxPerSession: e.maxPerSession }),
      ...(e.allowEmails && { rules: Object.fromEntries(e.args.map((a) => [a, { allowEmails: e.allowEmails }])) }),
    }));
  }
  if (packs.browser) {
    const b = packs.browser;
    add("browser", b.tools, () => ({ risk: "safe", ...(b.allowDomains && { rules: { [b.arg]: { allowDomains: b.allowDomains } } }) }));
  }
  if (packs.http) {
    const h = packs.http;
    add("http", h.tools, () => ({ risk: "risky", ...(h.allowDomains && { rules: { [h.arg]: { allowDomains: h.allowDomains } } }) }));
  }
  if (packs.files) {
    const f = packs.files;
    const rules = { [f.arg]: { allowPaths: [rootGlob(f.root)], denyPaths: [...SECRET_PATHS, ...f.denyPaths] } };
    add("files", f.read, () => ({ risk: "safe", rules }));
    add("files", f.write, () => ({ risk: "risky", rules }));
  }
  if (packs.shell) {
    const s = packs.shell;
    add("shell", s.tools, () => ({ risk: "risky", ...(s.alwaysAsk && { approval: "always" }), rules: { [s.arg]: { deny: [...SHELL_DENY, ...s.deny] } } }));
  }
  if (packs.payments) {
    const p = packs.payments;
    add("payments", p.tools, () => ({
      risk: "risky",
      ...(p.alwaysAsk && { approval: "always" }),
      ...(p.maxAmount && { rules: { [p.arg]: { max: p.maxAmount } } }),
    }));
  }
  if (packs.mcp) add("mcp", packs.mcp.tools, () => ({ risk: "risky", description: "untrusted" }));
  if (packs.memory) add("memory", packs.memory.tools, () => ({ risk: "risky" }));
  return out;
}

// Your own `tools:` entry wins field by field; for rules, your rule for an argument replaces the pack's.
export function mergeTools(fromPacks: Record<string, ToolInput>, own: Record<string, ToolInput> = {}): Record<string, ToolInput> {
  const merged: Record<string, ToolInput> = {};
  for (const name of new Set([...Object.keys(fromPacks), ...Object.keys(own)])) {
    const { __pack: _, ...pack } = fromPacks[name] ?? {};
    const mine = own[name] ?? {};
    const rules = pack.rules || mine.rules ? { ...pack.rules, ...mine.rules } : undefined;
    merged[name] = { ...pack, ...mine, ...(rules && { rules }) };
  }
  return merged;
}
