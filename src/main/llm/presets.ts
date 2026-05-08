import type { LlmModelPreset } from '../../shared/types'

export const LLM_MODEL_PRESETS: LlmModelPreset[] = [
  {
    id: 'qwen3.5-4b-q4',
    label: 'Qwen3.5 4B Q4_K_M (おすすめ・約2.5GB)',
    uri: 'hf:unsloth/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf',
    approxSizeMB: 2500
  },
  {
    id: 'qwen3.5-4b-q5',
    label: 'Qwen3.5 4B Q5_K_M (高品質・約3GB)',
    uri: 'hf:unsloth/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q5_K_M.gguf',
    approxSizeMB: 3000
  },
  {
    id: 'qwen3.5-9b-q4',
    label: 'Qwen3.5 9B Q4_K_M (約5.5GB)',
    uri: 'hf:unsloth/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q4_K_M.gguf',
    approxSizeMB: 5500
  },
  {
    id: 'qwen3.5-9b-q5',
    label: 'Qwen3.5 9B Q5_K_M (高品質・約6.5GB)',
    uri: 'hf:unsloth/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q5_K_M.gguf',
    approxSizeMB: 6500
  },
  {
    id: 'gemma4-e2b-q4',
    label: 'Gemma 4 E2B Q4_K_M (軽量・約1.5GB)',
    uri: 'hf:unsloth/gemma-4-E2B-it-GGUF/gemma-4-E2B-it-Q4_K_M.gguf',
    approxSizeMB: 1500
  },
  {
    id: 'gemma4-e2b-q5',
    label: 'Gemma 4 E2B Q5_K_M (軽量・約1.8GB)',
    uri: 'hf:unsloth/gemma-4-E2B-it-GGUF/gemma-4-E2B-it-Q5_K_M.gguf',
    approxSizeMB: 1800
  },
  {
    id: 'gemma4-e4b-q4',
    label: 'Gemma 4 E4B Q4_K_M (約2.5GB)',
    uri: 'hf:unsloth/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf',
    approxSizeMB: 2500
  },
  {
    id: 'gemma4-e4b-q5',
    label: 'Gemma 4 E4B Q5_K_M (高品質・約3GB)',
    uri: 'hf:unsloth/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q5_K_M.gguf',
    approxSizeMB: 3000
  }
]

export function findPreset(id: string): LlmModelPreset | undefined {
  return LLM_MODEL_PRESETS.find(p => p.id === id)
}

export function presetFilename(preset: LlmModelPreset): string {
  const parts = preset.uri.split('/')
  return parts[parts.length - 1]!
}
