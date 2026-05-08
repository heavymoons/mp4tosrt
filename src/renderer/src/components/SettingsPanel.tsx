import React, { useState } from 'react'
import type { Settings, AudioFilters } from '../../../shared/types'
import LlmPanel from './LlmPanel'

const MODEL_PRESETS = [
  'mlx-community/whisper-large-v3-turbo',
  'mlx-community/whisper-large-v3-mlx',
  'mlx-community/whisper-large-v3-mlx-4bit',
  'mlx-community/whisper-medium-mlx',
  'mlx-community/whisper-small-mlx',
  'mlx-community/whisper-tiny-mlx',
  'kaiinui/kotoba-whisper-v2.0-mlx'
]

const LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: '自動検出' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' }
]

const HIGHPASS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'オフ' },
  { value: 80, label: '80 Hz (推奨)' },
  { value: 120, label: '120 Hz' },
  { value: 200, label: '200 Hz (低音減衰)' }
]

type Props = {
  settings: Settings
  onPickOutputDir: () => void
  onChange: (patch: Partial<Settings>) => void
}

export default function SettingsPanel({
  settings, onPickOutputDir, onChange
}: Props): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const setFilter = (patch: Partial<AudioFilters>): void => {
    onChange({ audioFilters: { ...settings.audioFilters, ...patch } })
  }

  const pickDict = async (): Promise<void> => {
    const p = await window.api.openDictFile()
    if (p) onChange({ replaceDictPath: p })
  }

  const clearDict = (): void => {
    onChange({ replaceDictPath: undefined })
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>設定</h2>
        <button className="ghost small" onClick={() => setShowAdvanced(s => !s)}>
          {showAdvanced ? '詳細を閉じる' : '詳細設定…'}
        </button>
      </div>

      <div className="settings-grid">
        <label className="full">
          出力先
          <div className="row">
            <input readOnly value={settings.outputDir || '(未指定 — ファイル追加時に選択)'} />
            <button onClick={onPickOutputDir}>変更…</button>
          </div>
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.embedSubtitles}
            onChange={e => onChange({ embedSubtitles: e.target.checked })}
          />
          <span>
            字幕を埋め込んだ <code>.subbed.mp4</code> も出力
            <span className="muted small"> (再エンコードなし・LLM校正済みがあれば優先使用)</span>
          </span>
        </label>

        <label>
          Whisper モデル
          <select
            value={settings.model}
            onChange={e => onChange({ model: e.target.value })}
          >
            {MODEL_PRESETS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label>
          言語
          <select
            value={settings.language ?? ''}
            onChange={e => onChange({ language: e.target.value || undefined })}
          >
            {LANGUAGES.map(l => (
              <option key={l.code || 'auto'} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          ffmpeg 並列
          <input
            type="number"
            min={1}
            max={16}
            value={settings.ffmpegConcurrency}
            onChange={e =>
              onChange({ ffmpegConcurrency: clamp(parseInt(e.target.value) || 1, 1, 16) })
            }
          />
        </label>

        <label>
          mlx-whisper 並列
          <input
            type="number"
            min={1}
            max={8}
            value={settings.whisperConcurrency}
            onChange={e =>
              onChange({ whisperConcurrency: clamp(parseInt(e.target.value) || 1, 1, 8) })
            }
          />
        </label>
      </div>

      {showAdvanced && (
        <>
          <div className="settings-section">
            <div className="settings-section-head">
              <span>音声フィルタ</span>
              <span className="muted small">素材によって最適解が変わるので保守的にデフォを設定</span>
            </div>
            <div className="settings-grid">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.loudnorm}
                  onChange={e => setFilter({ loudnorm: e.target.checked })}
                />
                <span>ラウドネス正規化 <span className="muted small">(loudnorm)</span></span>
              </label>

              <label>
                ハイパスフィルタ
                <select
                  value={settings.audioFilters.highpassHz}
                  onChange={e => setFilter({ highpassHz: parseInt(e.target.value) || 0 })}
                >
                  {HIGHPASS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.compress}
                  onChange={e => setFilter({ compress: e.target.checked })}
                />
                <span>コンプレッサ <span className="muted small">(音量差大 / インタビュー向け)</span></span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.denoise}
                  onChange={e => setFilter({ denoise: e.target.checked })}
                />
                <span>ノイズ低減 <span className="muted small">(afftdn / 素材次第で逆効果)</span></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <span>Whisper オプション</span>
              <span className="muted small">書き起こしの抜け / 過剰検出のバランス調整</span>
            </div>
            <div className="settings-grid">
              <label className="checkbox full">
                <input
                  type="checkbox"
                  checked={settings.conditionOnPreviousText}
                  onChange={e => onChange({ conditionOnPreviousText: e.target.checked })}
                />
                <span>
                  前文脈を考慮 <span className="muted small">(長尺で文脈ドリフトする時はオフ推奨)</span>
                </span>
              </label>

              <label className="full">
                <span>
                  no-speech-threshold:{' '}
                  <strong className="mono">{settings.noSpeechThreshold.toFixed(2)}</strong>
                  <span className="muted small">
                    {' '}下げるほど抜けは減るがノイズ誤検出が増える (デフォ 0.30)
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.noSpeechThreshold}
                  onChange={e =>
                    onChange({ noSpeechThreshold: parseFloat(e.target.value) })
                  }
                />
              </label>

              <label className="full">
                <span>
                  logprob-threshold:{' '}
                  <strong className="mono">{settings.logprobThreshold.toFixed(2)}</strong>
                  <span className="muted small">
                    {' '}下げるほど低品質decode出力も採用される (デフォ -1.50)
                  </span>
                </span>
                <input
                  type="range"
                  min={-3}
                  max={0}
                  step={0.1}
                  value={settings.logprobThreshold}
                  onChange={e =>
                    onChange({ logprobThreshold: parseFloat(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <span>後処理 — 用語辞書（単純置換）</span>
              <span className="muted small">誤変換 [TAB] 正解 / 1行1ルール</span>
            </div>
            <div className="settings-grid">
              <label className="full">
                用語辞書ファイル
                <div className="row">
                  <input readOnly value={settings.replaceDictPath ?? '(未設定)'} />
                  <button onClick={() => void pickDict()}>選択…</button>
                  {settings.replaceDictPath && (
                    <button className="ghost" onClick={clearDict}>クリア</button>
                  )}
                </div>
              </label>
            </div>
          </div>

          <LlmPanel settings={settings} onChange={onChange} />
        </>
      )}
    </section>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
