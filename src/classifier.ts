import os from "node:os";
import path from "node:path";
import type { Classifier } from "./check-in.js";

export interface ModelSpec {
  // Hugging Face repo id, pinned to a commit so the threshold keeps meaning the same thing
  id: string;
  revision: string;
  subfolder?: string;
  modelFileName?: string;
  dtype?: "fp32" | "q8";
  injectionLabel: string;
  threshold: number;
}

export const MODELS = {
  "protectai-deberta-v2": { id: "protectai/deberta-v3-base-prompt-injection-v2", revision: "90c9989b1a342275dd0d1a95aad283c04e075671", dtype: "fp32", injectionLabel: "INJECTION", threshold: 0.5 },
  // default: won bench/results.md (threshold picked there for ≤5% false alarms)
  "horizon-guard-small": { id: "Horizon-Labs/prompt-injection-guard-small", revision: "3215a27edd62c5ba0bd786c57a9d243b2158e70e", dtype: "q8", injectionLabel: "INJECTION", threshold: 0.89 },
  "prompt-guard-2-86m": {
    id: "gravitee-io/Llama-Prompt-Guard-2-86M-onnx",
    revision: "45a05fbd5337a864edc608f994911f009c37ca57",
    subfolder: "",
    modelFileName: "model.quant",
    dtype: "fp32",
    injectionLabel: "MALICIOUS",
    threshold: 0.5,
  },
} satisfies Record<string, ModelSpec>;

export type ModelName = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelName = "horizon-guard-small";

export interface ClassifierOptions {
  model?: ModelName | ModelSpec;
  // where models are downloaded and cached (default ~/.cache/agent-shield)
  cacheDir?: string;
  // never download; the model must already be in cacheDir (copy the folder from a machine that ran warmup())
  offline?: boolean;
  threshold?: number;
}

type TextClassifier = (text: string, opts: { top_k: null }) => Promise<{ label: string; score: number }[]>;

// Downloads the model on first use (cached in ~/.cache/agent-shield) and scores text locally.
export function createClassifier(options: ClassifierOptions = {}): Classifier & { warmup: () => Promise<void>; spec: ModelSpec } {
  const spec: ModelSpec = typeof options.model === "object" ? options.model : MODELS[options.model ?? DEFAULT_MODEL];
  let loading: Promise<TextClassifier> | undefined;

  const load = () =>
    (loading ??= (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      // per-call options only, so the app's own transformers.js settings stay untouched
      const pipe = await pipeline("text-classification", spec.id, {
        revision: spec.revision,
        cache_dir: options.cacheDir ?? path.join(os.homedir(), ".cache", "agent-shield"),
        local_files_only: options.offline ?? false,
        dtype: spec.dtype,
        ...(spec.subfolder !== undefined && { subfolder: spec.subfolder }),
        ...(spec.modelFileName && { model_file_name: spec.modelFileName }),
      });
      return pipe as unknown as TextClassifier;
    })().catch((err) => {
      loading = undefined;
      throw err;
    }));

  const classify = async (text: string) => {
    const scores = await (await load())(text, { top_k: null });
    return { score: scores.find((s) => s.label === spec.injectionLabel)?.score ?? 0 };
  };
  return Object.assign(classify, { threshold: options.threshold ?? spec.threshold, warmup: async () => void (await load()), spec });
}
