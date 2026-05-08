import React, { useEffect, useState } from 'react'
import type {
  LlmModelPreset,
  LlmModelStatus,
  LlmDownloadProgress,
  Settings
} from '../../../shared/types'

type Props = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

export default function LlmPanel({ settings, onChange }: Props): JSX.Element {
  const [presets, setPresets] = useState<LlmModelPreset[]>([])
  const [status, setStatus] = useState<LlmModelStatus | null>(null)
  const [progress, setProgress] = useState<LlmDownloadProgress | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = async (modelId: string): Promise<void> => {
    const s = await window.api.llmStatus(modelId)
    setStatus(s)
  }

  useEffect(() => {
    void window.api.llmListPresets().then(setPresets)
  }, [])

  useEffect(() => {
    void refreshStatus(settings.llm.modelId)
  }, [settings.llm.modelId])

  useEffect(() => {
    const off = window.api.onLlmDownloadProgress(p => {
      setProgress(p)
      if (p.finished) {
        setDownloading(false)
        if (p.error) setError(p.error)
        else void refreshStatus(p.modelId)
      }
    })
    return off
  }, [])

  const setLlm = (patch: Partial<Settings['llm']>): void => {
    onChange({ llm: { ...settings.llm, ...patch } })
  }

  const startDownload = async (): Promise<void> => {
    setError(null)
    setProgress(null)
    setDownloading(true)
    try {
      await window.api.llmDownload(settings.llm.modelId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDownloading(false)
    }
  }

  const currentPreset = presets.find(p => p.id === settings.llm.modelId)
  const pct =
    progress && progress.totalBytes
      ? Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100))
      : 0

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <span>後処理 — LLM 校正（ローカル）</span>
        <span className="muted small">
          書き起こし結果を Qwen 等で日本語として整える。校正済みは <code>.corrected.srt</code> に保存
        </span>
      </div>

      <div className="settings-grid">
        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.enabled}
            onChange={e => setLlm({ enabled: e.target.checked })}
          />
          <span>
            LLM 校正を有効化
            <span className="muted small"> (モデル未ダウンロード時は最初の校正時に取得)</span>
          </span>
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.requirePrompt}
            onChange={e => setLlm({ requirePrompt: e.target.checked })}
            disabled={!settings.llm.enabled}
          />
          <span>
            ジョブごとの追加プロンプトを必須にする
            <span className="muted small"> (オフの場合、空でも自動で校正実行)</span>
          </span>
        </label>

        <label className="full">
          共通プロンプト（全ジョブ共通で LLM に渡される / 任意）
          <textarea
            rows={3}
            value={settings.llm.sharedPrompt ?? ''}
            onChange={e => setLlm({ sharedPrompt: e.target.value })}
            placeholder="例: 自分のYouTubeチャンネル「heavymoons」の動画です。日本語の固有名詞や軍事/政治用語が頻出します。"
            disabled={!settings.llm.enabled}
            style={{
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: settings.llm.enabled ? 'var(--bg)' : 'var(--card)',
              color: 'var(--fg)',
              resize: 'vertical'
            }}
          />
        </label>

        <label className="full">
          モデル
          <select
            value={settings.llm.modelId}
            onChange={e => setLlm({ modelId: e.target.value })}
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          バッチサイズ <span className="muted small">(1回のリクエストで送るキュー数)</span>
          <input
            type="number"
            min={5}
            max={100}
            value={settings.llm.batchSize}
            onChange={e =>
              setLlm({ batchSize: Math.max(1, parseInt(e.target.value) || 30) })
            }
          />
        </label>

        <label>
          コンテキストサイズ
          <select
            value={settings.llm.contextSize}
            onChange={e => setLlm({ contextSize: parseInt(e.target.value) || 4096 })}
          >
            <option value={2048}>2048</option>
            <option value={4096}>4096</option>
            <option value={8192}>8192</option>
            <option value={16384}>16384</option>
          </select>
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.useDictionary}
            onChange={e => setLlm({ useDictionary: e.target.checked })}
            disabled={!settings.replaceDictPath}
          />
          <span>
            用語辞書をプロンプトに渡す
            <span className="muted small">
              {settings.replaceDictPath
                ? ' (固有名詞を文脈つきで修正できる)'
                : ' (上の「用語辞書ファイル」を設定すると有効化)'}
            </span>
          </span>
        </label>

        <div className="full">
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span className="muted small">
              {currentPreset && `モデル: ${currentPreset.label}`}
            </span>
            <span className="muted small">|</span>
            <span className="muted small">
              {status?.downloaded ? '✓ ダウンロード済み' : '未ダウンロード'}
            </span>
            {!status?.downloaded && !downloading && (
              <button onClick={() => void startDownload()} disabled={downloading}>
                ダウンロード
              </button>
            )}
          </div>

          {downloading && (
            <div style={{ marginTop: 8 }}>
              <div className="job-progress">
                <div className="bar" style={{ width: `${pct}%` }} />
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {progress?.totalBytes
                  ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)} (${pct}%)`
                  : `${formatBytes(progress?.downloadedBytes ?? 0)} ダウンロード中…`}
              </div>
            </div>
          )}

          {error && <div className="job-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}
