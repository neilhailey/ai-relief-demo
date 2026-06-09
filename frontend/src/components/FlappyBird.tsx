import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LanguageContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const W            = 380
const H            = 520
const BIRD_X       = 85
const GRAVITY      = 0.40
const FLAP_VY      = -8.5
const PIPE_W       = 52
const PIPE_GAP     = 162   // vertical opening between pipes
const PIPE_SPEED   = 2.7
const SPAWN_EVERY  = 90    // frames between pipe spawns
const GROUND_H     = 55
const BIRD_R       = 11    // collision radius

// ── Types ─────────────────────────────────────────────────────────────────────
interface Pipe { x: number; gapCy: number; scored: boolean }

interface GS {
  birdY:   number
  birdVY:  number
  pipes:   Pipe[]
  score:   number
  frame:   number
  alive:   boolean
  started: boolean
}

function freshState(): GS {
  return { birdY: H / 2 - 20, birdVY: 0, pipes: [], score: 0, frame: 0, alive: false, started: false }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  jobProgress: number    // 0–100 for determinate; -1 for indeterminate (relief)
  statusText?: string    // override the label shown in the progress bar strip
  onClose:     () => void
}

export function FlappyBird({ jobProgress, statusText, onClose }: Props) {
  const { t }       = useLang()
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef(0)
  const gs          = useRef<GS>(freshState())
  const progressRef = useRef(jobProgress)
  const bestRef     = useRef(0)
  // Keep translated strings accessible inside the single-mount game loop
  const tRef        = useRef(t)

  const [best, setBest] = useState(0)

  // Keep progress and translations in sync without restarting the game loop
  useEffect(() => { progressRef.current = jobProgress }, [jobProgress])
  useEffect(() => { tRef.current = t }, [t])

  const flap = useCallback(() => {
    const s = gs.current
    if (!s.started || !s.alive) {
      const ns  = freshState()
      ns.started = true
      ns.alive   = true
      ns.birdVY  = FLAP_VY
      gs.current = ns
      return
    }
    s.birdVY = FLAP_VY
  }, [])

  // ── Game loop (single mount) ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    function collides(s: GS): boolean {
      if (s.birdY - BIRD_R < 0 || s.birdY + BIRD_R > H - GROUND_H) return true
      for (const p of s.pipes) {
        if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
          if (s.birdY - BIRD_R < p.gapCy - PIPE_GAP / 2) return true
          if (s.birdY + BIRD_R > p.gapCy + PIPE_GAP / 2) return true
        }
      }
      return false
    }

    function drawPipe(x: number, y: number, h: number, capAtBottom: boolean) {
      if (h <= 0) return
      const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
      g.addColorStop(0,   '#312e81')
      g.addColorStop(0.4, '#4f46e5')
      g.addColorStop(1,   '#1e1b4b')
      ctx.fillStyle = g
      ctx.fillRect(x, y, PIPE_W, h)
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,.09)'
      ctx.fillRect(x + 6, y, 7, h)
      // Cap
      ctx.fillStyle = '#818cf8'
      if (capAtBottom) ctx.fillRect(x - 4, y + h - 14, PIPE_W + 8, 14)
      else             ctx.fillRect(x - 4, y,           PIPE_W + 8, 14)
    }

    function loop() {
      const s        = gs.current
      const progress = progressRef.current

      // ── Update ──────────────────────────────────────────────────────────────
      if (s.alive && s.started) {
        s.frame++
        s.birdVY += GRAVITY
        s.birdY  += s.birdVY

        if (s.frame % SPAWN_EVERY === 0) {
          const minCy = 110
          const maxCy = H - GROUND_H - PIPE_GAP / 2 - 30
          s.pipes.push({ x: W + 10, gapCy: minCy + Math.random() * (maxCy - minCy), scored: false })
        }
        for (const p of s.pipes) {
          p.x -= PIPE_SPEED
          if (!p.scored && p.x + PIPE_W < BIRD_X) {
            p.scored = true
            s.score++
          }
        }
        s.pipes = s.pipes.filter(p => p.x > -PIPE_W - 10)

        if (collides(s)) {
          s.alive = false
          if (s.score > bestRef.current) {
            bestRef.current = s.score
            setBest(s.score)
          }
        }
      }

      // ── Draw ────────────────────────────────────────────────────────────────

      // Background
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#05080f')
      sky.addColorStop(1, '#0d1525')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Stars (static positions)
      ctx.fillStyle = 'rgba(255,255,255,.3)'
      for (let i = 0; i < 28; i++) {
        ctx.fillRect((i * 139 + 7) % W, (i * 233 + 19) % (H - GROUND_H), 1.5, 1.5)
      }

      // Pipes
      for (const p of s.pipes) {
        const topH = p.gapCy - PIPE_GAP / 2
        const botY = p.gapCy + PIPE_GAP / 2
        drawPipe(p.x, 0,    topH,               true)
        drawPipe(p.x, botY, H - GROUND_H - botY, false)
      }

      // Ground
      ctx.fillStyle = '#0e1520'
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H)
      ctx.fillStyle = '#1e2a3a'
      ctx.fillRect(0, H - GROUND_H, W, 2)
      // Scrolling ground detail
      ctx.fillStyle = 'rgba(255,255,255,.04)'
      for (let gx = ((s.frame * 1.6) % 48) - 48; gx < W; gx += 48) {
        ctx.fillRect(gx, H - GROUND_H, 24, 2)
      }

      // Bird
      ctx.save()
      ctx.translate(BIRD_X, s.birdY)
      ctx.rotate(Math.max(-0.5, Math.min(1.3, s.birdVY * 0.09)))

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,.22)'
      ctx.beginPath(); ctx.ellipse(2, 5, 14, 9, 0, 0, Math.PI * 2); ctx.fill()
      // Body
      ctx.fillStyle = '#f97316'
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); ctx.fill()
      // Wing
      ctx.fillStyle = '#fb923c'
      ctx.beginPath(); ctx.ellipse(-3, 3, 8, 5, -0.35, 0, Math.PI * 2); ctx.fill()
      // Belly
      ctx.fillStyle = '#fed7aa'
      ctx.beginPath(); ctx.ellipse(3, 3, 7, 4.5, 0.1, 0, Math.PI * 2); ctx.fill()
      // Eye
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(6, -3, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#0f172a'
      ctx.beginPath(); ctx.arc(7.5, -3, 2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(8.2, -4, 0.7, 0, Math.PI * 2); ctx.fill()
      // Beak
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.moveTo(13, -1); ctx.lineTo(20, 1); ctx.lineTo(13, 4)
      ctx.closePath(); ctx.fill()

      ctx.restore()

      // Score
      ctx.textAlign = 'center'
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,.55)'
      ctx.fillText(String(s.score), W / 2 + 1, 41)
      ctx.fillStyle = '#fff'
      ctx.fillText(String(s.score), W / 2, 40)

      // Progress bar strip (inside ground area)
      if (progress < 100) {
        const bx = 12, by = H - 42, bw = W - 24, bh = 16
        // Track background
        ctx.fillStyle = 'rgba(0,0,0,.5)'
        rr(ctx, bx, by, bw, bh, 4); ctx.fill()

        if (progress < 0) {
          // ── Indeterminate (relief generating — no % known) ──────────────
          ctx.fillStyle = '#4f46e5'
          rr(ctx, bx, by, bw, bh, 4); ctx.fill()
          // Animated shimmer sweep using wall-clock time
          const t = Date.now() / 1000
          const shineX = bx + ((t * 0.55) % 1.3) * (bw + 50) - 25
          const sg = ctx.createLinearGradient(shineX - 18, 0, shineX + 18, 0)
          sg.addColorStop(0,   'rgba(255,255,255,0)')
          sg.addColorStop(0.5, 'rgba(255,255,255,.28)')
          sg.addColorStop(1,   'rgba(255,255,255,0)')
          ctx.save()
          ctx.beginPath(); rr(ctx, bx, by, bw, bh, 4); ctx.clip()
          ctx.fillStyle = sg
          ctx.fillRect(bx, by, bw, bh)
          ctx.restore()
        } else {
          // ── Determinate (3D model — real %) ────────────────────────────
          ctx.fillStyle = '#4f46e5'
          rr(ctx, bx, by, Math.max(bw * progress / 100, bh), bh, 4); ctx.fill()
        }

        ctx.fillStyle = '#c7d2fe'
        ctx.font = '10px system-ui, sans-serif'
        const label = statusText
          ?? (progress < 0 ? tRef.current.flappyProgressRelief : tRef.current.flappyProgress3d(progress))
        ctx.fillText(label, W / 2, by + 11)
      }

      // ── Overlays ─────────────────────────────────────────────────────────────
      if (!s.started) {
        ctx.fillStyle = 'rgba(0,0,0,.62)'
        ctx.fillRect(0, 0, W, H)

        ctx.textAlign = 'center'
        ctx.fillStyle = '#f97316'
        ctx.font = 'bold 26px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyTitle, W / 2, H / 2 - 68)

        ctx.fillStyle = 'rgba(255,255,255,.45)'
        ctx.font = '13px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappySubtitle, W / 2, H / 2 - 40)

        ctx.fillStyle = 'rgba(99,102,241,.95)'
        rr(ctx, W / 2 - 82, H / 2 - 22, 164, 46, 10); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 17px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyStart, W / 2, H / 2 + 7)

        ctx.fillStyle = 'rgba(255,255,255,.28)'
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyTapHint, W / 2, H / 2 + 42)

      } else if (!s.alive) {
        ctx.fillStyle = 'rgba(0,0,0,.65)'
        ctx.fillRect(0, 0, W, H)

        ctx.textAlign = 'center'
        ctx.fillStyle = '#f87171'
        ctx.font = 'bold 32px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyGameOver, W / 2, H / 2 - 75)

        ctx.fillStyle = '#e2e8f0'
        ctx.font = '20px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyScore(s.score), W / 2, H / 2 - 38)

        if (s.score > 0 && s.score === bestRef.current) {
          ctx.fillStyle = '#fbbf24'
          ctx.font = 'bold 14px system-ui, sans-serif'
          ctx.fillText(tRef.current.flappyNewHigh, W / 2, H / 2 - 10)
        } else if (bestRef.current > 0) {
          ctx.fillStyle = 'rgba(255,255,255,.35)'
          ctx.font = '12px system-ui, sans-serif'
          ctx.fillText(tRef.current.flappyBest(bestRef.current), W / 2, H / 2 - 10)
        }

        ctx.fillStyle = 'rgba(99,102,241,.95)'
        rr(ctx, W / 2 - 82, H / 2 + 10, 164, 44, 10); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 16px system-ui, sans-serif'
        ctx.fillText(tRef.current.flappyPlayAgain, W / 2, H / 2 + 37)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // single mount — all mutable state lives in refs

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', gap: 14 }}>

      {/* Toolbar */}
      <div style={{ width: '100%', maxWidth: W, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 12px',
            color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer',
          }}
        >
          {t.back}
        </button>
        {best > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {t.flappyBestLabel} <strong style={{ color: '#a5b4fc' }}>{best}</strong>
          </span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={flap}
        onTouchStart={e => { e.preventDefault(); flap() }}
        style={{
          borderRadius: 12,
          cursor: 'pointer',
          display: 'block',
          maxWidth: '100%',
          border: '1px solid rgba(99,102,241,.3)',
          touchAction: 'none',
        }}
      />
    </div>
  )
}
