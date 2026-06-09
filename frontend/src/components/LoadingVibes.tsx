/**
 * Loading experience components for image generation and STL building.
 * Two guiding ideas:
 *   1. Give people something interesting to read — facts, context, progress.
 *   2. Make every second feel intentional, not like waiting for a server.
 */
import { useState, useEffect, CSSProperties } from 'react'
import { useLang } from '../contexts/LanguageContext'

// ── Shared data (language-indexed) ───────────────────────────────────────────

const CARVING_FACTS_EN = [
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
const CARVING_FACTS_ZH = [
  '最早的已知浅浮雕雕刻于 3 万年前的法国佩里戈尔洞穴中。',
  '古埃及人曾将整面神庙墙壁从地板雕刻到天花板，布满叙事浮雕。',
  '1024 × 1024 像素的高度图约可生成 200 万个三角面，构成你的 STL 文件。',
  '"浮雕"一词源自拉丁语 relevāre，意为"抬起"。',
  '帕台农神庙浮雕带雕刻于公元前 447 年，至今仍是浅浮雕叙事艺术的黄金标准。',
  'V 型雕刻刀的原理与手工凿刻相同：刀具角度决定壁面坡度。',
  '你的 CNC 机器以约 10,000 转/分钟去除材料——手工雕刻者每分钟最多只能完成约 10 刀。',
  '椴木和美国白椴木因纹理细腻均匀，是 CNC 雕刻的常用木材。',
  '顺纹雕刻边缘整洁，逆纹则容易撕裂——你的 CAM 软件深知这一点。',
  '在中国艺术中，雕刻屏风既是建筑构件也是叙事载体，这一传统已有 3000 年历史。',
  '米开朗基罗说，雕塑不过是去除多余部分的艺术——你的 CNC 正是如此。',
  '你的提示词在 AI 看到之前已被扩展为更丰富的雕塑描述——这就是细节如此精彩的原因。',
]

const STL_TIPS_EN = [
  'Set your CAM depth-of-cut to ~30 % of the relief height for clean passes.',
  "A 60° V-bit? Set draft angle to 30°. A 90° V-bit? Use 45°. They'll match perfectly.",
  'Roughing with a ⅛″ ball-nose, then finishing with a ⅛″ tapered ball-nose gives stunning detail.',
  'Carving cherry or walnut? Let the STL sit 24 h in your shop so the wood acclimates first.',
  'Climb-cutting on the finish pass reduces tear-out on figured grain.',
  "A 10 % stepover on the finish pass takes longer but the surface looks hand-carved.",
  'Sealing the carving with Danish oil before painting lets the grain show through beautifully.',
]
const STL_TIPS_ZH = [
  '将 CAM 的切削深度设为浮雕高度的约 30%，可获得干净的加工路径。',
  '60° V 型刀？将倾角设为 30°。90° V 型刀？使用 45°。它们将完美匹配。',
  '用 ⅛" 球头刀粗加工，再用 ⅛" 锥形球头刀精加工，细节效果惊艳。',
  '雕刻樱桃木或胡桃木？请将 STL 文件在工作室中放置 24 小时，让木材适应环境。',
  '精加工时采用顺铣走刀，可减少纹理木材的撕裂。',
  '精加工的步距设为 10% 需要更长时间，但表面效果宛如手工雕刻。',
  '雕刻前用丹麦油封底，再上漆，木纹会透过漆面显现，效果绝美。',
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

function FactCard({ fact, label }: { fact: string; label: string }) {
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
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {fact}
      </div>
    </div>
  )
}

// ── Image generation loading (shown in PromptStep) ────────────────────────────

const IMG_STAGES_EN = [
  { label: 'Expanding your prompt',          body: 'Crafting a rich sculpting brief from your idea…'        },
  { label: 'Briefing the AI artist',         body: 'Instructing the model on depth and composition…'        },
  { label: 'Rendering variation 1',          body: 'Generating the first interpretation at 1024 × 1024 px…' },
  { label: 'Rendering variation 2',          body: 'Taking a different creative angle on the same idea…'    },
  { label: 'Finalising',                     body: 'Adding the last touches before handing over to you…'    },
]
const IMG_STAGES_ZH = [
  { label: '扩展提示词',   body: '从你的想法中提炼出丰富的雕塑描述…'         },
  { label: '指导 AI 艺术家', body: '指示模型关注深度与构图…'              },
  { label: '渲染变体 1',   body: '正在以 1024 × 1024 像素生成第一个版本…' },
  { label: '渲染变体 2',   body: '从不同创意角度诠释同一想法…'             },
  { label: '最终处理',     body: '添加最后润色，即将交付给你…'             },
]

// Stage advances after these ms values
const IMG_STAGE_AFTERS = [2500, 6000, 11000, 18000]

// Progress bar checkpoints: [ms, pct]
const IMG_PROGRESS: [number, number][] = [
  [300, 5], [2500, 14], [6000, 28], [11000, 52], [16000, 72], [20000, 85], [24000, 92],
]

export function ImageGenLoading({ prompt }: { prompt: string }) {
  const { lang, t } = useLang()
  const IMG_STAGES  = lang === 'zh' ? IMG_STAGES_ZH : IMG_STAGES_EN
  const CARVING_FACTS = lang === 'zh' ? CARVING_FACTS_ZH : CARVING_FACTS_EN

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
      <FactCard fact={fact} label={t.didYouKnow} />

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        {t.imgLoadUsually}
      </div>
    </div>
  )
}

