import { useEffect, useState } from 'react'
import { loadGallery, loadCreations, publishCreation, unpublishCreation, type DbCreation } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Props {
  user:    User | null
  onClose: () => void
  onLoad:  (creation: DbCreation) => void   // load a past creation into the viewer
}

type Tab = 'explore' | 'mine'

export function GalleryPage({ user, onClose, onLoad }: Props) {
  const [tab,      setTab]      = useState<Tab>('explore')
  const [items,    setItems]    = useState<DbCreation[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)  // id being toggled

  useEffect(() => {
    setLoading(true)
    const fetch = tab === 'explore' ? loadGallery() : loadCreations()
    fetch.then(data => { setItems(data); setLoading(false) })
  }, [tab])

  async function handleTogglePublish(item: DbCreation) {
    setToggling(item.id)
    const ok = item.is_public
      ? await unpublishCreation(item.id)
      : await publishCreation(item.id)
    if (ok) {
      setItems(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, is_public: !i.is_public, published_at: i.is_public ? null : new Date().toISOString() }
          : i
      ))
    }
    setToggling(null)
  }

  const badge = (type: string) => (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
      background: type === 'model3d' ? 'rgba(99,102,241,.2)' : 'rgba(249,115,22,.2)',
      color:      type === 'model3d' ? '#a5b4fc'             : '#fdba74',
      border:     `1px solid ${type === 'model3d' ? 'rgba(99,102,241,.3)' : 'rgba(249,115,22,.3)'}`,
    }}>
      {type === 'model3d' ? '3D Model' : 'Relief'}
    </span>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
          }}>←</button>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 10, padding: 4 }}>
            {(['explore', 'mine'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: tab === t ? 'var(--surface)' : 'transparent',
                  color:      tab === t ? 'var(--text)'    : 'var(--muted)',
                  boxShadow:  tab === t ? '0 1px 4px rgba(0,0,0,.3)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {t === 'explore' ? '🌐 Explore' : '👤 My Models'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {tab === 'explore' ? 'Community creations' : `${items.length} saved`}
          </span>
        </div>

        {tab === 'explore' && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Click any model to view · download STL to carve
          </div>
        )}
        {tab === 'mine' && !user && (
          <div style={{ fontSize: 12, color: '#fdba74' }}>
            Sign in to see your saved models
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(249,115,22,.2)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              {tab === 'explore' ? '🌐' : '🎨'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {tab === 'explore' ? 'No public models yet' : 'No models saved yet'}
            </div>
            <div style={{ fontSize: 13 }}>
              {tab === 'explore'
                ? 'Generate something and publish it to be the first!'
                : 'Sign in and generate a model to save it here.'}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                  transition: 'border-color .2s, transform .2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(249,115,22,.5)'
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{ position: 'relative', width: '100%', paddingTop: '75%', background: '#0a0d12', cursor: 'pointer' }}
                  onClick={() => onLoad(item)}
                >
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
                      color: 'var(--muted)', fontSize: 32,
                    }}>
                      {item.type === 'model3d' ? '🎲' : '🗿'}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                  }}>
                    {badge(item.type)}
                  </div>
                  {tab === 'mine' && item.is_public && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 10, padding: '2px 7px', borderRadius: 10,
                      background: 'rgba(5,150,105,.25)', color: '#6ee7b7',
                      border: '1px solid rgba(5,150,105,.4)', fontWeight: 600,
                    }}>
                      Public
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '12px 12px 10px' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 4,
                  }}>
                    {item.prompt || '(no prompt)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {/* Download STL */}
                    {item.stl_url && (
                      <a
                        href={item.stl_url}
                        download="model.stl"
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, padding: '7px 0', textAlign: 'center',
                          background: 'var(--accent)', color: '#fff',
                          borderRadius: 6, textDecoration: 'none',
                          fontSize: 11, fontWeight: 700,
                        }}
                      >
                        ↓ STL
                      </a>
                    )}

                    {/* Publish toggle (My Models only) */}
                    {tab === 'mine' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleTogglePublish(item) }}
                        disabled={toggling === item.id}
                        style={{
                          flex: 1, padding: '7px 0',
                          background: item.is_public ? 'rgba(5,150,105,.15)' : 'var(--surface2)',
                          border: `1px solid ${item.is_public ? 'rgba(5,150,105,.4)' : 'var(--border)'}`,
                          borderRadius: 6, cursor: 'pointer',
                          fontSize: 11, fontWeight: 700,
                          color: item.is_public ? '#6ee7b7' : 'var(--text-dim)',
                          opacity: toggling === item.id ? 0.6 : 1,
                        }}
                      >
                        {toggling === item.id ? '…' : item.is_public ? '✓ Published' : '↗ Publish'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
