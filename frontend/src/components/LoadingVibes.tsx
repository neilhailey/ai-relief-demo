/**
 * Loading experience components for image generation and STL building.
 * Two guiding ideas:
 *   1. Give people something interesting to read — facts, context, progress.
 *   2. Make every second feel intentional, not like waiting for a server.
 */
import { useState, useEffect, CSSProperties } from 'react'

// ── Shared data ───────────────────────────────────────────────────────────────

const CARVING_FACTS = [
  'The earliest known bas-relief was carved 30,000 years ago in the Périgord caves of France.',
  'Ancient Egyptians covered entire temple walls floor-to-ceiling in carved narrative reliefs.',
  'A 1024 × 1024 px heightmap generates roughly 2 million triangles in your STL file.',
  "The word 'relief' comes from the Latin relevāre — 'to raise up'.",
  'The Parthenon frieze, carved in 447 BC, still defines the gold standard of bas-relief storytelling.',
  "V-bit carving follows the same principle as hand-gouging: the tool's angle controls wall slope.",
  'Your CNC machine removes material at ~10,000 RPM — a hand carver can manage maybe 10 cuts/min.',
  'Limewood and basswood are favourite CNC carving woods for their tight, consistent grain.',
  "Carving with the grain leaves clean edges; against it causes tear-out — your CAM software knows this.",
  'In Chinese art, a carved relief screen was both architecture and storytelling — a tradition 3,000 years old.',
  'Michelangelo said sculpture is simply the art of taking away — your CNC does exactly that.',
  "Your prompt was expanded into a richer sculpting brief before the AI saw it — that's why the detail is so good.",
]

const STL_TIPS = [
  'Set your CAM depth-of-cut to ~30 % of the relief height for clean passes.',
  "A 60° V-bit? Set draft angle to 30°. A 90° V-bit? Use 45°. They'll match perfectly.",
  'Roughing with a ⅛″ ball-nose, then finishing with a ⅛″ tapered ball-nose gives stunning detail.',
  'Carving cherry or walnut? Let the STL sit 24 h in your shop so the wood acclimates first.',
  'Climb-cutting on the finish pass reduces tear-out on figured grain.',
  "A 10 % stepover on the finish pass takes longer but the surface looks hand-carved.",
  'Sealing the carving with Danish oil before painting lets the grain show through beautifully.',
]

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Typewriter effect — replays whenever `text` changes. */
function useTypewriter(text: string, speed = 22): string {
  const [out, setOut] = useState('')
  useEffect(() => {
    setOut('')
    let i = 0
    const t = setInterval(() => {
      if (i <= text.length) { setOut(text.slice(0, i)); i++ }
      else clearInterval(t)
    }, speed)
    return () => clearInterval(t)
  }, [text, speed])
  return out
}

/** Cycle through an array on a fixed interval. */
function useRotating<T>(items: T[], ms: number): T {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), ms)
    return () => clearInterval(t)
  }, [items.length, ms])
  return items[idx]
}

/** Fake-but-believable progress: advance through checkpoints over time. */
function useProgress(checkpoints: [number, number][]): number {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const timers = checkpoints.map(([ms, p]) => setTimeout(() => setPct(p), ms))
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return pct
}

