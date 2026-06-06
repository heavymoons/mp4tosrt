import React, { useEffect, useState } from 'react'
import type {
  Settings,
  AudioFilters,
  FcpxmlSubtitleStyle,
  TranscribeEngine,
  VibeVoiceModelStatus,
  LlmDownloadProgress
} from '../../../shared/types'
import {
  VIBEVOICE_MODEL_PRESETS,
  findVibeVoicePreset
} from '../../../shared/vibevoiceModels'
import LlmPanel from './LlmPanel'
import FileEditor from './FileEditor'
import { useT } from '../i18n'
import type { LocaleKey } from '../i18n/strings'

const MODEL_PRESETS = [
  'mlx-community/whisper-large-v3-turbo',
  'mlx-community/whisper-large-v3-mlx',
  'mlx-community/whisper-large-v3-mlx-4bit',
  'mlx-community/whisper-medium-mlx',
  'mlx-community/whisper-small-mlx',
  'mlx-community/whisper-tiny-mlx',
  'kaiinui/kotoba-whisper-v2.0-mlx'
]

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

function VibeVoiceModelPanel({ modelId }: { modelId: string }): JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<VibeVoiceModelStatus | null>(null)
  const [progress, setProgress] = useState<LlmDownloadProgress | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = async (id: string): Promise<void> => {
    const s = await window.api.vibevoiceStatus(id)
    setStatus(s)
  }

  useEffect(() => {
    setProgress(null)
    setError(null)
    void refreshStatus(modelId)
  }, [modelId])

  useEffect(() => {
    const off = window.api.onVibevoiceDownloadProgress(p => {
      if (p.modelId !== modelId) return
      setProgress(p)
      if (p.finished) {
        setDownloading(false)
        if (p.error) setError(p.error)
        else void refreshStatus(p.modelId)
      }
    })
    return off
  }, [modelId])

  const startDownload = async (): Promise<void> => {
    setError(null)
    setProgress(null)
    setDownloading(true)
    try {
      await window.api.vibevoiceDownload(modelId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDownloading(false)
    }
  }

  const preset = findVibeVoicePreset(modelId)
  const sizeGb = preset ? (preset.approxSizeMB / 1024).toFixed(1) : '?'
  const pct =
    progress && progress.totalBytes
      ? Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100))
      : 0

  return (
    <div className="full">
      <p className="muted small">{t('settings.vibevoice.download.intro', { size: sizeGb })}</p>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <span className="muted small">
          {status?.downloaded
            ? t('settings.vibevoice.status.downloaded')
            : t('settings.vibevoice.status.notDownloaded')}
        </span>
        {status && !status.downloaded && !downloading && (
          <button onClick={() => void startDownload()} disabled={downloading}>
            {t('settings.vibevoice.download')}
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
              ? t('settings.vibevoice.download.progress', {
                  cur: formatBytes(progress.downloadedBytes),
                  total: formatBytes(progress.totalBytes),
                  pct
                })
              : t('settings.vibevoice.download.progress.unknown', {
                  cur: formatBytes(progress?.downloadedBytes ?? 0)
                })}
          </div>
        </div>
      )}

      {error && <div className="job-error">{error}</div>}
    </div>
  )
}

const LANGUAGES: { code: string; labelKey: LocaleKey }[] = [
  { code: '', labelKey: 'settings.language.auto' },
  { code: 'ja', labelKey: 'settings.language.ja' },
  { code: 'en', labelKey: 'settings.language.en' },
  { code: 'zh', labelKey: 'settings.language.zh' },
  { code: 'ko', labelKey: 'settings.language.ko' },
  { code: 'es', labelKey: 'settings.language.es' },
  { code: 'fr', labelKey: 'settings.language.fr' },
  { code: 'de', labelKey: 'settings.language.de' }
]

const HIGHPASS_OPTIONS: { value: number; labelKey: LocaleKey }[] = [
  { value: 0, labelKey: 'settings.audio.highpass.off' },
  { value: 80, labelKey: 'settings.audio.highpass.80' },
  { value: 120, labelKey: 'settings.audio.highpass.120' },
  { value: 200, labelKey: 'settings.audio.highpass.200' }
]

type Props = {
  settings: Settings
  onPickOutputDir: () => void
  onChange: (patch: Partial<Settings>) => void
}

