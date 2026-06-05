import React, { useEffect, useState } from 'react'
import type {
  LlmModelPreset,
  LlmModelStatus,
  LlmDownloadProgress,
  Settings
} from '../../../shared/types'
import { useT } from '../i18n'

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
  const t = useT()
  const [presets, setPresets] = useState<LlmModelPreset[]>([])
  const [status, setStatus] = useState<LlmModelStatus | null>(null)
  const [progress, setProgress] = useState<LlmDownloadProgress | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sharedDraft, setSharedDraft] = useState<string>(settings.llm.sharedPrompt ?? '')
  const [composingShared, setComposingShared] = useState(false)
  const [focusedShared, setFocusedShared] = useState(false)

  const refreshStatus = async (modelId: string): Promise<void> => {
    const s = await window.api.llmStatus(modelId)
    setStatus(s)
  }

  useEffect(() => {
    void window.api.llmListPresets().then(setPresets)
  }, [])

  useEffect(() => {
    // 編集中（フォーカス中 or IME変換中）は settings 側の値で上書きしない。
    // フォーカスが外れて確定された後にだけ外部更新を反映する。
    if (!composingShared && !focusedShared) {
      setSharedDraft(settings.llm.sharedPrompt ?? '')
    }
  }, [settings.llm.sharedPrompt, composingShared, focusedShared])

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
        <span>{t('llm.title')}</span>
        <span className="muted small">{t('llm.subtitle')}</span>
      </div>

      <div className="settings-grid">
        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.enabled}
            onChange={e => setLlm({ enabled: e.target.checked })}
          />
          <span>
            {t('llm.enable')}
            <span className="muted small"> {t('llm.enable.hint')}</span>
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
            {t('llm.requirePrompt')}
            <span className="muted small"> {t('llm.requirePrompt.hint')}</span>
          </span>
        </label>

        <label className="full">
          {t('llm.shared')}
          <textarea
            rows={3}
            value={sharedDraft}
            onChange={e => setSharedDraft(e.target.value)}
            onCompositionStart={() => setComposingShared(true)}
            onCompositionEnd={() => setComposingShared(false)}
            onFocus={() => setFocusedShared(true)}
            onBlur={() => {
              setFocusedShared(false)
              if (sharedDraft !== (settings.llm.sharedPrompt ?? '')) {
                setLlm({ sharedPrompt: sharedDraft })
              }
            }}
            placeholder={t('llm.shared.placeholder')}
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
          {t('llm.model')}
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
          {t('llm.batchSize')} <span className="muted small">{t('llm.batchSize.hint')}</span>
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
          {t('llm.contextSize')}
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

        <label>
          {t('llm.batchOverlap')} <span className="muted small">{t('llm.batchOverlap.hint')}</span>
          <input
            type="number"
            min={0}
            max={Math.max(0, settings.llm.batchSize - 1)}
            value={settings.llm.batchOverlap}
            onChange={e => {
              const v = parseInt(e.target.value)
              const safe = Number.isFinite(v) ? Math.max(0, Math.min(v, settings.llm.batchSize - 1)) : 0
              setLlm({ batchOverlap: safe })
            }}
          />
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.allowMerge}
            onChange={e => setLlm({ allowMerge: e.target.checked })}
          />
          <span>
            {t('llm.allowMerge')}
            <span className="muted small"> {t('llm.allowMerge.hint')}</span>
          </span>
        </label>

        <label>
          {t('llm.maxMergeSize')} <span className="muted small">{t('llm.maxMergeSize.hint')}</span>
          <input
            type="number"
            min={2}
            max={10}
            value={settings.llm.maxMergeSize}
            onChange={e => {
              const v = parseInt(e.target.value)
              const safe = Number.isFinite(v) ? Math.max(2, Math.min(v, 10)) : 3
              setLlm({ maxMergeSize: safe })
            }}
            disabled={!settings.llm.allowMerge}
          />
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.llm.useDictionary}
            onChange={e => setLlm({ useDictionary: e.target.checked })}
            disabled={!settings.replaceDictPath}
          />
          <span>
            {t('llm.useDictionary')}
            <span className="muted small">
              {' '}
              {settings.replaceDictPath
                ? t('llm.useDictionary.hint.enabled')
                : t('llm.useDictionary.hint.disabled')}
            </span>
          </span>
        </label>

        <div className="full">
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span className="muted small">
              {currentPreset && t('llm.status.modelPrefix', { label: currentPreset.label })}
            </span>
            <span className="muted small">|</span>
            <span className="muted small">
              {status?.downloaded ? t('llm.status.downloaded') : t('llm.status.notDownloaded')}
            </span>
            {!status?.downloaded && !downloading && (
              <button onClick={() => void startDownload()} disabled={downloading}>
                {t('llm.download')}
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
                  ? t('llm.download.progress', {
                      cur: formatBytes(progress.downloadedBytes),
                      total: formatBytes(progress.totalBytes),
                      pct
                    })
                  : t('llm.download.progress.unknown', {
                      cur: formatBytes(progress?.downloadedBytes ?? 0)
                    })}
              </div>
            </div>
          )}

          {error && <div className="job-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}
