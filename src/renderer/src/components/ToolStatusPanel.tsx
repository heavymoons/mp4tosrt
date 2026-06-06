import React, { useState } from 'react'
import type { ToolStatus, ToolsCheck, TranscribeEngine } from '../../../shared/types'
import { useT } from '../i18n'

const FFMPEG_INSTALL = 'brew install ffmpeg'
const MLX_INSTALL = 'brew install pipx && pipx ensurepath && pipx install mlx-whisper'
const VIBEVOICE_INSTALL = 'brew install pipx && pipx ensurepath && pipx install mlx-audio'

function CopyButton({ value }: { value: string }): JSX.Element {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <button className="ghost small" onClick={onClick}>
      {copied ? t('tools.copied') : t('tools.copy')}
    </button>
  )
}

function ToolRow({
  name, status, install, hint
}: {
  name: string
  status: ToolStatus
  install: string
  hint?: string
}): JSX.Element {
  const t = useT()
  return (
    <div className="tool-row" data-found={status.found}>
      <div className="tool-name">{name}</div>
      <div className="tool-state">
        {status.found ? (
          <>
            <span className="dot ok" />
            {t('tools.installed')}
            {status.version && status.version !== 'installed' && (
              <span className="muted">{status.version}</span>
            )}
            {status.path && <span className="muted mono">{status.path}</span>}
          </>
        ) : (
          <>
            <span className="dot bad" />
            {t('tools.notInstalled')}
          </>
        )}
      </div>
      {!status.found && (
        <div className="tool-install">
          <code>{install}</code>
          <CopyButton value={install} />
        </div>
      )}
      {!status.found && hint && <div className="tool-hint muted">{hint}</div>}
    </div>
  )
}

export default function ToolStatusPanel({
  tools, engine, onRefresh
}: {
  tools: ToolsCheck
  engine: TranscribeEngine
  onRefresh: () => void
}): JSX.Element {
  const t = useT()
  const engineStatus =
    engine === 'vibevoice-asr' ? tools.vibevoiceAsr : tools.mlxWhisper
  const allFound = tools.ffmpeg.found && engineStatus.found
  return (
    <section className="card">
      <div className="card-head">
        <h2>{t('tools.title')} {allFound && <span className="badge ok">OK</span>}</h2>
        <button className="ghost small" onClick={onRefresh}>
          {t('tools.recheck')}
        </button>
      </div>
      <ToolRow name="ffmpeg" status={tools.ffmpeg} install={FFMPEG_INSTALL} />
      {engine === 'vibevoice-asr' ? (
        <ToolRow
          name="mlx_audio (VibeVoice-ASR)"
          status={tools.vibevoiceAsr}
          install={VIBEVOICE_INSTALL}
          hint={t('tools.vibevoiceHint')}
        />
      ) : (
        <ToolRow
          name="mlx_whisper"
          status={tools.mlxWhisper}
          install={MLX_INSTALL}
          hint={t('tools.mlxHint')}
        />
      )}
    </section>
  )
}