// ── 3D model building overlay (shown in ReliefStep) ───────────────────────────

const STL_STAGES_EN = [
  'Processing heightmap',
  'Applying V-bit draft angles',
  'Building mesh triangles',
  'Constructing walls & base',
  'Writing STL file',
]
const STL_STAGES_ZH = [
  '处理高度图',
  '应用 V 型刀具倾角',
  '构建网格三角面',
  '构建壁面与底座',
  '写入 STL 文件',
]
const STL_STAGE_AFTERS = [4000, 9000, 16000, 23000]

const STL_PROGRESS: [number, number][] = [
  [500, 6], [4000, 20], [9000, 42], [14000, 61], [19000, 78], [24000, 89], [28000, 94],
]

export function ModelBuildingOverlay() {
  const { lang, t } = useLang()
  const STL_STAGES    = lang === 'zh' ? STL_STAGES_ZH : STL_STAGES_EN
  const CARVING_FACTS = lang === 'zh' ? CARVING_FACTS_ZH : CARVING_FACTS_EN
  const STL_TIPS      = lang === 'zh' ? STL_TIPS_ZH : STL_TIPS_EN

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
          {t.buildingRelief}
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

const HM_STAGES_EN = [
  { label: 'Analysing your image',   body: 'Studying the selected design to understand structure and depth…'       },
  { label: 'Generating depth map',   body: 'AI is interpreting the image as a 3-D surface — the slow magic step…' },
  { label: 'Building mesh geometry', body: 'Converting depth data into roughly 2 million mesh triangles…'           },
  { label: 'Applying draft angles',  body: 'Tilting edges to match your V-bit so the cut follows every contour…'   },
  { label: 'Finalising STL',         body: 'Sealing the solid base and writing the binary STL file…'               },
]
const HM_STAGES_ZH = [
  { label: '分析图像',     body: '研究所选设计，理解结构与深度…'                },
  { label: '生成深度图',   body: 'AI 正在将图像解析为 3D 表面——这是最慢的魔法步骤…' },
  { label: '构建网格几何体', body: '将深度数据转换为约 200 万个网格三角面…'           },
  { label: '应用倾斜角',   body: '倾斜边缘以匹配 V 型刀具，使切割与每个轮廓完美贴合…' },
  { label: '最终处理 STL', body: '封闭实心底座并写入二进制 STL 文件…'              },
]
const HM_STAGE_AFTERS = [3500, 9000, 23000, 30000]

const HM_PROGRESS: [number, number][] = [
  [400, 4], [3500, 12], [9000, 30], [18000, 52], [25000, 68], [32000, 82], [38000, 91],
]

export function HeightmapGenLoading({ prompt }: { prompt: string }) {
  const { lang, t } = useLang()
  const HM_STAGES     = lang === 'zh' ? HM_STAGES_ZH : HM_STAGES_EN
  const CARVING_FACTS = lang === 'zh' ? CARVING_FACTS_ZH : CARVING_FACTS_EN

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
      <FactCard fact={fact} label={t.didYouKnow} />

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        {t.hmLoadUsually}
      </div>
    </div>
  )
}

// ── Full 3D model generation loading (shown in Model3dPromptStep) ─────────────

