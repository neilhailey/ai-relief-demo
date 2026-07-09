import { Suspense, lazy, useState, useRef } from 'react'
import type { CameraPreset } from './StlViewer'
import type { MaterialPreset } from './materialPresets'
import { MATERIAL_PRESETS } from './materialPresets'
import { MaterialPicker } from './MaterialPicker'
import { PublishButton } from './PublishButton'
import { useLang } from '../contexts/LanguageContext'

const StlViewer = lazy(() => import('./StlViewer').then(m => ({ default: m.StlViewer })))

interface Props {
  prompt:      string
  stlUrl:      string
  renderedUrl: string | undefined
  sessionId:   string
  dbId:        string | null
  isPublic:    boolean
  onPublish:   (nowPublic: boolean) => void
  onStartOver: () => void
}

export function Model3dResultStep({ prompt, stlUrl, renderedUrl, dbId, isPublic, onPublish, onStartOver }: Props) {
  const { t } = useLang()
  const [activeView,     setActiveView]     = useState<CameraPreset>('iso')
  const [materialPreset, setMaterialPreset] = useState<MaterialPreset>(MATERIAL_PRESETS[0])
  const [loaded,         setLoaded]         = useState(false)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const goToPresetRef = useRef<((p: CameraPreset) => void) | null>(null)

  function handleViewButton(preset: CameraPreset) {
    setActiveView(preset)
    goToPresetRef.current?.(preset)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', minHeight: 520 }}>

      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border-sub)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 14px', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>
          "{prompt}"
        </div>

        {renderedUrl && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {t.meshPreview}
            </div>
            <img
              src={renderedUrl} alt={t.meshPreview}
              style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </div>
        )}

        <div style={{
          padding: '10px 12px', marginBottom: 16,
          background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
          borderRadius: 8, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: 4 }}>{t.full3dMesh}</div>
          {t.full3dMeshInfo}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={stlUrl} download="model.stl"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              color: '#fff', borderRadius: 'var(--radius)',
              textDecoration: 'none', fontWeight: 600, fontSize: 13,
            }}
          >
            <span>{t.downloadStl}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>{t.downloadStlSub}</span>
          </a>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
            {t.downloadStlNote}
          </div>

          <div style={{ marginTop: 8 }}>
            <PublishButton dbId={dbId} isPublic={isPublic} onToggle={onPublish} />
          </div>
        </div>
      </div>

      {/* ── Right: 3D viewer ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', background: '#0a0d12' }}>

        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.dragOrbit}</span>
        </div>

        <div style={{ position: 'absolute', top: 10, right: 14, display: 'flex', gap: 5, zIndex: 10 }}>
          {(['iso', 'top', 'front', 'right'] as CameraPreset[]).map(p => (
            <button
              key={p}
              onClick={() => handleViewButton(p)}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.04em',
                background: activeView === p ? '#6366f1' : 'rgba(0,0,0,.55)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${activeView === p ? '#6366f1' : 'var(--border)'}`,
                borderRadius: 5,
                color: activeView === p ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >{p}</button>
          ))}
        </div>

        <Suspense fallback={null}>
          <StlViewer
            url={stlUrl} scaleZ={1.0}
            materialPreset={materialPreset}
            onReady={fn => { goToPresetRef.current = fn }}
            onLoadStart={() => {}}
            onLoadEnd={() => setLoaded(true)}
            onLoadError={msg => setLoadError(msg)}
          />
        </Suspense>

        {/* Material picker — bottom-left overlay */}
        {loaded && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 10,
            background: 'rgba(10,13,18,.80)', backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)', borderRadius: 10,
            padding: '12px 14px', minWidth: 180,
          }}>
            <MaterialPicker value={materialPreset} onChange={setMaterialPreset} />
          </div>
        )}

        {!loaded && !loadError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'rgba(10,13,18,.9)', zIndex: 20, pointerEvents: 'none',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#818cf8',
              animation: 'spin 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t.loadingModel}</div>
          </div>
        )}

        {loadError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            background: 'rgba(10,13,18,.95)', zIndex: 20,
          }}>
            <div style={{ fontSize: 28 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f87171' }}>{t.couldntLoad}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
              {t.expiredHint}
            </div>
            <button
              onClick={onStartOver}
              style={{
                marginTop: 4, padding: '9px 20px',
                background: '#6366f1', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >{t.generateNew}</button>
          </div>
        )}

        <button
          onClick={onStartOver}
          style={{
            position: 'absolute', bottom: 16, right: 16,
            padding: '7px 14px',
            background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            color: 'var(--text-dim)', fontSize: 12, zIndex: 10, cursor: 'pointer',
          }}
        >{t.startOverBtn}</button>
      </div>
    </div>
  )
}
