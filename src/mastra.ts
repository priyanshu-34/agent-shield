import { DEFAULT_SESSION, type Shield } from "./shield.js";

// Structural type so this file needs no import from @mastra/core.
interface MastraToolLike {
  id: string;
  description: string;
  outputSchema?: unknown;
  execute?: (input: any, context: any) => Promise<any>;
}

// Wraps Mastra tools so every call goes through the shield; taint is tracked per Mastra threadId.
export function shieldMastraTools<T extends Record<string, MastraToolLike>>(shield: Shield, tools: T): T {
  const wrapped = Object.entries(tools).map(([key, original]) => {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(original)), original) as MastraToolLike;
    copy.description = shield.checkToolDescription(original.id, original.description);
    // checked output can be a block message or a labelled string, so the original output schema no longer applies
    copy.outputSchema = undefined;
    copy.execute = async (input, context) => {
      const sessionId = String(context?.agent?.threadId ?? DEFAULT_SESSION);
      const result = await shield.guard(original.id, input, () => original.execute!(input, context), sessionId);
      return result.ok ? result.value : result.message;
    };
    return [key, copy] as const;
  });
  return Object.fromEntries(wrapped) as T;
}
