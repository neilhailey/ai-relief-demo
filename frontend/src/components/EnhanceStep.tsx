import { useState, useRef, useCallback, PointerEvent } from 'react'

const API = import.meta.env.VITE_API_URL ?? ''

interface Props {
  sessionId:   string
  originalUrl: string
  subject:     string
  /** imageIndex 0 = original, 1 = enhanced */
  onComplete: (imageUrl: string, subject: string, imageIndex: number) => void
}

type Status = 'idle' | 'enhancing' | 'done'

const FEATURES = ['Sharpen Details', 'Improve Clarity', 'Add Definition']

export function EnhanceStep({ sessionId, originalUrl, subject, onComplete }: Props) {
  const [status,       setStatus]       = useState<Status>('idle')
  const [enhancedUrl,  setEnhancedUrl]  = useState<string | null>(null)
  const [finalSubject, setFinalSubject] = useState(subject)
  const [error,        setError]        = useState<string | null>(null)
  const [sliderPos,    setSliderPos]    = useState(50)   // 0–100 %
  const [dragging,     setDragging]     = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function handleEnhance() {
    setStatus('enhancing')
    setError(null)
    try {
      const res = await fetch(`${API}/api/enhance-image`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Enhancement failed')
      }
      const data = await res.json()
      setEnhancedUrl(data.enhanced_url)
      setFinalSubject(data.subject || subject)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed')
      setStatus('idle')
    }
  }

  function getPos(clientX: number): number {
    if (!containerRef.current) return 50
    const r = containerRef.current.getBoundingClientRect()
    return Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100))
  }

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
    setSliderPos(getPos(e.clientX))
    ;(e.target as HTMLDivElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (dragging) setSliderPos(getPos(e.clientX))
  }, [dragging])

  const onPointerUp = useCallback(() => setDragging(false), [])

  const displaySubject = finalSubject || subject

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '36px 24px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Enhance for carving
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 480 }}>
          AI converts your image into a sculptural depth map — boosting detail
          and contrast so every cut comes out crisp.
        </p>
        {displaySubject && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>
            Detected: "{displaySubject}"
          </p>
        )}
      </div>

      {/* Image area — before/after slider */}
      <div
        ref={containerRef}
        onPointerDown={status === 'done' ? onPointerDown : undefined}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          width: '100%', maxWidth: 520,
          aspectRatio: '1',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid var(--border)',
          cursor: status === 'done' ? (dragging ? 'ew-resize' : 'col-resize') : 'default',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Base: original */}
        <img
          src={originalUrl}
          alt="Original"
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Overlay: enhanced, clipped to left portion */}
        {enhancedUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          }}>
            <img
              src={enhancedUrl}
              alt="Enhanced"
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Divider + handle */}
        {enhancedUrl && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${sliderPos}%`, transform: 'translateX(-50%)',
            width: 2, background: 'rgba(255,255,255,.85)',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 34, height: 34, borderRadius: '50%',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,.4)',
              fontSize: 13, color: '#333', fontWeight: 700,
            }}>⟺</div>
          </div>
        )}

        {/* Labels */}
        {enhancedUrl && (
          <>
            <div style={{
              position: 'absolute', top: 10, left: 10,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(0,0,0,.55)', fontSize: 10, fontWeight: 600,
              color: '#fff', letterSpacing: '.06em',
            }}>ORIGINAL</div>
            <div style={{
              position: 'absolute', top: 10, right: 10,
              padding: '3px 8px', borderRadius: 4,
              background: 'var(--accent)', fontSize: 10, fontWeight: 600,
              color: '#fff', letterSpacing: '.06em',
            }}>✦ ENHANCED</div>
          </>
        )}

        {/* Enhancing overlay */}
        {status === 'enhancing' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10,13,18,.78)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <EnhanceSpinner />
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
              Converting to sculpture style…
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>usually 15–25 s</div>
          </div>
        )}
      </div>

      {/* Feature badges */}
      {status !== 'enhancing' && (
        <div style={{ display: 'flex', gap: 10 }}>
          {FEATURES.map(label => (
            <div key={label} style={{
              padding: '8px 14px',
              background: status === 'done' ? 'rgba(5,150,105,.1)' : 'var(--surface)',
              border: `1px solid ${status === 'done' ? 'rgba(5,150,105,.5)' : 'var(--border)'}`,
              borderRadius: 8,
              fontSize: 11, fontWeight: 600, textAlign: 'center',
              color: status === 'done' ? 'var(--green)' : 'var(--text-dim)',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all .3s',
            }}>
              {status === 'done' && <span>✓</span>}
              {label}
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>⚠ {error}</div>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {status === 'done' ? (
          <>
            <button
              onClick={() => onComplete(originalUrl, displaySubject, 0)}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Use Original
            </button>
            <button
              onClick={() => onComplete(enhancedUrl!, finalSubject, 1)}
              style={{
                padding: '12px 28px',
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Use Enhanced →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onComplete(originalUrl, displaySubject, 0)}
              disabled={status === 'enhancing'}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: status === 'enhancing' ? 'var(--muted)' : 'var(--text-dim)',
                fontSize: 13,
                cursor: status === 'enhancing' ? 'default' : 'pointer',
              }}
            >
              Skip Enhancement
            </button>
            <button
              onClick={handleEnhance}
              disabled={status === 'enhancing'}
              style={{
                padding: '12px 28px',
                background: status === 'enhancing' ? 'var(--border)' : 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius)',
                color: status === 'enhancing' ? 'var(--muted)' : '#fff',
                fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: status === 'enhancing' ? 'default' : 'pointer',
                transition: 'background .2s',
              }}
            >
              {status === 'enhancing'
                ? <><SmallSpinner /> Enhancing…</>
                : '✦  Enhance for Carving'
              }
            </button>
          </>
        )}
      </div>

    </div>
  )
}

function EnhanceSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 40, height: 40,
      border: '3px solid rgba(249,115,22,.2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

function SmallSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 13, height: 13,
      border: '2px solid rgba(255,255,255,.25)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
