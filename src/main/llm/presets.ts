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
  }
  // Gemma 4 系は node-llama-cpp 3.18.1 では "Failed to load model" になるので
  // 一時撤去 (llama.cpp 側で対応 → node-llama-cpp に反映待ち。詳細は Issue 参照)
]

export function findPreset(id: string): LlmModelPreset | undefined {
  return LLM_MODEL_PRESETS.find(p => p.id === id)
}

export function presetFilename(preset: LlmModelPreset): string {
  const parts = preset.uri.split('/')
  return parts[parts.length - 1]!
}
