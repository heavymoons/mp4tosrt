import React, { useState } from 'react'
import type { ToolStatus, ToolsCheck } from '../../../shared/types'
import { useT } from '../i18n'

const FFMPEG_INSTALL = 'brew install ffmpeg'
const MLX_INSTALL = 'brew install pipx && pipx ensurepath && pipx install mlx-whisper'

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
  tools, onRefresh
}: {
  tools: ToolsCheck
  onRefresh: () => void
}): JSX.Element {
  const t = useT()
  const allFound = tools.ffmpeg.found && tools.mlxWhisper.found
  return (
    <section className="card">
      <div className="card-head">
        <h2>{t('tools.title')} {allFound && <span className="badge ok">OK</span>}</h2>
        <button className="ghost small" onClick={onRefresh}>
          {t('tools.recheck')}
        </button>
      </div>
      <ToolRow name="ffmpeg" status={tools.ffmpeg} install={FFMPEG_INSTALL} />
      <ToolRow
        name="mlx_whisper"
        status={tools.mlxWhisper}
        install={MLX_INSTALL}
        hint={t('tools.mlxHint')}
      />
    </section>
  )
}
