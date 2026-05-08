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
    id: 'qwen3-8b-q4',
    label: 'Qwen3 8B Q4_K_M (約5GB)',
    uri: 'hf:Qwen/Qwen3-8B-GGUF/Qwen3-8B-Q4_K_M.gguf',
    approxSizeMB: 5000
  }
]

export function findPreset(id: string): LlmModelPreset | undefined {
  return LLM_MODEL_PRESETS.find(p => p.id === id)
}

export function presetFilename(preset: LlmModelPreset): string {
  const parts = preset.uri.split('/')
  return parts[parts.length - 1]!
}
