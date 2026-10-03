import { interrupt } from "@langchain/langgraph";
import type { ApprovalRequest } from "./shield.js";

// Pauses the run until resumed with Command({ resume: "allow" | "block" }); needs a checkpointer + thread_id.
export function interruptApproval(request: ApprovalRequest): Promise<"allow" | "block"> {
  return Promise.resolve(interrupt(request) === "allow" ? "allow" : "block");
}
