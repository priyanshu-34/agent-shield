export { createShield, consoleLogger, fileLogger, DEFAULT_SESSION } from "./shield.js";
export type { Shield, ShieldOptions, ShieldEvent, ApprovalRequest, GuardResult } from "./shield.js";
export { defineConfig, loadConfig } from "./config.js";
export type { ShieldConfig, ShieldConfigInput } from "./config.js";
export { checkOut, findSecrets, redactSecrets } from "./check-out.js";
export type { Verdict, CheckOutResult, SessionState } from "./check-out.js";
