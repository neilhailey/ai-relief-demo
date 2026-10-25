import { useRef, useEffect } from 'react'

interface Props {
  value:       string
  onChange:    (html: string) => void
  placeholder?: string
}

// Lightweight contentEditable editor. Uses document.execCommand for basic
// formatting (bold, headings, lists, links) — enough for project descriptions
// without pulling in a heavy WYSIWYG dependency.
export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Seed the initial HTML once; afterwards the DOM is the source of truth so
  // the caret doesn't jump on every keystroke.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg)
    ref.current?.focus()
    emit()
  }

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const btn: React.CSSProperties = {
    minWidth: 30, height: 28, padding: '0 8px', borderRadius: 6, cursor: 'pointer',
    background: 'transparent', border: '1px solid transparent',
    color: 'var(--text-dim)', fontSize: 13, fontWeight: 600,
  }

  const isEmpty = !value || value === '<br>' || value.replace(/<[^>]*>/g, '').trim() === ''

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button type="button" title="Heading" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', '<h3>')}>H</button>
        <button type="button" title="Bullet list" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>• List</button>
        <button type="button" title="Numbered list" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')}>1. List</button>
        <button type="button" title="Bold" style={{ ...btn, fontWeight: 800 }} onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}>B</button>
        <button type="button" title="Italic" style={{ ...btn, fontStyle: 'italic' }} onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')}>I</button>
        <button type="button" title="Link" style={btn} onMouseDown={e => e.preventDefault()} onClick={() => {
          const url = window.prompt('Link URL:')
          if (url) exec('createLink', url)
        }}>🔗</button>
      </div>

      {/* Editable area */}
      <div style={{ position: 'relative' }}>
        {isEmpty && (
          <div style={{ position: 'absolute', top: 12, left: 14, color: 'var(--muted)', fontSize: 14, pointerEvents: 'none' }}>
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          style={{
            minHeight: 150, padding: '12px 14px', outline: 'none',
            fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
          }}
        />
      </div>
    </div>
  )
}
