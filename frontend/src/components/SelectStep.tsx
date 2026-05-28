import { useState } from 'react'

export interface ImageOption {
  index: number
  url: string
}

interface Props {
  prompt: string
  enhancedPrompt?: string
  images: ImageOption[]
  onSelect: (index: number) => void
  onRegenerate: () => void
  loading: boolean
}

export function SelectStep({ prompt, enhancedPrompt, images, onSelect, onRegenerate, loading }: Props) {
  const [hovered,      setHovered]      = useState<number | null>(null)
  const [selected,     setSelected]     = useState<number | null>(null)
  const [showEnhanced, setShowEnhanced] = useState(false)

  function confirm(idx: number) {
    setSelected(idx)
    setTimeout(() => onSelect(idx), 180)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '36px 24px' }}>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Choose your favourite</h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
          Your prompt: <em style={{ color: 'var(--text)' }}>"{prompt}"</em>
        </p>
        {enhancedPrompt && enhancedPrompt !== prompt && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            <button
              onClick={() => setShowEnhanced(v => !v)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--accent)', fontSize: 11, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>✦</span>
              {showEnhanced ? 'Hide enhanced prompt' : 'Prompt was enhanced for better results'}
            </button>
            {showEnhanced && (
              <div style={{
                marginTop: 8, maxWidth: 560, margin: '8px auto 0',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12, color: 'var(--text-dim)',
                textAlign: 'left', lineHeight: 1.6,
                fontStyle: 'italic',
              }}>
                {enhancedPrompt}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading banner while regenerating */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: 13, color: 'var(--text-dim)',
        }}>
          <Spinner />
          <span>Generating new variations… <span style={{ color: 'var(--accent)' }}>usually 15–25 s</span></span>
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 20, width: '100%', maxWidth: 760,
        opacity: loading ? 0.4 : 1,
        transition: 'opacity .3s',
        pointerEvents: loading ? 'none' : 'auto',
      }}>
        {images.map(img => {
          const isHov = hovered === img.index
          const isSel = selected === img.index
          return (
            <div
              key={img.index}
              onClick={() => confirm(img.index)}
              onMouseEnter={() => setHovered(img.index)}
              onMouseLeave={() => setHovered(null)}
              style={{
                borderRadius: 'var(--radius)', overflow: 'hidden',
                border: `2px solid ${isSel ? 'var(--accent-glow)' : isHov ? 'var(--accent)' : 'var(--border-sub)'}`,
                cursor: 'pointer',
                transition: 'border-color .2s, transform .15s',
                transform: isHov ? 'translateY(-2px)' : 'none',
                boxShadow: isSel
                  ? '0 0 0 3px rgba(37,99,235,.35)'
                  : isHov ? '0 8px 24px rgba(0,0,0,.4)' : 'none',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', paddingBottom: '100%', background: 'var(--surface)' }}>
                <img
                  src={img.url}
                  alt={`Variation ${img.index + 1}`}
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                  }}
                />
                {(isHov || isSel) && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isSel ? 'rgba(249,115,22,.18)' : 'rgba(59,130,246,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      padding: '10px 22px',
                      background: isSel ? 'var(--accent)' : 'var(--blue)',
                      borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#fff',
                    }}>
                      {isSel ? '✓ Selected' : 'Select this one →'}
                    </div>
                  </div>
                )}
              </div>
              <div style={{
                padding: '10px 14px',
                background: 'var(--surface)',
                fontSize: 12, color: 'var(--text-dim)',
              }}>
                Variation {img.index + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Regenerate button */}
      <button
        onClick={onRegenerate}
        disabled={loading}
        style={{
          padding: '8px 20px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: loading ? 'var(--muted)' : 'var(--text-dim)',
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 7,
          cursor: loading ? 'default' : 'pointer',
          transition: 'all .15s',
        }}
        onMouseEnter={e => {
          if (!loading) {
            e.currentTarget.style.borderColor = 'var(--blue-hi)'
            e.currentTarget.style.color = 'var(--blue-hi)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = loading ? 'var(--muted)' : 'var(--text-dim)'
        }}
      >
        {loading ? <><Spinner /> Generating…</> : '↺  Regenerate both'}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11,
      border: '2px solid rgba(249,115,22,.3)',
      borderTopColor: 'var(--accent)', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