/** Stage index that advances on a timer. */
function useStages(afters: number[]): number {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const timers = afters.map((ms, i) => setTimeout(() => setStage(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return stage
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, style }: { pct: number; style?: CSSProperties }) {
  return (
    <div style={{
      width: '100%', height: 3,
      background: 'rgba(255,255,255,.06)',
      borderRadius: 2, overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'var(--accent)',
        borderRadius: 2,
        transition: 'width 1.6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  )
}

function FactCard({ fact }: { fact: string }) {
  return (
    <div style={{
      width: '100%', maxWidth: 440,
      padding: '12px 16px',
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 10,
      textAlign: 'left',
    }}>
      <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, letterSpacing: '.08em', marginBottom: 5 }}>
        DID YOU KNOW
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {fact}
      </div>
    </div>
  )
}

// ── Image generation loading (shown in PromptStep) ────────────────────────────

const IMG_STAGES = [
  { label: 'Expanding your prompt',          body: 'Crafting a rich sculpting brief from your idea…'   },
  { label: 'Briefing the AI artist',         body: 'Instructing the model on depth and composition…'   },
  { label: 'Rendering variation 1',          body: 'Generating the first interpretation at 1024 × 1024 px…' },
  { label: 'Rendering variation 2',          body: 'Taking a different creative angle on the same idea…' },
  { label: 'Finalising',                     body: 'Adding the last touches before handing over to you…' },
]
// Stage advances after these ms values
const IMG_STAGE_AFTERS = [2500, 6000, 11000, 18000]

// Progress bar checkpoints: [ms, pct]
const IMG_PROGRESS: [number, number][] = [
  [300, 5], [2500, 14], [6000, 28], [11000, 52], [16000, 72], [20000, 85], [24000, 92],
]

export function ImageGenLoading({ prompt }: { prompt: string }) {
  const stageIdx = useStages(IMG_STAGE_AFTERS)
  const progress = useProgress(IMG_PROGRESS)
  const fact     = useRotating(CARVING_FACTS, 6000)

  const stage = IMG_STAGES[Math.min(stageIdx, IMG_STAGES.length - 1)]
  const typed = useTypewriter(stage.body, 20)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 28, padding: '40px 24px', width: '100%', maxWidth: 520,
    }}>

      {/* Stage name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px',
          background: 'rgba(249,115,22,.12)',
          border: '1px solid rgba(249,115,22,.25)',
          borderRadius: 20,
          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
          letterSpacing: '.06em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          <PulsingDot /> {stage.label}
        </div>

        <div style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.7, minHeight: '3.4em' }}>
          {typed}<span style={{ opacity: 0.4 }}>▌</span>
        </div>
      </div>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {IMG_STAGES.map((s, i) => (
          <div key={s.label} style={{
            width: i === stageIdx ? 20 : 7,
            height: 7,
            borderRadius: 4,
            background: i < stageIdx
              ? 'var(--accent)'
              : i === stageIdx
              ? 'var(--accent)'
              : 'rgba(255,255,255,.12)',
            transition: 'all .4s ease',
            opacity: i > stageIdx ? 0.4 : 1,
          }} />
        ))}
      </div>

      {/* Progress bar */}
      <ProgressBar pct={progress} style={{ maxWidth: 440 }} />

      {/* Prompt shown as context */}
      <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
        "{prompt}"
      </div>

      {/* Fact card */}
      <FactCard fact={fact} />

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        usually 20–30 s
      </div>
    </div>
  )
}

// ── 3D model building overlay (shown in ReliefStep) ───────────────────────────

const STL_STAGES = [
  'Processing heightmap',
  'Applying V-bit draft angles',
  'Building mesh triangles',
  'Constructing walls & base',
  'Writing STL file',
]
const STL_STAGE_AFTERS = [4000, 9000, 16000, 23000]

const STL_PROGRESS: [number, number][] = [
  [500, 6], [4000, 20], [9000, 42], [14000, 61], [19000, 78], [24000, 89], [28000, 94],
]