const MESH_FACTS_EN = [
  'Tripo3D generates roughly 50,000–200,000 triangles per model — more than most hand-sculpted assets.',
  'A GLB file bundles geometry, textures, and materials in one compact binary package.',
  'PBR (Physically Based Rendering) materials simulate how light interacts with surfaces in the real world.',
  '4-axis CNC lets you carve all the way around an object — perfect for full 3D models.',
  'Splitting a 3D model at the widest point and carving two halves is the classic 3-axis workaround.',
  'Relief carving removes material from a flat surface; 3D carving removes it from all directions.',
  'Modern AI generates a complete UV-mapped mesh in under 90 seconds — a task that once took artists days.',
  'GLB files open directly in Blender, Fusion 360, and most slicer software for 3D printers.',
]
const MESH_FACTS_ZH = [
  'Tripo3D 每个模型约生成 50,000–200,000 个三角面——超过大多数手工雕塑资产。',
  'GLB 文件将几何体、纹理和材质打包为一个紧凑的二进制包。',
  'PBR（基于物理的渲染）材质可模拟光线与现实世界表面的交互方式。',
  '4 轴 CNC 允许你围绕物体进行全向雕刻——非常适合完整的 3D 模型。',
  '在最宽处将 3D 模型分割，分两半雕刻，是 3 轴机器的经典解决方案。',
  '浮雕从平面上去除材料；3D 雕刻则从各个方向去除材料。',
  '现代 AI 可在 90 秒内生成完整 UV 映射网格——这项工作曾需要艺术家数天时间。',
  'GLB 文件可直接在 Blender、Fusion 360 及大多数 3D 打印切片软件中打开。',
]

const M3D_STAGES_EN = [
  { label: 'Submitting prompt',        body: 'Sending your description to the Tripo3D generation pipeline…'         },
  { label: 'Analysing your idea',      body: 'AI is interpreting the description and planning the 3D structure…'    },
  { label: 'Building 3D geometry',     body: 'Constructing the base mesh — vertices, edges, faces, topology…'       },
  { label: 'Generating textures',      body: 'Painting colour, normal maps, and PBR material detail onto the mesh…' },
  { label: 'Finalising & converting',  body: 'Cleaning the mesh, preparing GLB, and converting to CNC-ready STL…'  },
]
const M3D_STAGES_ZH = [
  { label: '提交提示词',    body: '将你的描述发送到 Tripo3D 生成管道…'          },
  { label: '分析想法',      body: 'AI 正在解读描述并规划 3D 结构…'              },
  { label: '构建 3D 几何体', body: '构建基础网格——顶点、边、面、拓扑结构…'       },
  { label: '生成纹理',      body: '在网格上绘制颜色、法线贴图和 PBR 材质细节…'  },
  { label: '最终处理与转换', body: '清理网格，准备 GLB，并转换为 CNC 就绪的 STL…' },
]
const M3D_STAGE_AFTERS = [4000, 14000, 34000, 60000]

const M3D_PROGRESS: [number, number][] = [
  [500, 3], [4000, 10], [14000, 28], [34000, 52], [55000, 72], [70000, 84], [85000, 92],
]

export function Model3dGenerating({ prompt }: { prompt: string }) {
  const { lang, t } = useLang()
  const M3D_STAGES    = lang === 'zh' ? M3D_STAGES_ZH : M3D_STAGES_EN
  const MESH_FACTS    = lang === 'zh' ? MESH_FACTS_ZH : MESH_FACTS_EN
  const CARVING_FACTS = lang === 'zh' ? CARVING_FACTS_ZH : CARVING_FACTS_EN

  const stageIdx = useStages(M3D_STAGE_AFTERS)
  const progress = useProgress(M3D_PROGRESS)
  const fact     = useRotating([...MESH_FACTS, ...CARVING_FACTS], 7000)

  const stage = M3D_STAGES[Math.min(stageIdx, M3D_STAGES.length - 1)]
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
          background: 'rgba(99,102,241,.14)',
          border: '1px solid rgba(99,102,241,.3)',
          borderRadius: 20,
          fontSize: 11, fontWeight: 600, color: '#a5b4fc',
          letterSpacing: '.06em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          <PulsingDot color="#818cf8" /> {stage.label}
        </div>

        <div style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.7, minHeight: '3.4em' }}>
          {typed}<span style={{ opacity: 0.4 }}>▌</span>
        </div>
      </div>

      {/* Stage checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
        {M3D_STAGES.map((s, i) => {
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
                border: `2px solid ${done || active ? '#818cf8' : 'rgba(255,255,255,.2)'}`,
                background: done ? '#818cf8' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: active ? 'spin 1.2s linear infinite' : 'none',
              }}>
                {done && <span style={{ fontSize: 8, color: '#fff', fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{
                fontSize: 12,
                color: done ? '#a5b4fc' : active ? 'var(--text)' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
              }}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar — indigo tint */}
      <div style={{ width: '100%', maxWidth: 440, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, #6366f1, #818cf8)',
          borderRadius: 2,
          transition: 'width 1.6s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>

      {/* Prompt as context */}
      <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
        "{prompt}"
      </div>

      {/* Fact card */}
      <FactCard fact={fact} label={t.didYouKnow} />

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        {t.m3dLoadUsually}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function PulsingDot({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: color,
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
