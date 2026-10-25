import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { loadGalleryWithLikes, toggleLike, toggleSave, type GalleryItem } from '../lib/supabase'

type GalleryTab = 'all' | 'relief' | 'model3d'
type SortBy     = 'newest' | 'most_liked'

interface Props {
  user:             User | null
  onSignInRequired: () => void
}

export function CommunityGallery({ user, onSignInRequired }: Props) {
  const [tab,     setTab]     = useState<GalleryTab>('all')
  const [sort,    setSort]    = useState<SortBy>('newest')
  const [items,   setItems]   = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await loadGalleryWithLikes(user?.id ?? null)
    setItems(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { void load() }, [load])

  const filtered = items.filter(i => tab === 'all' || i.type === tab)
  const sorted   = [...filtered].sort((a, b) => {
    if (sort === 'most_liked') return b.like_count - a.like_count
    return new Date(b.published_at ?? b.created_at).getTime()
         - new Date(a.published_at ?? a.created_at).getTime()
  })

  async function handleLike(item: GalleryItem) {
    if (!user) { onSignInRequired(); return }
    const wasLiked = item.is_liked
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, is_liked: !wasLiked, like_count: wasLiked ? i.like_count - 1 : i.like_count + 1 }
      : i
    ))
    const ok = await toggleLike(item.id, wasLiked)
    if (!ok) {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, is_liked: wasLiked, like_count: wasLiked ? i.like_count + 1 : i.like_count - 1 }
        : i
      ))
    }
  }

  async function handleSave(item: GalleryItem) {
    if (!user) { onSignInRequired(); return }
    const wasSaved = item.is_saved
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_saved: !wasSaved } : i))
    const ok = await toggleSave(item.id, wasSaved)
    if (!ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_saved: wasSaved } : i))
    }
  }

  const TABS: { key: GalleryTab; label: string }[] = [
    { key: 'all',     label: 'All'      },
    { key: 'relief',  label: 'Relief'   },
    { key: 'model3d', label: '3D Model' },
  ]

  return (
    <section style={{ width: '100%', padding: '48px 0 64px', borderTop: '1px solid var(--border)', marginTop: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 20,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Community AI Gallery
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              AI creations published by the community
            </p>
          </div>

          {/* Sort pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['newest', 'most_liked'] as SortBy[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: '5px 13px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${sort === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: sort === s ? 'rgba(249,115,22,.12)' : 'var(--surface2)',
                  color: sort === s ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 11, fontWeight: 600,
                  transition: 'all .15s',
                }}
              >
                {s === 'newest' ? 'Newest' : '♥ Most Liked'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: tab === key ? 'var(--accent)' : 'var(--muted)',
                borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
                transition: 'color .15s',
              }}
            >
              {label}
              {key !== 'all' && (
                <span style={{
                  marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 8,
                  background: 'var(--surface2)', color: 'var(--muted)',
                }}>
                  {items.filter(i => i.type === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid rgba(249,115,22,.2)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No creations yet</div>
            <div style={{ fontSize: 13 }}>Generate something and publish it to be the first!</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {sorted.map(item => (
              <GalleryCard
                key={item.id}
                item={item}
                onLike={() => void handleLike(item)}
                onSave={() => void handleSave(item)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function GalleryCard({ item, onLike, onSave }: {
  item:   GalleryItem
  onLike: () => void
  onSave: () => void
}) {
  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'transform .2s, border-color .2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-3px)'
        el.style.borderColor = 'rgba(249,115,22,.45)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'none'
        el.style.borderColor = 'var(--border)'
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingTop: '100%', background: '#0a0d12' }}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.prompt}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', fontSize: 36,
          }}>
            {item.type === 'model3d' ? '🎲' : '🗿'}
          </div>
        )}

        {/* Type badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
          background: item.type === 'model3d' ? 'rgba(99,102,241,.9)' : 'rgba(249,115,22,.9)',
          color: '#fff',
          backdropFilter: 'blur(4px)',
        }}>
          {item.type === 'model3d' ? '3D' : 'Relief'}
        </span>

        {/* Save / bookmark button */}
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          title={item.is_saved ? 'Remove bookmark' : 'Bookmark'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 30, height: 30, borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            background: item.is_saved ? 'var(--accent)' : 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff',
            transition: 'background .2s, transform .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
        >
          {item.is_saved ? '🔖' : '🏷'}
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 10,
        }}>
          {item.prompt || 'Untitled'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Like button */}
          <button
            onClick={onLike}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 6px 4px 0',
            }}
          >
            <span style={{
              fontSize: 16,
              filter: item.is_liked ? 'none' : 'grayscale(100%) opacity(0.45)',
              transition: 'filter .15s, transform .15s',
            }}>❤️</span>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: item.is_liked ? '#f97316' : 'var(--muted)',
              transition: 'color .15s',
            }}>
              {item.like_count}
            </span>
          </button>

          {/* STL download */}
          {item.stl_url && (
            <a
              href={item.stl_url}
              download="model.stl"
              onClick={e => e.stopPropagation()}
              style={{
                padding: '5px 11px', borderRadius: 6,
                background: 'var(--accent)', color: '#fff',
                textDecoration: 'none', fontSize: 11, fontWeight: 700,
                transition: 'opacity .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
            >
              ↓ STL
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
