import React, { useState } from 'react'

type Props = {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  children
}: Props): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="settings-section">
      <button
        type="button"
        className="settings-section-head"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="chevron">{open ? '▾' : '▸'}</span>
        <span className="settings-section-title">{title}</span>
        {hint && <span className="muted small">{hint}</span>}
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </div>
  )
}
