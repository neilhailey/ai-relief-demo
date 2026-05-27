import { useState } from 'react'

interface Props {
  prompt: string
  imageUrl: string
  onCreateModel: (removeBg: boolean) => void
  onBack: () => void
  loading: boolean
}

export function PreviewStep({ prompt, imageUrl, onCreateModel, onBack, loading }: Props) {
  const [removeBg, setRemoveBg] = useState(false)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 24, padding: '32px 24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          Take a peek, tweak if you like…
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>"{prompt}"</p>
      </div>

      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        {/* Image preview */}
        <div style={{ position: 'relative', background: '#000' }}>
          <img
            src={imageUrl}
            alt="Selected"
            style={{
              width: '100%', display: 'block',
              filter: removeBg ? 'contrast(1.4) brightness(1.1)' : 'none',
              transition: 'filter .3s',
            }}
          />
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,.7)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <Spinner size={36} />
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
                Generating heightmap + 3D model…
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                This takes about 15–25 seconds
              </div>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div style={{
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid var(--border)',
        }}>
          {/* Remove Background toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          }}>
            <div
              onClick={() => !loading && setRemoveBg(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: removeBg ? 'var(--accent)' : 'var(--border)',
                position: 'relative', transition: 'background .2s',
                cursor: loading ? 'default' : 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: removeBg ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }} />
            </div>
            <span style={{ fontSize: 13, color: removeBg ? 'var(--text)' : 'var(--text-dim)' }}>
              Remove Background
            </span>
          </label>

          {/* Crop icon placeholder */}
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', fontSize: 14, cursor: 'not-allowed',
          }} title="Crop (coming soon)">⊡</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-dim)', fontSize: 13,
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => onCreateModel(removeBg)}
          disabled={loading}
          style={{
            padding: '12px 32px',
            background: loading ? 'var(--border)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: loading ? 'var(--muted)' : '#fff',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background .2s',
          }}
        >
          {loading ? <><Spinner size={14} /> Generating…</> : '✦  Create Model'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        Creates a heightmap + converts to printable STL relief
      </div>
    </div>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `${size > 20 ? 3 : 2}px solid rgba(255,255,255,.25)`,
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}
