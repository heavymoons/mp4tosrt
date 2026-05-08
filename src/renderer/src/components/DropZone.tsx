import React, { useState } from 'react'
import { useT } from '../i18n'

type Props = {
  onFiles: (paths: string[]) => void
  onPick: () => void
  disabled?: boolean
}

export default function DropZone({ onFiles, onPick, disabled }: Props): JSX.Element {
  const t = useT()
  const [hover, setHover] = useState(false)

  const onDrop = (e: React.DragEvent<HTMLElement>): void => {
    e.preventDefault()
    setHover(false)
    if (disabled) return
    const paths: string[] = []
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = window.api.getPathForFile(f)
      if (p) paths.push(p)
    }
    if (paths.length) onFiles(paths)
  }

  return (
    <section
      className={`dropzone ${hover ? 'hover' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={e => {
        if (disabled) return
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      <p>{disabled ? t('drop.disabled') : t('drop.hint')}</p>
      <button onClick={onPick} disabled={disabled}>
        {t('drop.pick')}
      </button>
    </section>
  )
}
