import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const ruleSchema = z
  .object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    allowDomains: z.array(z.string()).optional(),
    allowPaths: z.array(z.string()).optional(),
    denyPaths: z.array(z.string()).optional(),
    max: z.number().optional(),
  })
  .strict();

const toolSchema = z
  .object({
    risk: z.enum(["safe", "risky", "blocked"]).default("risky"),
    output: z.enum(["untrusted", "trusted"]).default("untrusted"),
    maxPerSession: z.number().int().positive().optional(),
    // turn off the data-in-URL check for tools that legitimately use long URL tokens (e.g. presigned links)
    allowUrlData: z.boolean().default(false),
    rules: z.record(z.string(), ruleSchema).optional(),
  })
  .strict();

export const configSchema = z
  .object({
    mode: z.enum(["monitor", "enforce"]).default("enforce"),
    checkIn: z
      .object({
        enabled: z.boolean().default(true),
        onFlagged: z.enum(["label", "redact", "drop"]).default("label"),
        classifierTimeoutMs: z.number().int().positive().default(10_000),
        maxChunks: z.number().int().positive().default(20),
      })
      .strict()
      .prefault({}),
    tools: z.record(z.string(), toolSchema).default({}),
    defaults: z
      .object({
        unknownTool: z.enum(["safe", "risky", "blocked"]).default("risky"),
        approvalTimeoutMs: z.number().int().positive().default(5 * 60_000),
        onError: z.enum(["block", "allow"]).default("block"),
        // lock all tools after this many rule blocks in one conversation; 0 turns it off
        maxBlocks: z.number().int().min(0).default(3),
      })
      .strict()
      .prefault({}),
  })
  .strict();

export type ShieldConfigInput = z.input<typeof configSchema>;
export type ShieldConfig = z.output<typeof configSchema>;
export type ToolPolicy = z.output<typeof toolSchema>;
export type ArgRule = z.output<typeof ruleSchema>;

export function defineConfig(config: ShieldConfigInput): ShieldConfigInput {
  return config;
}

// Accepts a config object or a path to a YAML file; throws a readable error on bad config.
export function loadConfig(source: ShieldConfigInput | string): ShieldConfig {
  const raw = typeof source === "string" ? parse(readFileSync(source, "utf8")) : source;
  const result = configSchema.safeParse(raw ?? {});
  if (!result.success) throw new Error(`agent-shield: invalid config\n${z.prettifyError(result.error)}`);
  return result.data;
}
