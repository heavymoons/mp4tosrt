import React, { useEffect, useState } from 'react'
import { useT } from '../i18n'

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
  const t = useT()
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
    return window.confirm(t('file.confirmDiscard'))
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
      return
    }
    // dict は「誤変換[TAB]正解」形式なので Tab で実際のタブ文字を挿入する
    // (デフォルトの textarea は Tab がフォーカス移動になるためそのままでは入力不可)
    if (
      kind === 'dict' &&
      e.key === 'Tab' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      setContent(content.slice(0, start) + '\t' + content.slice(end))
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1
      })
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
            <button onClick={useDefault} disabled={!enabled}>{t('file.useDefault')}</button>
          )}
          <button onClick={() => void pickAnother()} disabled={!enabled}>{t('file.pickAnother')}</button>
          <button onClick={toggleOpen} disabled={!enabled}>
            {open ? t('file.close') : t('file.edit')}
          </button>
        </div>
        <div className="muted small">
          {ready ? (isDefault ? t('file.default') : t('file.custom')) : t('file.loading')}
          {' '}({basename(path)})
        </div>
      </label>

      {open && (
        <div className="file-editor-body">
          {loading && <div className="muted small">{t('file.loading')}</div>}
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
              {dirty ? t('file.unsavedHint') : t('file.saved')}
              {kind === 'dict' && t('file.tabHint')}
            </span>
            <button onClick={() => void save()} disabled={!dirty}>
              {t('file.save')}
            </button>
            <button
              className="ghost"
              onClick={() => {
                setContent(savedContent)
                setError(null)
              }}
              disabled={!dirty}
            >
              {t('file.revert')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