export function ModelBuildingOverlay() {
  const stageIdx = useStages(STL_STAGE_AFTERS)
  const progress = useProgress(STL_PROGRESS)
  const tip      = useRotating([...CARVING_FACTS, ...STL_TIPS], 7000)

  const activeLabel = STL_STAGES[Math.min(stageIdx, STL_STAGES.length - 1)]
  const typed = useTypewriter(activeLabel, 28)

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
      background: 'rgba(10,13,18,.94)',
      backdropFilter: 'blur(4px)',
      pointerEvents: 'none',
      zIndex: 20,
      padding: '24px 32px',
    }}>
      {/* Spinner */}
      <div style={{
        width: 48, height: 48,
        borderRadius: '50%',
        border: '3px solid rgba(249,115,22,.15)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.9s linear infinite',
        flexShrink: 0,
      }} />

      {/* Active stage typewriter */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, minHeight: '1.4em' }}>
          {typed}<span style={{ opacity: 0.35 }}>▌</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Building your 3D relief
        </div>
      </div>

      {/* Stage checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 220 }}>
        {STL_STAGES.map((s, i) => {
          const done   = i < stageIdx
          const active = i === stageIdx
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: i > stageIdx ? 0.3 : 1,
              transition: 'opacity .4s',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${done ? 'var(--accent)' : active ? 'var(--accent)' : 'rgba(255,255,255,.2)'}`,
                background: done ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: active ? 'spin 1.2s linear infinite' : 'none',
              }}>
                {done && <span style={{ fontSize: 8, color: '#000', fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{
                fontSize: 11,
                color: done ? 'var(--accent)' : active ? 'var(--text)' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
              }}>
                {s}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <ProgressBar pct={progress} style={{ maxWidth: 240 }} />

      {/* Fact / tip */}
      <div style={{
        maxWidth: 260, textAlign: 'center',
        fontSize: 11, color: 'var(--muted)',
        lineHeight: 1.6, fontStyle: 'italic',
        borderTop: '1px solid rgba(255,255,255,.06)',
        paddingTop: 14,
      }}>
        {tip}
      </div>
    </div>
  )
}

// ── Heightmap + STL generation loading (shown in PreviewStep) ─────────────────

const HM_STAGES = [
  { label: 'Analysing your image',   body: 'Studying the selected design to understand structure and depth…'      },
  { label: 'Generating depth map',   body: 'AI is interpreting the image as a 3-D surface — the slow magic step…' },
  { label: 'Building mesh geometry', body: 'Converting depth data into roughly 2 million mesh triangles…'          },
  { label: 'Applying draft angles',  body: 'Tilting edges to match your V-bit so the cut follows every contour…'  },
  { label: 'Finalising STL',         body: 'Sealing the solid base and writing the binary STL file…'              },
]
const HM_STAGE_AFTERS = [3500, 9000, 23000, 30000]

const HM_PROGRESS: [number, number][] = [
  [400, 4], [3500, 12], [9000, 30], [18000, 52], [25000, 68], [32000, 82], [38000, 91],
]

export function HeightmapGenLoading({ prompt }: { prompt: string }) {
  const stageIdx = useStages(HM_STAGE_AFTERS)
  const progress = useProgress(HM_PROGRESS)
  const fact     = useRotating(CARVING_FACTS, 6500)

  const stage = HM_STAGES[Math.min(stageIdx, HM_STAGES.length - 1)]
  const typed = useTypewriter(stage.body, 20)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 28, padding: '40px 24px', width: '100%', maxWidth: 520,
    }}>

      {/* Stage badge + typewriter */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px',
          background: 'rgba(249,115,22,.12)',
          border: '1px solid rgba(249,115,22,.25)',
          borderRadius: 20,
          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
          letterSpacing: '.06em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          <PulsingDot /> {stage.label}
        </div>

        <div style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.7, minHeight: '3.4em' }}>
          {typed}<span style={{ opacity: 0.4 }}>▌</span>
        </div>
      </div>

      {/* Stage checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
        {HM_STAGES.map((s, i) => {
          const done   = i < stageIdx
          const active = i === stageIdx
          return (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: i > stageIdx ? 0.3 : 1,
              transition: 'opacity .4s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${done || active ? 'var(--accent)' : 'rgba(255,255,255,.2)'}`,
                background: done ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: active ? 'spin 1.2s linear infinite' : 'none',
              }}>
                {done && <span style={{ fontSize: 8, color: '#000', fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{
                fontSize: 12,
                color: done ? 'var(--accent)' : active ? 'var(--text)' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
              }}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <ProgressBar pct={progress} style={{ maxWidth: 440 }} />

      {/* Prompt as context */}
      <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
        "{prompt}"
      </div>

      {/* Fact card */}
      <FactCard fact={fact} />

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        usually 30–50 s
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: 'var(--accent)',
      animation: 'pulse-dot 1.4s ease-in-out infinite',
    }} />
  )
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('loading-vibes-style')) {
  const s = document.createElement('style')
  s.id = 'loading-vibes-style'
  s.textContent = `
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50%       { transform: scale(1.6); opacity: .5; }
    }
  `
  document.head.appendChild(s)
}
