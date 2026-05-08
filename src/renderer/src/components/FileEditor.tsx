import React, { useEffect, useState } from 'react'

type Kind = 'dict' | 'hallucinations'

type Props = {
  label: string
  kind: Kind
  path: string
  onPathChange: (next: string | undefined) => void
  pickFile: () => Promise<string | null>
  enabled?: boolean
}

function basename(p: string): string {
  const parts = p.split('/')
  return parts[parts.length - 1] || p
}

export default function FileEditor({
  label, kind, path, onPathChange, pickFile, enabled = true
}: Props): JSX.Element {
  const [defaultPath, setDefaultPath] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.userFileDefaultPath(kind).then(setDefaultPath)
  }, [kind])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    window.api
      .readUserFile(path)
      .then(text => {
        setContent(text)
        setSavedContent(text)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [open, path])

  const isDefault = defaultPath !== null && path === defaultPath
  const dirty = open && content !== savedContent

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true
    return window.confirm('未保存の変更があります。破棄して続行しますか？')
  }

  const save = async (): Promise<void> => {
    try {
      await window.api.writeUserFile(path, content)
      setSavedContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pickAnother = async (): Promise<void> => {
    if (!confirmDiscardIfDirty()) return
    const p = await pickFile()
    if (p) onPathChange(p)
  }

  const useDefault = (): void => {
    if (!confirmDiscardIfDirty()) return
    if (defaultPath) onPathChange(defaultPath)
  }

  const toggleOpen = (): void => {
    if (open) {
      if (!confirmDiscardIfDirty()) return
    }
    setOpen(o => !o)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Cmd+S / Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (dirty) void save()
    }
  }

  // defaultPath 取得前は path-related UI を控えめに
  const ready = defaultPath !== null

  return (
    <div className="file-editor">
      <label className="file-editor-path">
        {label}
        <div className="row">
          <input readOnly value={path} title={path} />
          {ready && !isDefault && (
            <button onClick={useDefault} disabled={!enabled}>デフォルトに戻す</button>
          )}
          <button onClick={() => void pickAnother()} disabled={!enabled}>別のファイル…</button>
          <button onClick={toggleOpen} disabled={!enabled}>
            {open ? '閉じる' : '編集'}
          </button>
        </div>
        <div className="muted small">
          {ready ? (isDefault ? 'デフォルトファイル' : 'カスタムファイル') : '読込中…'}
          {' '}({basename(path)})
        </div>
      </label>

      {open && (
        <div className="file-editor-body">
          {loading && <div className="muted small">読み込み中…</div>}
          {error && <div className="job-error">{error}</div>}
          <textarea
            rows={10}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          <div className="file-editor-actions">
            <span className="muted small">
              {dirty ? '※ 未保存の変更があります (Cmd+S で保存)' : '保存済み'}
            </span>
            <button onClick={() => void save()} disabled={!dirty}>
              保存
            </button>
            <button
              className="ghost"
              onClick={() => {
                setContent(savedContent)
                setError(null)
              }}
              disabled={!dirty}
            >
              元に戻す
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
