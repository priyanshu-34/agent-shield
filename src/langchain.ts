import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { DEFAULT_SESSION, argNames, type Shield } from "./shield.js";

// Wraps LangChain tools so every call goes through the shield; taint is tracked per thread_id.
export function shieldTools<T extends StructuredToolInterface>(shield: Shield, tools: T[]): StructuredToolInterface[] {
  return tools.map((original) => {
    shield.checkToolArgs(original.name, argNames(original.schema));
    return tool(
      async (args, config) => {
        const sessionId = String(config?.configurable?.thread_id ?? DEFAULT_SESSION);
        // drop toolCall so the inner tool returns raw output, not a ToolMessage
        const { toolCall: _, ...innerConfig } = config ?? {};
        const result = await shield.guard(original.name, args, () => original.invoke(args, innerConfig), sessionId);
        return result.ok ? result.value : result.message;
      },
      { name: original.name, description: shield.checkToolDescription(original.name, original.description), schema: original.schema as any },
    );
  });
}
