import type { LlmModelPreset } from '../../shared/types'

export const LLM_MODEL_PRESETS: LlmModelPreset[] = [
  {
    id: 'gemma4-12b-q4',
    label: '推奨・最新: Gemma 4 12B Q4_K_M (約7.3GB・16GB+ RAM)',
    uri: 'hf:unsloth/gemma-4-12b-it-GGUF/gemma-4-12b-it-Q4_K_M.gguf',
    approxSizeMB: 7300
  },
  {
    id: 'gemma4-e4b-q4',
    label: '最新: Gemma 4 E4B Q4_K_M (軽量・約5GB)',
    uri: 'hf:unsloth/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf',
    approxSizeMB: 5000
  },
  {
    id: 'qwen3.5-4b-q4',
    label: '安定版/予備: Qwen3.5 4B Q4_K_M (約2.5GB)',
    uri: 'hf:unsloth/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf',
    approxSizeMB: 2500
  },
  {
    id: 'qwen3.5-4b-q5',
    label: '安定版/予備: Qwen3.5 4B Q5_K_M (高品質・約3GB)',
    uri: 'hf:unsloth/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q5_K_M.gguf',
    approxSizeMB: 3000
  },
  {
    id: 'qwen3.5-9b-q4',
    label: '安定版/予備: Qwen3.5 9B Q4_K_M (約5.5GB)',
    uri: 'hf:unsloth/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q4_K_M.gguf',
    approxSizeMB: 5500
  },
  {
    id: 'qwen3.5-9b-q5',
    label: '安定版/予備: Qwen3.5 9B Q5_K_M (高品質・約6.5GB)',
    uri: 'hf:unsloth/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q5_K_M.gguf',
    approxSizeMB: 6500
  }
  // Gemma 4 は gilad/gemma4 ブランチ + 自前ビルドの llama.cpp (b9524) で対応
  // (scripts/setup-gemma4-llama.mjs / setup:llama)。GGUF 埋め込み jinja テンプレートを
  // JinjaTemplateChatWrapper で直接使う。判定は id が 'gemma4' 始まりで共通。
  // E4B (nano 実効~4B) は軽量枠、12B は dense。E2B/26B-A4B/31B は未追加。
  // upstream PR #591 マージ＆リリース後はクリーンな npm 依存へ戻す。
]

export function findPreset(id: string): LlmModelPreset | undefined {
  return LLM_MODEL_PRESETS.find(p => p.id === id)
}

export function presetFilename(preset: LlmModelPreset): string {
  const parts = preset.uri.split('/')
  return parts[parts.length - 1]!
}
