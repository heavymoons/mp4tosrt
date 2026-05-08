import React, { useState } from 'react'
import type { Settings, AudioFilters } from '../../../shared/types'
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
      </div>

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
