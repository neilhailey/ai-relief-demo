/// <reference types="vite/client" />
import { useState } from 'react'
import { StepIndicator } from './components/StepIndicator'
import { PromptStep } from './components/PromptStep'
import { SelectStep, ImageOption } from './components/SelectStep'
import { PreviewStep } from './components/PreviewStep'
import { ReliefStep, SliderParams } from './components/ReliefStep'

type Step = 1 | 2 | 3 | 4

interface SessionState {
  sessionId: string
  prompt: string
  images: ImageOption[]
  selectedIndex: number | null
  heightmapUrl: string | null
  stlUrl: string | null
}

const API = import.meta.env.VITE_API_URL ?? ''

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

export default function App() {
  const [step,    setStep]    = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)

  // ── Step 1 → 2: generate images ─────────────────────────────────────────
  async function handleGenerate(prompt: string) {
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ session_id: string; images: ImageOption[] }>(
        '/api/generate', { prompt },
      )
      setSession({
        sessionId: data.session_id, prompt,
        images: data.images,   // URLs are already absolute data: URLs from backend
        selectedIndex: null, heightmapUrl: null, stlUrl: null,
      })
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  // ── Step 2 → 3: select image ─────────────────────────────────────────────
  function handleSelectImage(index: number) {
    setSession(s => s ? { ...s, selectedIndex: index } : s)
    setStep(3)
  }

  // ── Step 3 → 4: create model ─────────────────────────────────────────────
  async function handleCreateModel(removeBg: boolean) {
    if (!session || session.selectedIndex === null) return
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ heightmap_url: string; stl_url: string }>(
        '/api/relief', {
          session_id:     session.sessionId,
          image_index:    session.selectedIndex,
          prompt:         session.prompt,
          replace_below:  removeBg ? 0.08 : 0.0,
          detail_enhance: 0.25,
          scale_z:        1.0,
          draft_angle:    10.0,   // default 10° — user can adjust in the Relief step
        },
      )
      setSession(s => s ? {
        ...s,
        // heightmap_url is a data: URL; stl_url is a relative /api/files/... path
        heightmapUrl: data.heightmap_url,
        stlUrl:       `${API}${data.stl_url}`,
      } : s)
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  // ── Slider update: re-run STL from existing heightmap ────────────────────
  async function handleUpdateStl(params: SliderParams): Promise<string> {
    if (!session) throw new Error('No session')
    const data = await apiFetch<{ stl_url: string }>(
      '/api/update-relief', { session_id: session.sessionId, ...params },
    )
    return `${API}${data.stl_url}`
  }
  // params already includes draft_angle (degrees) forwarded from ReliefStep sliders

  function handleRegenerate() {
    if (session) handleGenerate(session.prompt)
  }

  function handleStartOver() {
    setStep(1); setSession(null); setError(null); setLoading(false)
  }

  const selectedImage = session?.images.find(i => i.index === session.selectedIndex)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>W</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>WeCarver</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: 'rgba(37,99,235,.2)', color: 'var(--accent-glow)',
            border: '1px solid rgba(59,130,246,.3)', fontWeight: 500,
          }}>AI Relief</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Text → Image → 3D Relief → G-code
        </div>
      </header>

      {/* Step indicator */}
      <div style={{ flexShrink: 0, maxWidth: 900, width: '100%', margin: '0 auto' }}>
        <StepIndicator current={step} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          width: '100%', maxWidth: 680, margin: '12px auto 0',
          padding: '12px 16px',
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 'var(--radius)', color: '#fca5a5', fontSize: 13,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠  {error}</span>
          <button onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Main */}
      <main style={{ flex: 1, width: '100%', maxWidth: step === 4 ? '100%' : 960, margin: '0 auto' }}>
        {step === 1 && (
          <PromptStep onGenerate={handleGenerate} loading={loading} />
        )}
        {step === 2 && session && (
          <SelectStep
            key={session.sessionId}
            prompt={session.prompt}
            images={session.images}
            onSelect={handleSelectImage}
            onRegenerate={handleRegenerate}
            loading={loading}
          />
        )}
        {step === 3 && session && selectedImage && (
          <PreviewStep
            prompt={session.prompt}
            imageUrl={selectedImage.url}
            onCreateModel={handleCreateModel}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}
        {step === 4 && session && session.heightmapUrl && session.stlUrl && selectedImage && (
          <ReliefStep
            prompt={session.prompt}
            heightmapUrl={session.heightmapUrl}
            stlUrl={session.stlUrl}
            imageUrl={selectedImage.url}
            sessionId={session.sessionId}
            onStartOver={handleStartOver}
            onUpdateStl={handleUpdateStl}
          />
        )}
      </main>

      {step !== 4 && (
        <footer style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--muted)',
          display: 'flex', justifyContent: 'center', gap: 20,
          flexShrink: 0,
        }}>
          <span>Steps 1–2: gpt-image-1 via OpenAI</span>
          <span>·</span>
          <span>Step 3 coming: AI Toolpath Generation</span>
          <span>·</span>
          <span>Step 4 coming: Hardware Execution</span>
        </footer>
      )}
    </div>
  )
}
