import { useEffect, useState } from 'react'

interface Props {
  prompt:      string
  status:      'running' | 'done' | 'failed'
  tripoStatus: string   // 'queued' | 'running' | 'success'
  progress:    number   // 0–100
  error:       string | null
  onView:      () => void
  onPlayGame:  () => void
  onCancel:    () => void
}

export function Model3dGeneratingStep({
  prompt, status, tripoStatus, progress, error, onView, onPlayGame, onCancel,
}: Props) {

  // Animated ellipsis for queued / converting states
  const [dots, setDots] = useState('.')
  useEffect(() => {
    if (status !== 'running') return
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(t)
  }, [status])

  const isRunning = status === 'running'
  const isDone    = status === 'done'
  const isFailed  = status === 'failed'

  const statusLabel =
    isDone                    ? '3D model is ready!' :
    isFailed                  ? 'Generation failed'  :
    tripoStatus === 'queued'  ? `Queued in Tripo${dots}` :
    tripoStatus === 'success' ? `Converting mesh to STL${dots}` :
    `Generating 3D model… ${progress}%`

  // 0–100 fill for the determinate bar; 0 means use shimmer
  const barPct =
    tripoStatus === 'queued'  ? 0 :
    tripoStatus === 'success' ? 96 :
    Math.max(progress, 3)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 28, padding: '52px 24px 40px',
      maxWidth: 560, margin: '0 auto',
      animation: 'fadeIn .35s ease',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 30, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 14,
          color: isDone ? '#4ade80' : isFailed ? '#f87171' : '#a5b4fc',
        }}>
          {isDone   && '✓ Your 3D model is ready!'}
          {isFailed && '⚠ Generation failed'}
          {isRunning && '✦ Generating your 3D model'}
        </div>

        {/* Prompt echo */}
        <div style={{
          padding: '10px 18px',
          background: 'rgba(99,102,241,.08)',
          border: '1px solid rgba(99,102,241,.18)',
          borderRadius: 10,
          fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic',
          lineHeight: 1.55,
        }}>
          "{prompt}"
        </div>
      </div>

      {/* ── Progress bar + status (running only) ────────────────────────── */}
      {isRunning && (
        <div style={{ width: '100%' }}>
          <div style={{
            height: 6, background: 'rgba(255,255,255,.07)',
            borderRadius: 3, overflow: 'hidden',
            position: 'relative', marginBottom: 10,
          }}>
            {barPct === 0 ? (
              /* Indeterminate shimmer while queued */
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: '35%',
                background: 'linear-gradient(90deg, transparent, #6366f1 40%, #818cf8 60%, transparent)',
                animation: 'shimmer 1.6s ease-in-out infinite',
              }} />
            ) : (
              /* Determinate fill */
              <div style={{
                height: '100%', width: `${barPct}%`,
                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                borderRadius: 3,
                transition: 'width 2s ease',
              }} />
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
            {statusLabel}
          </p>
        </div>
      )}

      {/* ── Error detail ────────────────────────────────────────────────── */}
      {isFailed && error && (
        <div style={{
          width: '100%', padding: '12px 16px',
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 8, color: '#fca5a5', fontSize: 13, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* ── Game button (running only) ───────────────────────────────────── */}
      {isRunning && (
        <button
          onClick={onPlayGame}
          style={{
            width: '100%',
            padding: '20px 24px',
            background: 'rgba(99,102,241,.12)',
            border: '1px solid rgba(148,151,248,.4)',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'background .2s, border-color .2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background    = 'rgba(99,102,241,.25)'
            e.currentTarget.style.borderColor   = '#818cf8'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background    = 'rgba(99,102,241,.12)'
            e.currentTarget.style.borderColor   = 'rgba(148,151,248,.4)'
          }}
        >
          <span style={{ fontSize: 36, lineHeight: 1 }}>🎮</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e7ff', marginBottom: 3 }}>
              Play Flappy Bird while you wait
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              We'll show you when the model is ready
            </div>
          </div>
          <span style={{ color: '#818cf8', fontSize: 20 }}>→</span>
        </button>
      )}

      {/* ── View button (done) ───────────────────────────────────────────── */}
      {isDone && (
        <button
          onClick={onView}
          style={{
            width: '100%', padding: '17px 24px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', borderRadius: 12, cursor: 'pointer',
            fontSize: 16, fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 20px rgba(34,197,94,.3)',
          }}
        >
          View 3D Model →
        </button>
      )}

      {/* ── Try again (failed) ──────────────────────────────────────────── */}
      {isFailed && (
        <button
          onClick={onCancel}
          style={{
            padding: '12px 28px',
            background: 'rgba(99,102,241,.15)',
            border: '1px solid rgba(99,102,241,.4)',
            borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: '#a5b4fc',
          }}
        >
          Try again
        </button>
      )}

      {/* ── Cancel link ─────────────────────────────────────────────────── */}
      {!isDone && (
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', padding: '4px 0',
            color: 'var(--muted)', fontSize: 12,
            cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          {isFailed ? 'Start over' : 'Cancel and start over'}
        </button>
      )}
    </div>
  )
}
