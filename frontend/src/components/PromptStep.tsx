import { useState, KeyboardEvent } from 'react'
import { ImageGenLoading } from './LoadingVibes'
import { useLang } from '../contexts/LanguageContext'

// ── Example prompt pools (EN / ZH must stay in the same order) ────────────────
const ALL_EXAMPLES_EN = [
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

const ALL_EXAMPLES_ZH = [
  // Wildlife
  '凯尔特结圆章',
  '嚎叫狼剪影',
  '盛开的向日葵',
  '山脉风光',
  '锦鲤',
  '翱翔的鹰',
  '曼陀罗图案',
  '带刺玫瑰',
  '罗盘玫瑰',
  '跃起的雄鹿',
  '橡树与根系',
  '航海锚',
  '蜂鸟',
  '莲花',
  '奔马',
  '夕阳下的松林',
  '部落熊',
  '破浪',
  '仓鸮',
  '葡萄藤花环',
  '跃起的鲑鱼',
  '鹿颅与鹿角',
  '白头鹰头像',
  '几何鹿',
  '龙的剪影',
  '复古船舵',
  '蜜蜂与蜂巢',
  '公牛颅骨',
  // More wildlife
  '灰熊肖像',
  '狼群对月嚎叫',
  '红尾鹰俯冲',
  '悬崖边缘的山羊',
  '大角雄鹿',
  '涉水沼泽的驼鹿',
  '冲锋的野猪',
  '山脊上的大角羊',
  '奔跑的叉角羚',
  '黄昏嚎叫的山狼',
  '停栖枝头的乌鸦',
  '飞翔的加拿大雁',
  '白尾鹿母子',
  '野牛公牛',
  '银背大猩猩',
  '秋叶中的红狐',
  '全速奔跑的野兔',
  '清晨报晓的公鸡',
  '孔雀开屏',
  '水面滑翔的天鹅',
  '大角鸮面部',
  '野火鸡展尾',
  '从草丛腾飞的野鸡',
  // Fish & marine
  '跃出水面的大嘴鲈',
  '跃起的虹鳟',
  '卷曲触角的章鱼',
  '游弋的海龟',
  '跃出水面的海豚',
  '夕阳下的鲸尾',
  '大白鲨',
  '硬头鳟',
  '溪鳟',
  '白眼鱼',
  // Celtic, Norse & heraldic
  '凯尔特三重螺旋',
  '扬帆的维京长船',
  '带角维京头盔',
  '北欧生命之树',
  '鸢尾花饰',
  '纹章立狮',
  '骑士盾与交叉剑',
  '珠宝王冠',
  '交叉战斧',
  '缠绳锚',
  // Native American
  '捕梦网与羽毛',
  '西北太平洋图腾面孔',
  '雷鸟展翅',
  '药轮',
  '水牛颅骨与头饰',
  // Botanical & nature
  '樱花枝',
  '枫叶',
  '苏格兰蓟',
  '盛开的鸢尾',
  '水边香蒲',
  '麦穗束',
  '枝头松果',
  '橡果与橡叶',
  '蘑菇丛',
  '展开的蕨叶',
  '罂粟花',
  '薰衣草枝',
  // Landscapes
  '林间瀑布',
  '黎明岩峰',
  '沙漠拱门峡谷',
  '风暴中的灯塔',
  '古老廊桥',
  // Western & Americana
  '长角牛颅骨',
  '牛仔帽与靴子',
  '马蹄铁与幸运草',
  '鲍伊刀',
  '木吉他',
  '野花装点的水牛颅骨',
  // Misc
  '古董罗盘玫瑰',
  '怀表齿轮',
  '复古骷髅钥匙',
  '蛇缠匕首',
]

function pickRandomIndices(n: number): number[] {
  const indices = Array.from({ length: ALL_EXAMPLES_EN.length }, (_, i) => i)
  return indices.sort(() => Math.random() - 0.5).slice(0, n)
}

export type Orientation = 'square' | 'portrait' | 'landscape'

interface Props {
  onGenerate: (prompt: string, orientation: Orientation) => void
  loading: boolean
  onSwitchToUpload: () => void
}

export function PromptStep({ onGenerate, loading, onSwitchToUpload }: Props) {
  const { t, lang } = useLang()
  const [prompt,      setPrompt]      = useState('')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  // Lazy initializer — runs once on mount, gives a fresh random set each page load
  // Stores indices so switching language updates chips without re-randomising
  const [exampleIdxs] = useState<number[]>(() => pickRandomIndices(7))
  const examples = exampleIdxs.map(i => lang === 'zh' ? ALL_EXAMPLES_ZH[i] : ALL_EXAMPLES_EN[i])

  function submit() {
    const p = prompt.trim()
    if (!p || loading) return
    onGenerate(p, orientation)
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
          {t.describeDesign}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', maxWidth: 480 }}>
          {t.describeHint}
        </p>
      </div>

      {/* Input */}
      <div style={{ width: '100%', maxWidth: 580 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder={t.promptPlaceholder}
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
          {loading ? <><Spinner /> {t.generatingDots}</> : t.generateImages}
        </button>
      </div>

      {/* Orientation picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.orientationLabel}</span>
        {(['square', 'portrait', 'landscape'] as Orientation[]).map(o => {
          const active = orientation === o
          const shapes: Record<Orientation, string> = {
            square:    '■',
            portrait:  '▐',
            landscape: '▬',
          }
          const labels: Record<Orientation, string> = {
            square:    t.orientSquare,
            portrait:  t.orientPortrait,
            landscape: t.orientLandscape,
          }
          return (
            <button
              key={o}
              onClick={() => !loading && setOrientation(o)}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: active ? 'rgba(249,115,22,.12)' : 'var(--surface)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 20,
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: loading ? 'default' : 'pointer',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 10 }}>{shapes[o]}</span>
              {labels[o]}
            </button>
          )
        })}
      </div>

      {/* Example chips */}
      <div style={{ textAlign: 'center', maxWidth: 580 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{t.tryExample}</p>
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
        {t.alreadyHaveImage}{' '}
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
          {t.uploadYourOwn}
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
