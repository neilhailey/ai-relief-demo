import { useState, KeyboardEvent } from 'react'
import { ImageGenLoading } from './LoadingVibes'

const ALL_EXAMPLES = [
  // Wildlife
  'Celtic knot medallion',
  'Howling wolf silhouette',
  'Sunflower in bloom',
  'Mountain landscape',
  'Koi fish',
  'Eagle in flight',
  'Mandala pattern',
  'Rose with thorns',
  'Compass rose',
  'Leaping stag',
  'Oak tree with roots',
  'Nautical anchor',
  'Hummingbird',
  'Lotus flower',
  'Running horse',
  'Pine forest at sunset',
  'Tribal bear',
  'Cresting wave',
  'Barn owl',
  'Grapevine wreath',
  'Leaping salmon',
  'Deer skull with antlers',
  'Bald eagle head',
  'Geometric deer',
  'Dragon silhouette',
  'Vintage ship wheel',
  'Honeybee on comb',
  'Bull skull',
  // More wildlife
  'Grizzly bear portrait',
  'Wolf pack howling at moon',
  'Red-tailed hawk diving',
  'Mountain goat on cliff ledge',
  'Buck with massive rack',
  'Moose wading in marsh',
  'Wild boar charging',
  'Bighorn sheep on ridge',
  'Pronghorn antelope running',
  'Coyote howling at dusk',
  'Raven perched on branch',
  'Canada goose in flight',
  'Whitetail doe with fawn',
  'Buffalo bull',
  'Silverback gorilla',
  'Red fox in autumn leaves',
  'Jackrabbit at full sprint',
  'Rooster crowing at dawn',
  'Peacock displaying feathers',
  'Swan gliding on water',
  'Great horned owl face',
  'Wild turkey fanning tail',
  'Pheasant rising from grass',
  // Fish & marine
  'Largemouth bass jumping',
  'Rainbow trout leaping',
  'Octopus with curling tentacles',
  'Sea turtle swimming',
  'Dolphin leaping from water',
  'Whale tail at sunset',
  'Great white shark',
  'Steelhead trout',
  'Brook trout',
  'Walleye fish',
  // Celtic, Norse & heraldic
  'Celtic triple spiral',
  'Viking longship under sail',
  'Viking helmet with horns',
  'Norse tree of life',
  'Fleur-de-lis',
  'Heraldic lion rampant',
  'Knight shield and crossed swords',
  'Crown with jewels',
  'Crossed tomahawks',
  'Anchor with rope wrapped',
  // Native American
  'Dreamcatcher with feathers',
  'Pacific Northwest totem face',
  'Thunderbird spread wings',
  'Medicine wheel',
  'Buffalo skull with headdress',
  // Botanical & nature
  'Cherry blossom branch',
  'Maple leaf',
  'Scottish thistle',
  'Iris in bloom',
  'Cattails at water edge',
  'Sheaf of wheat',
  'Pinecone on branch',
  'Acorn with oak leaf',
  'Cluster of mushrooms',
  'Fern frond unfurling',
  'Poppy flowers',
  'Lavender sprig',
  // Landscapes
  'Waterfall in forest',
  'Rocky peaks at dawn',
  'Desert arch canyon',
  'Lighthouse in storm',
  'Old covered bridge',
  // Western & Americana
  'Longhorn cattle skull',
  'Cowboy hat and boots',
  'Horseshoe with lucky clover',
  'Bowie knife',
  'Acoustic guitar',
  'Buffalo skull with wildflowers',
  // Misc
  'Antique compass rose',
  'Pocket watch gears',
  'Vintage skeleton key',
  'Snake coiled around dagger',
]

function pickRandom(n: number): string[] {
  const shuffled = [...ALL_EXAMPLES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

interface Props {
  onGenerate: (prompt: string) => void
  loading: boolean
  onSwitchToUpload: () => void
}

export function PromptStep({ onGenerate, loading, onSwitchToUpload }: Props) {
  const [prompt,   setPrompt]   = useState('')
  // Lazy initializer — runs once on mount, gives a fresh random set each page load
  const [examples] = useState<string[]>(() => pickRandom(7))

  function submit() {
    const p = prompt.trim()
    if (!p || loading) return
    onGenerate(p)
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // While generating, replace the whole form with the animated loading experience
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <ImageGenLoading prompt={prompt} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '40px 24px' }}>

      {/* Hero text */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 10 }}>
          Describe your design
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', maxWidth: 480 }}>
          Type any idea — we'll generate two images and turn your favourite into a
          carveable 3D relief STL, ready for your CNC machine.
        </p>
      </div>

      {/* Input */}
      <div style={{ width: '100%', maxWidth: 580 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder="e.g. Celtic knot with intricate interlacing patterns…"
          disabled={loading}
          rows={3}
          style={{
            width: '100%', resize: 'none', padding: '14px 16px',
            background: 'var(--surface2)', border: '1.5px solid var(--border)',
            borderRadius: var_radius, color: 'var(--text)', fontSize: 15,
            outline: 'none', transition: 'border-color .2s', lineHeight: 1.5,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        <button
          onClick={submit}
          disabled={!prompt.trim() || loading}
          style={{
            marginTop: 12, width: '100%', padding: '14px',
            background: loading || !prompt.trim() ? 'var(--border)' : 'var(--accent)',
            color: loading || !prompt.trim() ? 'var(--muted)' : '#fff',
            border: 'none', borderRadius: var_radius,
            fontSize: 15, fontWeight: 600,
            transition: 'background .2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <Spinner /> Generating images…
            </>
          ) : (
            '✦  Generate Images'
          )}
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
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
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

      {/* Upload link */}
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        Already have an image?{' '}
        <button
          onClick={onSwitchToUpload}
          disabled={loading}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--accent)', fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          Upload your own →
        </button>
      </div>

    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// Inline keyframes injected once
if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const s = document.createElement('style')
  s.id = 'spinner-style'
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(s)
}

const var_radius = 'var(--radius)'
