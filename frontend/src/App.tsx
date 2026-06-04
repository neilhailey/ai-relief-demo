/// <reference types="vite/client" />
import { useState, useEffect } from 'react'
import type { SessionState, Creation, BackgroundJob } from './types'
import type { User } from '@supabase/supabase-js'
import { supabase, saveCreation, loadCreations, uploadDataUrl } from './lib/supabase'
import { AuthModal } from './components/AuthModal'
import { StepIndicator, UPLOAD_LABELS, MODEL3D_LABELS } from './components/StepIndicator'
import { PromptStep } from './components/PromptStep'
import { UploadStep } from './components/UploadStep'
import { SelectStep, ImageOption } from './components/SelectStep'
import { EnhanceStep } from './components/EnhanceStep'
import { PreviewStep } from './components/PreviewStep'
import { ReliefStep, SliderParams } from './components/ReliefStep'
import { Model3dPromptStep } from './components/Model3dPromptStep'
import { Model3dGeneratingStep } from './components/Model3dGeneratingStep'
import { Model3dResultStep } from './components/Model3dResultStep'
import { RecentPanel } from './components/RecentPanel'
import { FlappyBird } from './components/FlappyBird'

type Step     = 1 | 2 | 3 | 4
type FlowMode = 'ai' | 'upload' | 'model3d'

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
  const [step,      setStep]      = useState<Step>(1)
  const [flowMode,  setFlowMode]  = useState<FlowMode>('ai')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [session,   setSession]   = useState<SessionState | null>(null)

  // ── Background 3D job + recent creations ─────────────────────────────────
  const [bgJob,     setBgJob]     = useState<BackgroundJob | null>(null)
  const [creations, setCreations] = useState<Creation[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [showGame,  setShowGame]  = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user,      setUser]      = useState<User | null>(null)
  const [showAuth,  setShowAuth]  = useState(false)

  useEffect(() => {
    if (!supabase) return
    // Restore session on load
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Reload DB creations when user signs in
        loadCreations().then(rows => {
          setCreations(rows.map(r => ({
            id:       r.id,
            type:     r.type,
            prompt:   r.prompt,
            flowMode: r.flow_mode as FlowMode,
            thumbnail: r.thumbnail ?? null,
            session:  (r.session ?? {}) as unknown as SessionState,
          })))
        })
      } else {
        setCreations([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function persistCreation(c: Creation) {
    if (!user) return
    const uid = Math.random().toString(36).slice(2, 8)
    // Upload thumbnail to Supabase Storage if it's a data URL
    let thumbUrl = c.thumbnail
    if (thumbUrl && thumbUrl.startsWith('data:')) {
      const ext = thumbUrl.startsWith('data:image/webp') ? 'webp' : 'png'
      const ct  = ext === 'webp' ? 'image/webp' : 'image/png'
      thumbUrl = await uploadDataUrl(thumbUrl, `thumbnails/${uid}.${ext}`, ct) ?? thumbUrl
    }
    await saveCreation({
      type:      c.type,
      flow_mode: c.flowMode,
      prompt:    c.prompt,
      thumbnail: thumbUrl,
      glb_url:   c.session.glbUrl ?? null,
      stl_url:   c.session.stlUrl ?? null,
      session:   c.session as unknown as Record<string, unknown>,
    })
  }

  function addCreation(c: Omit<Creation, 'id'>) {
    const entry: Creation = { ...c, id: Math.random().toString(36).slice(2, 8) }
    setCreations(prev => [entry, ...prev].slice(0, 20))
    // Persist to DB in background if signed in
    void persistCreation(entry)
  }

  function handleSelectCreation(id: string) {
    const c = creations.find(x => x.id === id)
    if (!c) return
    setSession(c.session)
    setFlowMode(c.flowMode)
    setStep(4)
    setShowPanel(false)
  }

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
        selectedIndex:  null, heightmapUrl: null, stlUrl: null,
        glbUrl:         null, renderedUrl:  null,
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
      heightmapUrl:   null, stlUrl:      null,
      glbUrl:         null, renderedUrl: null,
    })
    setStep(2)
  }

  // ── 3D model flow: submit job + poll in background ───────────────────────
  async function handleGenerate3d(prompt: string) {
    setLoading(true); setError(null)
    try {
      const { job_id } = await apiFetch<{ job_id: string }>('/api/generate-3d', { prompt })
      setBgJob({ jobId: job_id, prompt, status: 'running', tripoStatus: 'queued', progress: 0, result: null, error: null })
      // kick off background polling — does NOT block navigation
      void pollJobBackground(job_id, prompt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)   // releases navigation immediately after job is queued
    }
  }

  async function pollJobBackground(jobId: string, prompt: string) {
    // Track when Tripo finishes generating so we can timeout if the backend
    // gets stuck post-generation (e.g. old code downloading a huge GLB).
    let tripoSucceededAt: number | null = null

    while (true) {
      await new Promise<void>(r => setTimeout(r, 4000))
      try {
        const res = await fetch(`${API}/api/generate-3d/status/${jobId}`)
        if (!res.ok) {
          // 404 = server restarted and lost the in-memory job — surface as failure
          if (res.status === 404) {
            setBgJob(j => j?.jobId === jobId
              ? { ...j, status: 'failed', error: 'Server restarted — please try again' }
              : j
            )
            break
          }
          continue   // other transient errors — keep polling
        }
        const job = await res.json() as {
          status:       string
          tripo_status: string
          progress:     number
          session_id:   string | null
          glb_url:      string | null
          rendered_url: string | null
          error:        string | null
        }

        // Record when Tripo first reports success so we can timeout post-gen stalls
        if (job.tripo_status === 'success' && tripoSucceededAt === null)
          tripoSucceededAt = Date.now()

        // If backend is stuck post-generation for > 3 min, give up
        if (tripoSucceededAt && Date.now() - tripoSucceededAt > 3 * 60_000) {
          setBgJob(j => j?.jobId === jobId
            ? { ...j, status: 'failed', error: 'Timed out waiting for server — please try again' }
            : j
          )
          break
        }

        // update progress + Tripo phase for the floating indicator
        setBgJob(j => j?.jobId === jobId
          ? { ...j, progress: job.progress ?? 0, tripoStatus: job.tripo_status ?? 'queued' }
          : j
        )

        if (job.status === 'success' && job.session_id && job.glb_url) {
          // GLB URL: Tripo CDN URL (absolute) survives server restarts
          const glbUrl = job.glb_url.startsWith('http')
            ? job.glb_url
            : `${API}${job.glb_url}`

          const newSession: SessionState = {
            sessionId:      job.session_id,
            prompt,
            enhancedPrompt: prompt,
            images:         [],
            selectedIndex:  null,
            heightmapUrl:   null,
            stlUrl:         null,
            glbUrl,
            renderedUrl:    job.rendered_url ?? null,
          }
          setBgJob(j => j?.jobId === jobId
            ? { ...j, status: 'done', progress: 100, result: newSession }
            : j
          )
          addCreation({
            type: 'model3d', prompt, flowMode: 'model3d',
            thumbnail: job.rendered_url ?? null,
            session: newSession,
          })
          break
        }
        if (job.status === 'failed') {
          setBgJob(j => j?.jobId === jobId
            ? { ...j, status: 'failed', error: job.error ?? '3D generation failed' }
            : j
          )
          break
        }
      } catch { /* network hiccup — keep polling */ }
    }
  }

  function viewBgJobResult() {
    if (!bgJob?.result) return
    setSession(bgJob.result)
    setFlowMode('model3d')
    setStep(4)
    setBgJob(null)
  }

  // ── Upload flow: Step 2 → 3 ──────────────────────────────────────────────
  function handleEnhanceComplete(imageUrl: string, subject: string, imageIndex: number) {
    setSession(s => {
      if (!s) return s
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

  // ── Step 3 → 4: generate heightmap + STL ────────────────────────────────
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
      const selectedImg = session.images.find(i => i.index === session.selectedIndex)
      const updatedSession: SessionState = {
        ...session,
        heightmapUrl: data.heightmap_url,
        stlUrl:       `${API}${data.stl_url}`,
      }
      setSession(updatedSession)
      addCreation({
        type:      'relief',
        prompt:    session.prompt,
        flowMode,
        thumbnail: data.heightmap_url,             // heightmap as the card thumbnail
        session:   updatedSession,
      })
      void selectedImg   // suppress unused-var lint
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

        {/* Right side: auth + recent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Auth button */}
          {supabase && (
            user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </span>
                <button
                  onClick={() => supabase?.auth.signOut()}
                  style={{
                    padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
                  }}
                >Sign out</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                  background: 'var(--accent)', border: 'none',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}
              >Sign in</button>
            )
          )}

        {/* Recent creations button */}
        {creations.length > 0 && (
          <button
            onClick={() => setShowPanel(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 12px',
              background: showPanel ? 'rgba(249,115,22,.15)' : 'var(--surface2)',
              border: `1px solid ${showPanel ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 20, cursor: 'pointer',
              transition: 'all .2s',
            }}
          >
            <span style={{ fontSize: 13 }}>🕐</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: showPanel ? 'var(--accent)' : 'var(--text-dim)' }}>
              Recent
            </span>
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              {creations.length}
            </span>
          </button>
        )}
        </div>{/* end right side */}
      </header>

      {/* Step indicator — advance visually through 3D model steps during background job */}
      {(() => {
        let displayStep = step
        if (flowMode === 'model3d' && bgJob) {
          displayStep =
            bgJob.status === 'done'                 ? 4 :
            bgJob.tripoStatus === 'success'         ? 3 :
            bgJob.status === 'running'              ? 2 :
            step
        }
        return (
          <div style={{ flexShrink: 0, maxWidth: 900, width: '100%', margin: '0 auto' }}>
            <StepIndicator
              current={displayStep as Step}
              labels={
                flowMode === 'upload'  ? UPLOAD_LABELS  :
                flowMode === 'model3d' ? MODEL3D_LABELS :
                undefined
              }
            />
          </div>
        )
      })()}

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

        {/* ── Flappy Bird (while 3D model runs OR while relief generates) ── */}
        {(() => {
          const reliefRunning = loading && step === 3 && flowMode !== 'model3d'
          const gameActive    = showGame && (bgJob?.status === 'running' || reliefRunning)
          if (gameActive) {
            return (
              <FlappyBird
                jobProgress={reliefRunning ? -1 : (bgJob?.progress ?? 0)}
                statusText={reliefRunning ? '◈  Generating 3D relief…' : undefined}
                onClose={() => setShowGame(false)}
              />
            )
          }
          return (<>

        {/* ── Step 1: flow-mode card picker ── */}
        {step === 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 14,
            padding: '24px 24px 0', flexWrap: 'wrap',
          }}>
            {([
              {
                mode:   'ai'      as const,
                label:  'AI Relief',
                desc:   'Describe anything — AI generates an image then carves it into a flat relief panel',
                img:    '/tab-relief.jpg',
                accent: 'var(--accent)',
                glow:   'rgba(249,115,22,.18)',
                border: 'rgba(249,115,22,.6)',
              },
              {
                mode:   'upload'  as const,
                label:  'Upload Image',
                desc:   'Use your own photo or artwork — AI enhances it then converts to a carved relief',
                img:    '/tab-upload.jpg',
                accent: 'var(--accent)',
                glow:   'rgba(249,115,22,.18)',
                border: 'rgba(249,115,22,.6)',
              },
              {
                mode:   'model3d' as const,
                label:  'Full 3D Model',
                desc:   'Describe any object — AI builds a complete 3D mesh for rotary CNC or printing',
                img:    '/tab-model3d.jpg',
                accent: '#a5b4fc',
                glow:   'rgba(99,102,241,.18)',
                border: 'rgba(99,102,241,.6)',
              },
            ]).map(({ mode, label, desc, img, accent, glow, border }) => {
              const active = flowMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => !loading && setFlowMode(mode)}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = border
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                  }}
                  style={{
                    width: 210, padding: 0, textAlign: 'left',
                    background: active ? glow : 'var(--surface)',
                    border: `2px solid ${active ? border : 'var(--border)'}`,
                    borderRadius: 12, overflow: 'hidden',
                    cursor: loading ? 'default' : 'pointer',
                    transition: 'border-color .2s, background .2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', paddingTop: '70%' }}>
                    <img
                      src={img} alt={label}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        opacity: active ? 1 : 0.65,
                        transition: 'opacity .2s',
                      }}
                    />
                    {active && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 22, height: 22, borderRadius: '50%',
                        background: accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,.5)',
                      }}>✓</div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? accent : 'var(--text)', marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Step 1 forms ── */}
        {step === 1 && flowMode === 'ai' && (
          <PromptStep onGenerate={handleGenerate} loading={loading} onSwitchToUpload={() => setFlowMode('upload')} />
        )}
        {step === 1 && flowMode === 'upload' && (
          <UploadStep onUpload={handleUpload} onSwitchToAI={() => setFlowMode('ai')} />
        )}
        {step === 1 && flowMode === 'model3d' && !bgJob && (
          <Model3dPromptStep onGenerate={handleGenerate3d} loading={loading} onSwitchToAI={() => setFlowMode('ai')} />
        )}
        {step === 1 && flowMode === 'model3d' && bgJob && (
          <Model3dGeneratingStep
            prompt={bgJob.prompt}
            status={bgJob.status}
            tripoStatus={bgJob.tripoStatus}
            progress={bgJob.progress}
            error={bgJob.error}
            onView={viewBgJobResult}
            onPlayGame={() => setShowGame(true)}
            onCancel={() => { setBgJob(null); setShowGame(false) }}
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

        {/* ── Step 4: relief ── */}
        {step === 4 && flowMode !== 'model3d' && session && session.heightmapUrl && session.stlUrl && selectedImage && (
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

        {/* ── Step 4: 3D model ── */}
        {step === 4 && flowMode === 'model3d' && session && session.glbUrl && (
          <Model3dResultStep
            prompt={session.prompt}
            glbUrl={session.glbUrl}
            renderedUrl={session.renderedUrl ?? undefined}
            sessionId={session.sessionId}
            onStartOver={handleStartOver}
          />
        )}

          </>)
        })()}
      </main>

      {step !== 4 && (
        <footer style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--muted)',
          display: 'flex', justifyContent: 'center', gap: 20,
          flexShrink: 0,
        }}>
          <span>Relief: gpt-image-1 via OpenAI</span>
          <span>·</span>
          <span>3D Model: Tripo3D v2.5</span>
          <span>·</span>
          <span>Upload: your image → AI enhance → relief</span>
        </footer>
      )}

      {/* ── Background 3D job floating indicator ──
           Hidden when the dedicated generating view is already shown
           (step 1 + model3d flow) to avoid showing the same info twice. */}
      {bgJob && !(step === 1 && flowMode === 'model3d') && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '12px 16px',
          background: 'rgba(15,18,24,.95)',
          border: `1px solid ${bgJob.status === 'done' ? 'rgba(5,150,105,.5)' : bgJob.status === 'failed' ? 'rgba(239,68,68,.5)' : 'rgba(99,102,241,.4)'}`,
          borderRadius: 12,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          zIndex: 50,
          minWidth: 300, maxWidth: 380,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
              {bgJob.status === 'running' && (
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: '2px solid rgba(99,102,241,.3)', borderTopColor: '#818cf8',
                  animation: 'spin 0.8s linear infinite', display: 'inline-block',
                }} />
              )}
              {bgJob.status === 'done'    && <span style={{ fontSize: 15, flexShrink: 0 }}>✓</span>}
              {bgJob.status === 'failed'  && <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>}

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: bgJob.status === 'done' ? 'var(--green)' : bgJob.status === 'failed' ? '#fca5a5' : '#a5b4fc',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {bgJob.status === 'running' && (
                    bgJob.tripoStatus === 'queued'   ? 'Queued in Tripo…' :
                    bgJob.tripoStatus === 'success'  ? 'Converting mesh…' :
                    `Generating 3D model… ${bgJob.progress}%`
                  )}
                  {bgJob.status === 'done'    && '3D model ready!'}
                  {bgJob.status === 'failed'  && '3D model failed'}
                </div>
                <div style={{
                  fontSize: 10, color: 'var(--muted)', marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {bgJob.status === 'failed' && bgJob.error
                    ? bgJob.error
                    : `"${bgJob.prompt}"`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {bgJob.status === 'running' && (
                <button
                  onClick={() => setShowGame(s => !s)}
                  title="Play while you wait"
                  style={{
                    padding: '5px 10px',
                    background: showGame ? 'rgba(99,102,241,.5)' : 'rgba(99,102,241,.25)',
                    border: '1px solid rgba(148,151,248,.7)',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    color: '#e0e7ff',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>🎮</span>
                  <span>Play</span>
                </button>
              )}
              {bgJob.status === 'done' && (
                <button
                  onClick={viewBgJobResult}
                  style={{
                    padding: '5px 12px',
                    background: 'rgba(5,150,105,.2)',
                    border: '1px solid rgba(5,150,105,.4)',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, color: 'var(--green)',
                  }}
                >
                  View →
                </button>
              )}
              <button
                onClick={() => setBgJob(null)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--muted)', fontSize: 16,
                  cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
                }}
              >✕</button>
            </div>
          </div>

          {/* Progress bar — only while running */}
          {bgJob.status === 'running' && (
            <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${bgJob.progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                borderRadius: 2,
                transition: 'width 1.5s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* ── Relief-loading floating play button ── */}
      {loading && step === 3 && flowMode !== 'model3d' && !showGame && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          background: 'rgba(15,18,24,.95)',
          border: '1px solid rgba(249,115,22,.4)',
          borderRadius: 12,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          zIndex: 50,
        }}>
          {/* Spinner */}
          <span style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            border: '2px solid rgba(249,115,22,.25)', borderTopColor: '#f97316',
            animation: 'spin 0.8s linear infinite', display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fdba74', whiteSpace: 'nowrap' }}>
            Generating 3D relief…
          </span>
          <button
            onClick={() => setShowGame(true)}
            style={{
              padding: '5px 12px',
              background: 'rgba(249,115,22,.25)',
              border: '1px solid rgba(251,146,60,.7)',
              borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#fed7aa',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 14 }}>🎮</span>
            <span>Play while you wait</span>
          </button>
        </div>
      )}

      {/* ── Recent creations panel ── */}
      {showPanel && (
        <RecentPanel
          creations={creations}
          onSelect={handleSelectCreation}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* ── Auth modal ── */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}

    </div>
  )
}
