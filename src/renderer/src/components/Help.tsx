import React, { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import readmeRaw from '../../../../README.md?raw'

marked.setOptions({ gfm: true, breaks: false })

type Props = {
  onClose: () => void
}

export default function Help({ onClose }: Props): JSX.Element {
  const html = useMemo(() => {
    const raw = marked.parse(readmeRaw) as string
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target', 'rel'],
      USE_PROFILES: { html: true }
    })
  }, [])
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    const onClick = (e: MouseEvent): void => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (/^https?:\/\//.test(href)) {
        e.preventDefault()
        void window.api.openExternal(href)
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>マニュアル</h2>
          <button className="ghost small" onClick={onClose}>
            閉じる (Esc)
          </button>
        </div>
        <div
          ref={bodyRef}
          className="modal-body markdown"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
