/// <reference types="vite/client" />
import { useState } from 'react'
import { StepIndicator, UPLOAD_LABELS } from './components/StepIndicator'
import { PromptStep } from './components/PromptStep'
import { UploadStep } from './components/UploadStep'
import { SelectStep, ImageOption } from './components/SelectStep'
import { EnhanceStep } from './components/EnhanceStep'
import { PreviewStep } from './components/PreviewStep'
import { ReliefStep, SliderParams } from './components/ReliefStep'

type Step     = 1 | 2 | 3 | 4
type FlowMode = 'ai' | 'upload'

interface SessionState {
  sessionId:      string
  prompt:         string         // shown in UI
  enhancedPrompt: string         // used for API calls (heightmap generation)
  images:         ImageOption[]
  selectedIndex:  number | null
  heightmapUrl:   string | null
  stlUrl:         string | null
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
  const [step,     setStep]     = useState<Step>(1)
  const [flowMode, setFlowMode] = useState<FlowMode>('ai')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [session,  setSession]  = useState<SessionState | null>(null)

  // ── AI flow: Step 1 → 2 ─────────────────────────────────────────────────
  async function handleGenerate(prompt: string) {
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{
        session_id:      string
        images:          ImageOption[]
        original_prompt: string
        enhanced_prompt: string
      }>('/api/generate', { prompt })
      setSession({
        sessionId:      data.session_id,
        prompt:         data.original_prompt,
        enhancedPrompt: data.enhanced_prompt,
        images:         data.images,
        selectedIndex: null, heightmapUrl: null, stlUrl: null,
      })
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  // ── Upload flow: Step 1 → 2 ──────────────────────────────────────────────
  function handleUpload(imageUrl: string, sessionId: string, subject: string) {
    setSession({
      sessionId,
      prompt:         subject,
      enhancedPrompt: subject,
      images:         [{ index: 0, url: imageUrl }],
      selectedIndex:  0,
      heightmapUrl:   null,
      stlUrl:         null,
    })
    setStep(2)
  }

  // ── Upload flow: Step 2 → 3 ──────────────────────────────────────────────
  // imageIndex 0 = original uploaded, 1 = AI-enhanced
  function handleEnhanceComplete(imageUrl: string, subject: string, imageIndex: number) {
    setSession(s => {
      if (!s) return s
      // Ensure the chosen image is in the images array
      const images = imageIndex === 1
        ? [...s.images.filter(i => i.index !== 1), { index: 1, url: imageUrl }]
        : s.images
      return { ...s, images, selectedIndex: imageIndex, prompt: subject, enhancedPrompt: subject }
    })
    setStep(3)
  }

  // ── AI flow: Step 2 → 3 ─────────────────────────────────────────────────
  function handleSelectImage(index: number) {
    setSession(s => s ? { ...s, selectedIndex: index } : s)
    setStep(3)
  }

  // ── Step 3 → 4: create 3D model ─────────────────────────────────────────
  async function handleCreateModel(removeBg: boolean) {
    if (!session || session.selectedIndex === null) return
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ heightmap_url: string; stl_url: string }>(
        '/api/relief', {
          session_id:     session.sessionId,
          image_index:    session.selectedIndex,
          prompt:         session.enhancedPrompt,
          replace_below:  removeBg ? 0.08 : 0.0,
          detail_enhance: 0.25,
          scale_z:        1.0,
          draft_angle:    10.0,
        },
      )
      setSession(s => s ? {
        ...s,
        heightmapUrl: data.heightmap_url,
        stlUrl:       `${API}${data.stl_url}`,
      } : s)
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  // ── Slider update ────────────────────────────────────────────────────────
  async function handleUpdateStl(params: SliderParams): Promise<string> {
    if (!session) throw new Error('No session')
    const data = await apiFetch<{ stl_url: string }>(
      '/api/update-relief', { session_id: session.sessionId, ...params },
    )
    return `${API}${data.stl_url}`
  }

  function handleRegenerate() {
    if (session) handleGenerate(session.prompt)
  }

  function handleStartOver() {
    setStep(1); setSession(null); setError(null); setLoading(false); setFlowMode('ai')
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
        <StepIndicator
          current={step}
          labels={flowMode === 'upload' ? UPLOAD_LABELS : undefined}
        />
      </div>

      {/* Error banner */}
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

      {/* Main content */}
      <main style={{ flex: 1, width: '100%', maxWidth: step === 4 ? '100%' : 960, margin: '0 auto' }}>

        {/* ── Step 1 ── */}
        {step === 1 && flowMode === 'ai' && (
          <PromptStep
            onGenerate={handleGenerate}
            loading={loading}
            onSwitchToUpload={() => setFlowMode('upload')}
          />
        )}
        {step === 1 && flowMode === 'upload' && (
          <UploadStep
            onUpload={handleUpload}
            onSwitchToAI={() => setFlowMode('ai')}
          />
        )}

        {/* ── Step 2 ── */}
        {step === 2 && flowMode === 'ai' && session && (
          <SelectStep
            key={session.sessionId}
            prompt={session.prompt}
            enhancedPrompt={session.enhancedPrompt}
            images={session.images}
            onSelect={handleSelectImage}
            onRegenerate={handleRegenerate}
            loading={loading}
          />
        )}
        {step === 2 && flowMode === 'upload' && session && (
          <EnhanceStep
            sessionId={session.sessionId}
            originalUrl={session.images[0]?.url ?? ''}
            subject={session.prompt}
            onComplete={handleEnhanceComplete}
          />
        )}

        {/* ── Step 3 (shared) ── */}
        {step === 3 && session && selectedImage && (
          <PreviewStep
            prompt={session.prompt}
            imageUrl={selectedImage.url}
            onCreateModel={handleCreateModel}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}

        {/* ── Step 4 (shared) ── */}
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
          <span>AI flow: gpt-image-1 via OpenAI</span>
          <span>·</span>
          <span>Upload flow: your image → AI enhance → 3D relief</span>
        </footer>
      )}
    </div>
  )
}
