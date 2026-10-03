export { createShield, consoleLogger, fileLogger, terminalApproval, DEFAULT_SESSION } from "./shield.js";
export type { Shield, ShieldOptions, ShieldEvent, CheckInEvent, CheckOutEvent, ApprovalRequest, GuardResult } from "./shield.js";
export { checkInText } from "./check-in.js";
export type { CheckInResult, Detection, OnFlagged } from "./check-in.js";
export { defineConfig, loadConfig } from "./config.js";
export type { ShieldConfig, ShieldConfigInput } from "./config.js";
export { checkOut, findSecrets, findUrlData, redactSecrets } from "./check-out.js";
export type { Verdict, CheckOutResult, SessionState } from "./check-out.js";
