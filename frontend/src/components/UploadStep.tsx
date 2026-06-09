import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { useLang } from '../contexts/LanguageContext'

const API = import.meta.env.VITE_API_URL ?? ''

interface Props {
  onUpload: (imageUrl: string, sessionId: string, subject: string) => void
  onSwitchToAI: () => void
}

export function UploadStep({ onUpload, onSwitchToAI }: Props) {
  const { t } = useLang()
  const [dragOver,  setDragOver]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Paste image from clipboard
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (item) { const f = item.getAsFile(); if (f) handleFile(f) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File) {
    if (!file.type.match(/^image\//)) {
      setError(t.uploadErrType)
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setError(t.uploadErrSize)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? t.uploadFailed)
      }
      const data = await res.json()
      onUpload(data.image_url, data.session_id, data.subject ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t.uploadFailed)
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '40px 24px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 10 }}>
          {t.uploadTitle}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', maxWidth: 480 }}>
          {t.uploadSubtitle}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          width: '100%', maxWidth: 520,
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '64px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          cursor: uploading ? 'default' : 'pointer',
          background: dragOver ? 'rgba(249,115,22,.06)' : 'var(--surface)',
          transition: 'all .2s',
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />

        {uploading ? (
          <>
            <UploadSpinner />
            <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>{t.uploadAnalysing}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.uploadUsually}</div>
          </>
        ) : (
          <>
            <div style={{
              width: 60, height: 60, borderRadius: 14,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>↑</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                {t.uploadDropHint}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t.uploadFormats}</div>
            </div>
          </>
        )}
      </div>

      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>⚠ {error}</div>}

      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        {t.preferAi}{' '}
        <button
          onClick={onSwitchToAI}
          disabled={uploading}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--accent)', fontSize: 13,
            cursor: uploading ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          {t.generateHere}
        </button>
      </div>
    </div>
  )
}

function UploadSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 36, height: 36,
      border: '3px solid rgba(249,115,22,.2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}
