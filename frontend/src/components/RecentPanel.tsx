import type { Creation } from '../types'
import { useLang } from '../contexts/LanguageContext'

interface Props {
  creations: Creation[]
  onSelect:  (id: string) => void
  onClose:   () => void
}

export function RecentPanel({ creations, onSelect, onClose }: Props) {
  const { t } = useLang()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.45)', zIndex: 100, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 300,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t.recentCreations}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {t.savedSession(creations.length)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18,
              cursor: 'pointer', lineHeight: 1, padding: '4px 6px', borderRadius: 6,
            }}
          >✕</button>
        </div>

        {/* Creation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {creations.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              color: 'var(--muted)', fontSize: 13, lineHeight: 1.7,
            }}>
              {t.noCreations}<br />{t.noCreationsHint}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {creations.map((c, i) => (
                <CreationCard
                  key={c.id}
                  creation={c}
                  isLatest={i === 0}
                  onSelect={() => onSelect(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function CreationCard({
  creation, isLatest, onSelect,
}: {
  creation: Creation
  isLatest: boolean
  onSelect: () => void
}) {
  const { t } = useLang()
  const is3d = creation.type === 'model3d'
  const accentColor = is3d ? '#a5b4fc' : 'var(--accent)'
  const badgeBg     = is3d ? 'rgba(99,102,241,.15)' : 'rgba(249,115,22,.12)'
  const badgeBorder = is3d ? 'rgba(99,102,241,.4)'  : 'rgba(249,115,22,.4)'

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${isLatest ? (is3d ? 'rgba(99,102,241,.4)' : 'rgba(249,115,22,.4)') : 'var(--border)'}`,
      overflow: 'hidden', background: 'var(--surface2)', transition: 'border-color .15s',
    }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '50%', background: '#0a0d12' }}>
        {creation.thumbnail ? (
          <img
            src={creation.thumbnail} alt={creation.prompt}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, opacity: 0.3,
          }}>
            {is3d ? '◈' : '▦'}
          </div>
        )}

        <div style={{
          position: 'absolute', top: 7, left: 7, padding: '2px 8px',
          background: badgeBg, border: `1px solid ${badgeBorder}`,
          borderRadius: 10, backdropFilter: 'blur(6px)',
          fontSize: 9, fontWeight: 700, color: accentColor,
          letterSpacing: '.06em', textTransform: 'uppercase',
        }}>
          {is3d ? t.badgeModel3d : t.badgeRelief}
        </div>

        {isLatest && (
          <div style={{
            position: 'absolute', top: 7, right: 7, padding: '2px 7px',
            background: 'rgba(5,150,105,.2)', border: '1px solid rgba(5,150,105,.4)',
            borderRadius: 10, fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '.04em',
          }}>{t.latest}</div>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 12, color: 'var(--text)', fontWeight: 500,
          marginBottom: 8, lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          "{creation.prompt}"
        </div>

        <button
          onClick={onSelect}
          style={{
            width: '100%', padding: '7px',
            background: is3d ? 'rgba(99,102,241,.15)' : 'rgba(249,115,22,.12)',
            border: `1px solid ${is3d ? 'rgba(99,102,241,.35)' : 'rgba(249,115,22,.35)'}`,
            borderRadius: 7, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: accentColor, transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = is3d ? 'rgba(99,102,241,.25)' : 'rgba(249,115,22,.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = is3d ? 'rgba(99,102,241,.15)' : 'rgba(249,115,22,.12)')}
        >
          {t.loadCreation}
        </button>
      </div>
    </div>
  )
}
