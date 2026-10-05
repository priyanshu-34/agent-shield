import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/index.js";

const root = path.resolve(import.meta.dirname, "..");
const markdown = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith(".") || e.name === "node_modules" ? [] : e.isDirectory() ? markdown(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : [],
  );
const files = [path.join(root, "README.md"), ...markdown(path.join(root, "site"))];

// every ```yaml block in the docs must be a config that loads, unless it starts with "# partial"
const blocks = files.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/```yaml\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .filter((yaml) => !yaml.startsWith("# partial"))
    .map((yaml, i) => [`${path.relative(root, file)} #${i + 1}`, yaml] as const),
);

describe("config examples in the docs", () => {
  it("found some", () => expect(blocks.length).toBeGreaterThan(5));
  it.each(blocks)("%s loads", (_, yaml) => {
    expect(() => loadConfig(parse(yaml))).not.toThrow();
  });
});
