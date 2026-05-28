import { Suspense, lazy, useState, useCallback, useRef } from 'react'
import type { CameraPreset } from './StlViewer'

const StlViewer = lazy(() => import('./StlViewer').then(m => ({ default: m.StlViewer })))

interface Props {
  prompt: string
  heightmapUrl: string
  stlUrl: string
  imageUrl: string
  sessionId: string
  onStartOver: () => void
  onUpdateStl: (params: SliderParams) => Promise<string>
}

export interface SliderParams {
  scale_z: number
  detail_enhance: number
  replace_below: number
}

export function ReliefStep({ prompt, heightmapUrl, stlUrl: initialStlUrl, imageUrl, onStartOver, onUpdateStl }: Props) {
  const [scaleZ,        setScaleZ]        = useState(100)   // 10–300 displayed as %
  const [detailEnhance, setDetailEnhance] = useState(25)    // 0–100 displayed as %
  const [replaceBelow,  setReplaceBelow]  = useState(5)     // 0–50 displayed as %
  const [currentStlUrl, setCurrentStlUrl] = useState(initialStlUrl)
  const [updating,      setUpdating]      = useState(false)
  const [modelLoading,  setModelLoading]  = useState(true)  // overlay until first STL loads
  const [activeView,    setActiveView]    = useState<CameraPreset>('iso')
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goToPresetRef = useRef<((p: CameraPreset) => void) | null>(null)

  const triggerUpdate = useCallback((sz: number, de: number, rb: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setUpdating(true)
      try {
        const newUrl = await onUpdateStl({
          scale_z:        sz / 100,
          detail_enhance: de / 100,
          replace_below:  rb / 100,
        })
        setCurrentStlUrl(newUrl + `?t=${Date.now()}`)
      } finally {
        setUpdating(false)
      }
    }, 600)
  }, [onUpdateStl])

  // Scale Z is applied instantly as a Three.js transform — no STL rebuild needed
  // for the live preview. We still queue a background rebuild so the downloaded
  // STL has the correct scale baked into the geometry.
  function handleScaleZ(v: number)  { setScaleZ(v);        triggerUpdate(v, detailEnhance, replaceBelow) }

  // Detail / Replace Below change actual mesh geometry — requires a rebuild.
  function handleDetail(v: number)  { setDetailEnhance(v); triggerUpdate(scaleZ, v, replaceBelow)        }
  function handleReplace(v: number) { setReplaceBelow(v);  triggerUpdate(scaleZ, detailEnhance, v)       }

  function handleViewButton(preset: CameraPreset) {
    setActiveView(preset)
    goToPresetRef.current?.(preset)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', minHeight: 520 }}>

      {/* ── Left panel: controls ──────────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border-sub)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 14px',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>
          "{prompt}"
        </div>

        <Slider
          label="Scale Z"
          value={scaleZ}
          min={10} max={300} step={5}
          display={v => `${v}%`}
          onChange={handleScaleZ}
          disabled={false}  // instant — always interactive
        />
        <Slider
          label="Detail Enhancement"
          value={detailEnhance}
          min={0} max={100} step={5}
          display={v => `${v}%`}
          onChange={handleDetail}
          disabled={updating}
        />
        <Slider
          label="Replace Below"
          value={replaceBelow}
          min={0} max={50} step={2}
          display={v => `${v}%`}
          onChange={handleReplace}
          disabled={updating}
        />

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* Collapsible stubs matching EasyCreate */}
        {['Edit Height Curve', 'Scale Heights Along Y-Axis', 'Scale Heights Along X-Axis'].map(label => (
          <div key={label} style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'not-allowed', opacity: 0.5,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>›</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Heightmap preview */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Heightmap
          </div>
          <img
            src={heightmapUrl}
            alt="Heightmap"
            style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>

        {/* Downloads */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={currentStlUrl.split('?')[0]}
            download="relief.stl"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px',
              background: updating ? 'var(--border)' : 'var(--accent)',
              color: updating ? 'var(--muted)' : '#fff',
              borderRadius: 'var(--radius)',
              textDecoration: 'none', fontWeight: 600, fontSize: 13,
              transition: 'background .2s',
              pointerEvents: updating ? 'none' : 'auto',
            }}
          >
            <span>Download STL</span>
            <span style={{ fontSize: 15 }}>↓</span>
          </a>
          <a
            href={imageUrl}
            download="relief-image.png"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px',
              background: 'var(--surface2)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none', fontWeight: 600, fontSize: 13,
              transition: 'background .2s',
            }}
          >
            <span>Download Image</span>
            <span style={{ fontSize: 15 }}>↓</span>
          </a>
        </div>
      </div>

      {/* ── Right: 3D viewer ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', background: '#0a0d12' }}>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>drag to orbit · scroll to zoom</span>
          {updating && (
            <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
              <UpdateSpinner /> Updating STL…
            </span>
          )}
        </div>

        {/* View preset buttons (top-right) */}
        <div style={{
          position: 'absolute', top: 10, right: 14,
          display: 'flex', gap: 5, zIndex: 10,
        }}>
          {(['iso', 'top', 'front', 'right'] as CameraPreset[]).map(p => (
            <button
              key={p}
              onClick={() => handleViewButton(p)}
              style={{
                padding: '4px 10px',
                fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.04em',
                background: activeView === p ? 'var(--accent)' : 'rgba(0,0,0,.55)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${activeView === p ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: activeView === p ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <Suspense fallback={null}>
          <StlViewer
            url={currentStlUrl}
            scaleZ={scaleZ / 100}
            onReady={fn => { goToPresetRef.current = fn }}
            onLoadStart={() => {/* keep current model visible — no overlay after first load */}}
            onLoadEnd={() => setModelLoading(false)}
          />
        </Suspense>

        {/* Loading overlay — rendered as a CSS sibling OUTSIDE the WebGL canvas
            so it isn't obscured by the browser's compositor layer */}
        {modelLoading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16,
            background: '#0a0d12',
            pointerEvents: 'none',
            zIndex: 20,
          }}>
            <div style={{
              width: 52, height: 52,
              borderRadius: '50%',
              border: '3px solid rgba(249,115,22,0.15)',
              borderTopColor: '#f97316',
              animation: 'spin 0.9s linear infinite',
            }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 500, marginBottom: 4 }}>
                Building 3D relief…
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                usually 15–30 s
              </div>
            </div>
          </div>
        )}

        {/* Start over */}
        <button
          onClick={onStartOver}
          style={{
            position: 'absolute', bottom: 16, right: 16,
            padding: '7px 14px',
            background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-dim)', fontSize: 12, zIndex: 10,
            cursor: 'pointer',
          }}
        >
          ↺ Start over
        </button>
      </div>
    </div>
  )
}

// ── Reusable slider ──────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

function Slider({ label, value, min, max, step, display, onChange, disabled }: SliderProps) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{display(value)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>—</span>
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)', cursor: disabled ? 'default' : 'pointer' }}
        />
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>△</span>
      </div>
    </div>
  )
}

function UpdateSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11,
      border: '2px solid rgba(249,115,22,.3)', borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}
