// VibeVoice-ASR のモデルプリセット。main / renderer の両方から import する共有定義。
// 初回 DL（4bit 約 5.7GB / bf16 約 16.7GB）の進捗計算に approxSizeMB を使う。
export type VibeVoiceModelPreset = {
  id: string
  label: string
  approxSizeMB: number
}

export const VIBEVOICE_MODEL_PRESETS: VibeVoiceModelPreset[] = [
  {
    id: 'mlx-community/VibeVoice-ASR-4bit',
    label: 'VibeVoice-ASR 4bit (約5.7GB・推奨)',
    approxSizeMB: 5700
  },
  {
    id: 'mlx-community/VibeVoice-ASR-bf16',
    label: 'VibeVoice-ASR bf16 (高精度・約16.7GB)',
    approxSizeMB: 16700
  }
]

export function findVibeVoicePreset(id: string): VibeVoiceModelPreset | undefined {
  return VIBEVOICE_MODEL_PRESETS.find(p => p.id === id)
}