export default function SettingsPanel({
  settings, onPickOutputDir, onChange
}: Props): JSX.Element {
  const t = useT()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const setFilter = (patch: Partial<AudioFilters>): void => {
    onChange({ audioFilters: { ...settings.audioFilters, ...patch } })
  }

  const setFcpxmlStyle = (patch: Partial<FcpxmlSubtitleStyle>): void => {
    onChange({ fcpxmlSubtitle: { ...settings.fcpxmlSubtitle, ...patch } })
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>{t('settings.title')}</h2>
        <button className="ghost small" onClick={() => setShowAdvanced(s => !s)}>
          {showAdvanced ? t('settings.advanced.hide') : t('settings.advanced.show')}
        </button>
      </div>

      <div className="settings-grid">
        <label className="full">
          {t('settings.outputDir')}
          <div className="row">
            <input readOnly value={settings.outputDir || t('settings.outputDir.empty')} />
            <button onClick={onPickOutputDir}>{t('settings.outputDir.change')}</button>
          </div>
        </label>

        <label>
          {t('settings.engine')}
          <select
            value={settings.engine}
            onChange={e => onChange({ engine: e.target.value as TranscribeEngine })}
          >
            <option value="mlx-whisper">{t('settings.engine.mlxWhisper')}</option>
            <option value="vibevoice-asr">{t('settings.engine.vibevoice')}</option>
          </select>
        </label>

        {settings.engine === 'mlx-whisper' && (
          <>
            <label>
              {t('settings.model')}
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
              {t('settings.language')}
              <select
                value={settings.language ?? ''}
                onChange={e => onChange({ language: e.target.value || undefined })}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code || 'auto'} value={l.code}>
                    {t(l.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {settings.engine === 'vibevoice-asr' && (
          <>
            <label>
              {t('settings.vibevoice.model')}
              <select
                value={settings.vibevoiceModel}
                onChange={e => onChange({ vibevoiceModel: e.target.value })}
              >
                {VIBEVOICE_MODEL_PRESETS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            <VibeVoiceModelPanel modelId={settings.vibevoiceModel} />

            <label className="checkbox full">
              <input
                type="checkbox"
                checked={settings.vibevoiceSpeakerLabels}
                onChange={e => onChange({ vibevoiceSpeakerLabels: e.target.checked })}
              />
              <span>
                {t('settings.vibevoice.speakerLabels')}
                <span className="muted small">{' '}{t('settings.vibevoice.speakerLabels.hint')}</span>
              </span>
            </label>

            <p className="muted small full">{t('settings.vibevoice.note')}</p>
          </>
        )}

        <label>
          {t('settings.ffmpegConcurrency')}
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
          {t('settings.whisperConcurrency')}
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

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.embedSubtitles}
            onChange={e => onChange({ embedSubtitles: e.target.checked })}
          />
          <span>
            {t('settings.embedSubtitles.main')}
            <span className="muted small"> {t('settings.embedSubtitles.hint')}</span>
          </span>
        </label>

        <label className="checkbox full">
          <input
            type="checkbox"
            checked={settings.outputFcpxml}
            onChange={e => onChange({ outputFcpxml: e.target.checked })}
          />
          <span>
            {t('settings.outputFcpxml.main')}
            <span className="muted small"> {t('settings.outputFcpxml.hint')}</span>
          </span>
        </label>
      </div>

      {settings.outputFcpxml && (
        <div className="settings-section">
          <div className="settings-section-head">
            <span>{t('settings.fcpxml.section')}</span>
            <span className="muted small">{t('settings.fcpxml.section.hint')}</span>
          </div>
          <div className="settings-grid">
            <label className="full">
              {t('settings.fcpxml.mode')}
              <select
                value={settings.fcpxmlSubtitle.mode}
                onChange={e =>
                  setFcpxmlStyle({ mode: e.target.value as FcpxmlSubtitleStyle['mode'] })
                }
              >
                <option value="title">{t('settings.fcpxml.mode.title')}</option>
                <option value="caption">{t('settings.fcpxml.mode.caption')}</option>
              </select>
              <span className="muted small">
                {settings.fcpxmlSubtitle.mode === 'title'
                  ? t('settings.fcpxml.mode.titleHint')
                  : t('settings.fcpxml.mode.captionHint')}
              </span>
            </label>

            {settings.fcpxmlSubtitle.mode === 'title' && (
              <>
                <label>
                  {t('settings.fcpxml.alignment')}
                  <select
                    value={settings.fcpxmlSubtitle.alignment}
                    onChange={e =>
                      setFcpxmlStyle({
                        alignment: e.target.value as FcpxmlSubtitleStyle['alignment']
                      })
                    }
                  >
                    <option value="left">{t('settings.fcpxml.align.left')}</option>
                    <option value="center">{t('settings.fcpxml.align.center')}</option>
                    <option value="right">{t('settings.fcpxml.align.right')}</option>
                  </select>
                </label>

                <label>
                  {t('settings.fcpxml.verticalAnchor')}
                  <select
                    value={settings.fcpxmlSubtitle.verticalAnchor}
                    onChange={e =>
                      setFcpxmlStyle({
                        verticalAnchor: e.target.value as FcpxmlSubtitleStyle['verticalAnchor']
                      })
                    }
                  >
                    <option value="top">{t('settings.fcpxml.vertical.top')}</option>
                    <option value="middle">{t('settings.fcpxml.vertical.middle')}</option>
                    <option value="bottom">{t('settings.fcpxml.vertical.bottom')}</option>
                  </select>
                </label>

                <label>
                  {t('settings.fcpxml.font')}
                  <input
                    type="text"
                    value={settings.fcpxmlSubtitle.font}
                    onChange={e => setFcpxmlStyle({ font: e.target.value })}
                    placeholder="Helvetica"
                  />
                </label>

                <label>
                  {t('settings.fcpxml.fontSize')}
                  <input
                    type="number"
                    min={8}
                    max={300}
                    value={settings.fcpxmlSubtitle.fontSize}
                    onChange={e =>
                      setFcpxmlStyle({
                        fontSize: clamp(parseInt(e.target.value) || 60, 8, 300)
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {showAdvanced && (
        <>
          <div className="settings-section">
            <div className="settings-section-head">
              <span>{t('settings.audio.title')}</span>
              <span className="muted small">{t('settings.audio.subtitle')}</span>
            </div>
            <div className="settings-grid">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.loudnorm}
                  onChange={e => setFilter({ loudnorm: e.target.checked })}
                />
                <span>{t('settings.audio.loudnorm')} <span className="muted small">{t('settings.audio.loudnorm.hint')}</span></span>
              </label>

              <label>
                {t('settings.audio.highpass')}
                <select
                  value={settings.audioFilters.highpassHz}
                  onChange={e => setFilter({ highpassHz: parseInt(e.target.value) || 0 })}
                >
                  {HIGHPASS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.compress}
                  onChange={e => setFilter({ compress: e.target.checked })}
                />
                <span>{t('settings.audio.compress')} <span className="muted small">{t('settings.audio.compress.hint')}</span></span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.audioFilters.denoise}
                  onChange={e => setFilter({ denoise: e.target.checked })}
                />
                <span>{t('settings.audio.denoise')} <span className="muted small">{t('settings.audio.denoise.hint')}</span></span>
              </label>
            </div>
          </div>

          {settings.engine === 'mlx-whisper' && (
          <div className="settings-section">
            <div className="settings-section-head">
              <span>{t('settings.whisper.title')}</span>
              <span className="muted small">{t('settings.whisper.subtitle')}</span>
            </div>
            <div className="settings-grid">
              <label className="checkbox full">
                <input
                  type="checkbox"
                  checked={settings.conditionOnPreviousText}
                  onChange={e => onChange({ conditionOnPreviousText: e.target.checked })}
                />
                <span>
                  {t('settings.whisper.condition')}
                  <span className="muted small">{' '}{t('settings.whisper.condition.hint')}</span>
                </span>
              </label>

              <label className="checkbox full">
                <input
                  type="checkbox"
                  checked={settings.wordTimestamps}
                  onChange={e => onChange({ wordTimestamps: e.target.checked })}
                />
                <span>
                  {t('settings.whisper.wordTimestamps')}
                  <span className="muted small">{' '}{t('settings.whisper.wordTimestamps.hint')}</span>
                </span>
              </label>

              <label className="full">
                <span>
                  {t('settings.whisper.noSpeech.label')}{' '}
                  <strong className="mono">{settings.noSpeechThreshold.toFixed(2)}</strong>
                  <span className="muted small">{' '}{t('settings.whisper.noSpeech.hint')}</span>
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
                  {t('settings.whisper.logprob.label')}{' '}
                  <strong className="mono">{settings.logprobThreshold.toFixed(2)}</strong>
                  <span className="muted small">{' '}{t('settings.whisper.logprob.hint')}</span>
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
          )}

          <div className="settings-section">
            <div className="settings-section-head">
              <span>{t('settings.postproc.suppress.title')}</span>
              <span className="muted small">{t('settings.postproc.suppress.subtitle')}</span>
            </div>
            <div className="settings-grid">
              <label className="checkbox full">
                <input
                  type="checkbox"
                  checked={settings.suppressHallucinations}
                  onChange={e => onChange({ suppressHallucinations: e.target.checked })}
                />
                <span>
                  {t('settings.postproc.suppress.enable')}
                  <span className="muted small">{' '}{t('settings.postproc.suppress.enable.hint')}</span>
                </span>
              </label>
            </div>
            {settings.hallucinationsListPath && (
              <FileEditor
                label={t('settings.postproc.suppress.fileLabel')}
                kind="hallucinations"
                path={settings.hallucinationsListPath}
                onPathChange={p => onChange({ hallucinationsListPath: p })}
                pickFile={() => window.api.openHallucinationsFile()}
                enabled={settings.suppressHallucinations}
              />
            )}
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <span>{t('settings.postproc.dict.title')}</span>
              <span className="muted small">{t('settings.postproc.dict.subtitle')}</span>
            </div>
            {settings.replaceDictPath && (
              <FileEditor
                label={t('settings.postproc.dict.fileLabel')}
                kind="dict"
                path={settings.replaceDictPath}
                onPathChange={p => onChange({ replaceDictPath: p })}
                pickFile={() => window.api.openDictFile()}
              />
            )}
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
