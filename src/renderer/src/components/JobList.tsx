import React, { useEffect, useState } from 'react'

let mediaPortCache: number | null = null
async function getMediaPort(): Promise<number> {
  if (mediaPortCache !== null) return mediaPortCache
  mediaPortCache = await window.api.mediaServerPort()
  return mediaPortCache
}
import type { Job } from '../../../shared/types'

const STATUS_LABEL: Record<Job['status'], string> = {
  queued: '待機',
  converting: '音声変換中',
  transcribing: '文字起こし中',
  awaiting: 'プロンプト入力待ち',
  done: '完了',
  error: 'エラー',
  cancelled: '中止'
}

const PHASE_LABEL: Partial<Record<Job['phase'], string>> = {
  postprocess: '後処理',
  'awaiting-prompt': 'プロンプト入力待ち',
  'llm-correct': 'LLM校正中',
  embed: '字幕埋め込み中'
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

function elapsed(job: Job): string | null {
  if (!job.startedAt) return null
  const end = job.finishedAt ?? Date.now()
  const ms = end - job.startedAt
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}分${r}秒` : `${s}秒`
}

function JobItem({
  job, onCancel, onRemove, onReveal
}: {
  job: Job
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onReveal: (path: string) => void
}): JSX.Element {
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
  const t = elapsed(job)

  const savePrompt = (): void => {
    if (promptDraft !== (job.extraPrompt ?? '')) {
      void window.api.setJobExtraPrompt(job.id, promptDraft)
    }
  }

  const rerunEmbed = async (): Promise<void> => {
    if (embedding) return
    setRerunError(null)
    if (typeof window.api.rerunJobEmbed !== 'function') {
      setRerunError(
        'window.api.rerunJobEmbed が見つかりません。preload が古いため、アプリを再起動してください。'
      )
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
      setRerunError(
        'window.api.rerunJobFromLlm が見つかりません。preload が古いため、アプリを再起動してください (npm run dev を Ctrl+C → 再実行)。'
      )
      return
    }
    if (promptDraft !== (job.extraPrompt ?? '')) {
      try {
        await window.api.setJobExtraPrompt(job.id, promptDraft)
      } catch (e) {
        setRerunError(`extraPrompt 保存失敗: ${e instanceof Error ? e.message : String(e)}`)
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
          <span className="job-status">
            {PHASE_LABEL[job.phase] ?? STATUS_LABEL[job.status]}
          </span>
          {t && <span className="muted small">{t}</span>}
        </div>
        <div className="job-actions">
          <button
            className="ghost small"
            onClick={() => {
              setShowPreview(s => !s)
              setPreviewError(null)
            }}
            title="動画をインラインプレビュー"
          >
            {showPreview ? '▾ プレビュー' : '▸ プレビュー'}
          </button>
          <button
            className="ghost small"
            onClick={() => onReveal(job.inputPath)}
            title="元動画を Finder で表示（QuickTime 等で開ける）"
          >
            元動画を表示
          </button>
          {job.outputPath && (
            <button className="ghost small" onClick={() => onReveal(job.outputPath!)}>
              SRT を表示
            </button>
          )}
          {hasBaseSrt && (canRerun || embedding) && (
            <button
              className="ghost small"
              onClick={() => void rerunEmbed()}
              disabled={embedding || !canRerun}
              title={
                '.corrected.srt（無ければ .srt）を外部エディタで手直ししてからこのボタンを押すと、\n' +
                'その内容を反映した .subbed.mp4 を再生成します。\n' +
                '元動画・元 SRT は触りません。'
              }
            >
              {embedding ? 'MP4 出力中…' : 'MP4 へ字幕埋め込み'}
            </button>
          )}
          <button className="ghost small" onClick={() => setShowPrompt(s => !s)}>
            {job.extraPrompt ? '✎ 追加プロンプト' : '+ 追加プロンプト'}
          </button>
          <button className="ghost small" onClick={() => setShowLog(s => !s)}>
            {showLog ? 'ログを閉じる' : 'ログ'}
          </button>
          {inProgress ? (
            <button className="ghost small" onClick={() => onCancel(job.id)}>
              中止
            </button>
          ) : (
            <button className="ghost small" onClick={() => onRemove(job.id)}>
              削除
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
                `動画の読み込みに失敗しました (${codeName}): ${msg ?? 'no details'}\n` +
                  '「元動画を表示」ボタンから外部プレイヤーで再生できます。'
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
            placeholder="例: 〇〇による政治系ライブの書き起こし。日本の政治家・地名が頻出。フォーマルな文体で校正"
          />
          <div className="job-prompt-actions">
            <span className="muted small">
              LLM 校正時のシステムプロンプトに付加される
            </span>
            {hasBaseSrt && (canRerun || rerunning) && (
              <button
                className="ghost small"
                onClick={() => void rerun()}
                disabled={rerunning || !canRerun || (isAwaiting && !promptDraft.trim())}
                title={isAwaiting && !promptDraft.trim() ? '追加プロンプトを入力してください' : undefined}
              >
                {rerunning
                  ? '実行中…'
                  : isAwaiting
                    ? 'LLM校正を開始'
                    : 'LLM校正からやり直す'}
              </button>
            )}
          </div>
          {rerunError && <div className="job-error">{rerunError}</div>}
        </div>
      )}
      {showLog && <pre className="job-log">{job.log.slice(-200).join('\n')}</pre>}
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
  const finished = jobs.filter(
    j => j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
  )
  return (
    <section className="card jobs-card">
      <div className="card-head">
        <h2>ジョブ {jobs.length > 0 && <span className="muted">({jobs.length})</span>}</h2>
        {finished.length > 0 && (
          <button className="ghost small" onClick={onClearFinished}>
            完了済みを片付け
          </button>
        )}
      </div>
      {jobs.length === 0 && (
        <div className="empty">ファイルが追加されるとここに表示されます</div>
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
