import { useState, KeyboardEvent } from 'react'

const EXAMPLES = [
  'Viking warrior bust',
  'Sitting Buddha statue',
  'Celtic cross',
  'Dragon figurine',
  'Chess knight piece',
  'Howling wolf',
  'Samurai helmet',
  'Eagle perched on rock',
  'Bull skull trophy',
  'Bear standing up',
  'Mermaid figurine',
  'Native American chief bust',
  'Lion head',
  'Medieval cannon',
  'Gnome garden statue',
  'Fox sitting',
  'Skull with antlers',
  'Trophy cup',
  'Ship anchor',
  'Kraken tentacle arm',
  'Owl perched on branch',
  'Moose head mount',
  'Howling coyote',
  'Spartan helmet',
  'Pirate skull',
  'Sitting cat',
  'Bison skull',
  'Angel wings',
  'Gargoyle crouching',
  'Bighorn sheep head',
]

function pickRandom(n: number): string[] {
  return [...EXAMPLES].sort(() => Math.random() - 0.5).slice(0, n)
}

interface Props {
  onGenerate:    (prompt: string) => void
  loading:       boolean
  onSwitchToAI:  () => void
}

export function Model3dPromptStep({ onGenerate, loading, onSwitchToAI }: Props) {
  const [prompt,   setPrompt]   = useState('')
  const [examples] = useState<string[]>(() => pickRandom(7))

  function submit() {
    const p = prompt.trim()
    if (!p || loading) return
    onGenerate(p)
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '40px 24px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 10 }}>
          Generate a 3D object
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', maxWidth: 500 }}>
          Describe any object — AI builds a complete 3D mesh you can carve on a
          rotary CNC, 4th-axis setup, or send straight to a 3D printer.
        </p>
      </div>

      {/* Input */}
      <div style={{ width: '100%', maxWidth: 580 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder="e.g. Viking warrior bust with braided beard…"
          disabled={loading}
          rows={3}
          style={{
            width: '100%', resize: 'none', padding: '14px 16px',
            background: 'var(--surface2)', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 15,
            outline: 'none', transition: 'border-color .2s', lineHeight: 1.5,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
          onBlur={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        <button
          onClick={submit}
          disabled={!prompt.trim() || loading}
          style={{
            marginTop: 12, width: '100%', padding: '14px',
            background: !prompt.trim() || loading ? 'var(--border)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: !prompt.trim() || loading ? 'var(--muted)' : '#fff',
            border: 'none', borderRadius: 'var(--radius)',
            fontSize: 15, fontWeight: 600,
            transition: 'opacity .2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? <><Spin3d /> Submitting…</> : '✦  Generate 3D Model'}
        </button>
      </div>

      {/* Example chips */}
      <div style={{ textAlign: 'center', maxWidth: 580 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Try an example:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {examples.map(ex => (
            <button
              key={ex}
              onClick={() => !loading && setPrompt(ex)}
              disabled={loading}
              style={{
                padding: '5px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 20, color: 'var(--text-dim)',
                fontSize: 12, transition: 'all .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#6366f1'
                e.currentTarget.style.color = '#a5b4fc'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* CNC note */}
      <div style={{
        maxWidth: 500,
        padding: '12px 16px',
        background: 'rgba(99,102,241,.07)',
        border: '1px solid rgba(99,102,241,.2)',
        borderRadius: 'var(--radius)',
        fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6,
        textAlign: 'center',
      }}>
        <strong style={{ color: '#a5b4fc' }}>Full 3D mesh</strong> — outputs GLB (textures + materials) and STL
        (CNC / printing). Best with a rotary axis or 4-axis CNC.
        For flat-panel relief carving, use the AI Relief flow instead.
      </div>

      {/* Switch link */}
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        Want a flat bas-relief instead?{' '}
        <button
          onClick={onSwitchToAI}
          disabled={loading}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--accent)', fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          Switch to AI Relief →
        </button>
      </div>

    </div>
  )
}

function Spin3d() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
