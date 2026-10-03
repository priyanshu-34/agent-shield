import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { terminalApproval, type ApprovalRequest } from "../src/index.js";

const request = { tool: "send_email", summary: "The agent wants to run send_email" } as ApprovalRequest;

function fakeTerminal(answers: string[]) {
  const input = Object.assign(new PassThrough(), { isTTY: true });
  const output = new PassThrough();
  // answer each question as soon as it is printed
  output.on("data", () => answers.length && setImmediate(() => input.write(answers.shift() + "\n")));
  return { input, output };
}

describe("terminalApproval", () => {
  it("blocks when there is no terminal", async () => {
    expect(await terminalApproval(Object.assign(new PassThrough(), { isTTY: false }), new PassThrough())(request)).toBe("block");
  });

  it("asks one question at a time and reads y/N", async () => {
    const { input, output } = fakeTerminal(["y", "nope"]);
    const approve = terminalApproval(input, output);
    expect(await Promise.all([approve(request), approve(request)])).toEqual(["allow", "block"]);
  });
});
