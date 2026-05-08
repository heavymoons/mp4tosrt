import React, { useEffect, useState } from 'react'
import { useT } from '../i18n'
import type { LocaleKey } from '../i18n/strings'

let mediaPortCache: number | null = null
async function getMediaPort(): Promise<number> {
  if (mediaPortCache !== null) return mediaPortCache
  mediaPortCache = await window.api.mediaServerPort()
  return mediaPortCache
}
import type { Job } from '../../../shared/types'

const STATUS_LABEL_KEY: Record<Job['status'], LocaleKey> = {
  queued: 'job.status.queued',
  converting: 'job.status.converting',
  transcribing: 'job.status.transcribing',
  awaiting: 'job.status.awaiting',
  done: 'job.status.done',
  error: 'job.status.error',
  cancelled: 'job.status.cancelled'
}

const PHASE_LABEL_KEY: Partial<Record<Job['phase'], LocaleKey>> = {
  postprocess: 'job.phase.postprocess',
  'awaiting-prompt': 'job.phase.awaiting-prompt',
  'llm-correct': 'job.phase.llm-correct',
  embed: 'job.phase.embed',
  fcpxml: 'job.phase.fcpxml'
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

function useElapsed(): (job: Job) => string | null {
  const t = useT()
  return job => {
    if (!job.startedAt) return null
    const end = job.finishedAt ?? Date.now()
    const ms = end - job.startedAt
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0
      ? t('job.elapsed.ms', { minutes: m, seconds: r })
      : t('job.elapsed.s', { seconds: s })
  }
}

function JobItem({
  job, onCancel, onRemove, onReveal
}: {
  job: Job
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onReveal: (path: string) => void
}): JSX.Element {
  const t = useT()
  const elapsed = useElapsed()
  const isAwaiting = job.status === 'awaiting'
  const [showLog, setShowLog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!showPreview) return
    void getMediaPort().then(port => {
      if (port > 0) {
        setPreviewUrl(`http://127.0.0.1:${port}/job/${encodeURIComponent(job.id)}`)
      }
    })
  }, [showPreview, job.id])
  const [showPrompt, setShowPrompt] = useState<boolean>(Boolean(job.extraPrompt) || isAwaiting)
  const [promptDraft, setPromptDraft] = useState<string>(job.extraPrompt ?? '')
  const [composingPrompt, setComposingPrompt] = useState(false)
  const [focusedPrompt, setFocusedPrompt] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [embedding, setEmbedding] = useState(false)
  const [rerunError, setRerunError] = useState<string | null>(null)

  useEffect(() => {
    // 編集中は外部の job.extraPrompt の更新で上書きしない
    if (!composingPrompt && !focusedPrompt) {
      setPromptDraft(job.extraPrompt ?? '')
    }
  }, [job.extraPrompt, composingPrompt, focusedPrompt])

  useEffect(() => {
    if (isAwaiting) setShowPrompt(true)
  }, [isAwaiting])

  const inProgress = job.status === 'converting' || job.status === 'transcribing'
  const canRerun =
    job.status === 'done' ||
    job.status === 'error' ||
    job.status === 'cancelled' ||
    job.status === 'awaiting'
  const hasBaseSrt = Boolean(job.outputPath)
  const elapsedText = elapsed(job)
  const phaseKey = PHASE_LABEL_KEY[job.phase]
  const phaseOrStatus = phaseKey ? t(phaseKey) : t(STATUS_LABEL_KEY[job.status])

  const savePrompt = (): void => {
    if (promptDraft !== (job.extraPrompt ?? '')) {
      void window.api.setJobExtraPrompt(job.id, promptDraft)
    }
  }

  const rerunEmbed = async (): Promise<void> => {
    if (embedding) return
    setRerunError(null)
    if (typeof window.api.rerunJobEmbed !== 'function') {
      setRerunError(t('job.error.preload.embed'))
      return
    }
    setEmbedding(true)
    try {
      await window.api.rerunJobEmbed(job.id)
    } catch (e) {
      setRerunError(e instanceof Error ? e.message : String(e))
    } finally {
      setEmbedding(false)
    }
  }

  const rerun = async (): Promise<void> => {
    if (rerunning) return
    setRerunError(null)
    if (typeof window.api.rerunJobFromLlm !== 'function') {
      setRerunError(t('job.error.preload.rerun'))
      return
    }
    if (promptDraft !== (job.extraPrompt ?? '')) {
      try {
        await window.api.setJobExtraPrompt(job.id, promptDraft)
      } catch (e) {
        setRerunError(
          t('job.error.savePromptFailed', {
            error: e instanceof Error ? e.message : String(e)
          })
        )
        return
      }
    }
    setRerunning(true)
    try {
      await window.api.rerunJobFromLlm(job.id)
    } catch (e) {
      setRerunError(e instanceof Error ? e.message : String(e))
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div className="job" data-status={job.status}>
      <div className="job-head">
        <div className="job-title">
          <span className="job-name" title={job.inputPath}>
            {basename(job.inputPath)}
          </span>
          <span className="job-status">{phaseOrStatus}</span>
          {elapsedText && <span className="muted small">{elapsedText}</span>}
        </div>
        <div className="job-actions">
          <button
            className="ghost small"
            onClick={() => {
              setShowPreview(s => !s)
              setPreviewError(null)
            }}
            title={t('job.preview.title')}
          >
            {showPreview ? t('job.preview.hide') : t('job.preview.show')}
          </button>
          <button
            className="ghost small"
            onClick={() => onReveal(job.inputPath)}
            title={t('job.reveal.video.title')}
          >
            {t('job.reveal.video')}
          </button>
          {job.outputPath && (
            <button className="ghost small" onClick={() => onReveal(job.outputPath!)}>
              {t('job.reveal.srt')}
            </button>
          )}
          {hasBaseSrt && (canRerun || embedding) && (
            <button
              className="ghost small"
              onClick={() => void rerunEmbed()}
              disabled={embedding || !canRerun}
              title={t('job.embed.title')}
            >
              {embedding ? t('job.embed.busy') : t('job.embed.button')}
            </button>
          )}
          <button className="ghost small" onClick={() => setShowPrompt(s => !s)}>
            {job.extraPrompt ? t('job.prompt.toggle.edit') : t('job.prompt.toggle.add')}
          </button>
          <button className="ghost small" onClick={() => setShowLog(s => !s)}>
            {showLog ? t('job.log.hide') : t('job.log.show')}
          </button>
          <button
            className="ghost small"
            onClick={() => void window.api.openJobLog(job.id)}
            title={t('job.log.full.title')}
          >
            {t('job.log.full')}
          </button>
          {inProgress ? (
            <button className="ghost small" onClick={() => onCancel(job.id)}>
              {t('job.cancel')}
            </button>
          ) : (
            <button className="ghost small" onClick={() => onRemove(job.id)}>
              {t('job.remove')}
            </button>
          )}
        </div>
      </div>
      <div className="job-progress">
        <div className="bar" style={{ width: `${job.progress}%` }} />
      </div>
      {showPreview && previewUrl && (
        <div className="job-preview-wrap">
          <video
            className="job-preview-video"
            controls
            preload="metadata"
            src={previewUrl}
            onError={e => {
              const err = (e.currentTarget as HTMLVideoElement).error
              const code = err?.code
              const msg = err?.message
              const codeName = ({
                1: 'MEDIA_ERR_ABORTED',
                2: 'MEDIA_ERR_NETWORK',
                3: 'MEDIA_ERR_DECODE',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
              } as Record<number, string>)[code ?? 0] ?? 'unknown'
              setPreviewError(
                t('job.preview.error', { code: codeName, msg: msg ?? 'no details' })
              )
            }}
          />
          {previewError && <pre className="job-error">{previewError}</pre>}
        </div>
      )}
      {job.error && <div className="job-error">{job.error}</div>}
      {showPrompt && (
        <div className="job-prompt">
          <textarea
            rows={2}
            value={promptDraft}
            onChange={e => setPromptDraft(e.target.value)}
            onCompositionStart={() => setComposingPrompt(true)}
            onCompositionEnd={() => setComposingPrompt(false)}
            onFocus={() => setFocusedPrompt(true)}
            onBlur={() => {
              setFocusedPrompt(false)
              savePrompt()
            }}
            placeholder={t('job.prompt.placeholder')}
          />
          <div className="job-prompt-actions">
            <span className="muted small">{t('job.prompt.hint')}</span>
            {hasBaseSrt && (canRerun || rerunning) && (
              <button
                className="ghost small"
                onClick={() => void rerun()}
                disabled={rerunning || !canRerun || (isAwaiting && !promptDraft.trim())}
                title={isAwaiting && !promptDraft.trim() ? t('job.prompt.startTitle') : undefined}
              >
                {rerunning
                  ? t('job.prompt.running')
                  : isAwaiting
                    ? t('job.prompt.startCorrection')
                    : t('job.prompt.rerunCorrection')}
              </button>
            )}
          </div>
          {rerunError && <div className="job-error">{rerunError}</div>}
        </div>
      )}
      {showLog && <pre className="job-log">{job.log.slice(-2000).join('\n')}</pre>}
    </div>
  )
}

type Props = {
  jobs: Job[]
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onReveal: (path: string) => void
  onClearFinished: () => void
}

export default function JobList({
  jobs, onCancel, onRemove, onReveal, onClearFinished
}: Props): JSX.Element {
  const t = useT()
  const finished = jobs.filter(
    j => j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
  )
  return (
    <section className="card jobs-card">
      <div className="card-head">
        <h2>{t('jobs.title')} {jobs.length > 0 && <span className="muted">({jobs.length})</span>}</h2>
        {finished.length > 0 && (
          <button className="ghost small" onClick={onClearFinished}>
            {t('jobs.clearFinished')}
          </button>
        )}
      </div>
      {jobs.length === 0 && (
        <div className="empty">{t('jobs.empty')}</div>
      )}
      {jobs.map(j => (
        <JobItem
          key={j.id}
          job={j}
          onCancel={onCancel}
          onRemove={onRemove}
          onReveal={onReveal}
        />
      ))}
    </section>
  )
}
