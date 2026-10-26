import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Creation, FlowMode, SessionState } from '../types'
import { saveCreation, loadCreations, uploadDataUrl, type DbCreation } from '../lib/supabase'
import { RecentPanel } from '../components/RecentPanel'
import { GalleryPage } from '../components/GalleryPage'
import { useAuth } from './AuthContext'

/** A saved creation the user asked to open; App picks it up on /create. */
export interface OpenRequest {
  session:  SessionState
  flowMode: FlowMode
}

interface CreationsCtx {
  creations:     Creation[]
  addCreation:   (c: Omit<Creation, 'id' | 'dbId' | 'isPublic'>) => void
  setPublic:     (id: string, isPublic: boolean) => void
  showRecent:    boolean
  toggleRecent:  () => void
  openGallery:   () => void
  openRequest:   OpenRequest | null
  clearOpenRequest: () => void
}

const CreationsContext = createContext<CreationsCtx | null>(null)

// Saved sessions have their image data URLs stripped (too large for the DB),
// so put the thumbnail back as the selected design when reopening one.
function restoreSession(s: SessionState, thumbnail: string | null): SessionState {
  if (!thumbnail) return s
  const index  = s.selectedIndex ?? 0
  const images = s.images ?? []
  if (images.some(i => i.index === index && i.url)) return s
  return {
    ...s,
    selectedIndex: index,
    images: [...images.filter(i => i.index !== index), { index, url: thumbnail }],
  }
}

async function persistCreation(c: Creation): Promise<string | null> {
  const uid = Math.random().toString(36).slice(2, 8)

  // Upload thumbnail to Supabase Storage if it's still a data URL
  let thumbUrl = c.thumbnail
  if (thumbUrl && thumbUrl.startsWith('data:')) {
    const ext = thumbUrl.startsWith('data:image/webp') ? 'webp' : 'png'
    const ct  = ext === 'webp' ? 'image/webp' : 'image/png'
    thumbUrl = await uploadDataUrl(thumbUrl, `thumbnails/${uid}.${ext}`, ct) ?? null
  }

  // Strip data URLs from the session before writing to the DB.
  // Generated images are several MB of base64 each — saving them in a JSONB
  // column makes the row too large for Supabase to accept, causing silent failures.
  // stlUrl / renderedUrl are already permanent URLs so they are kept.
  const cleanSession = {
    ...c.session,
    images:      c.session.images.map(img => ({
      ...img,
      url: img.url.startsWith('data:') ? '' : img.url,
    })),
    heightmapUrl: c.session.heightmapUrl?.startsWith('data:') ? null : c.session.heightmapUrl,
  }

  const row = await saveCreation({
    type:      c.type,
    flow_mode: c.flowMode,
    prompt:    c.prompt,
    thumbnail: thumbUrl,
    glb_url:   c.session.glbUrl ?? null,
    stl_url:   c.session.stlUrl ?? null,
    session:   cleanSession as unknown as Record<string, unknown>,
  })
  if (!row) console.warn('persistCreation: saveCreation returned null — check Supabase logs')
  return row?.id ?? null
}

export function CreationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [creations,   setCreations]   = useState<Creation[]>([])
  const [showRecent,  setShowRecent]  = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null)

  // Reload the signed-in user's creations whenever auth changes.
  useEffect(() => {
    if (!user) { setCreations([]); return }
    loadCreations().then(rows => {
      setCreations(rows.map(r => ({
        id:        r.id,
        dbId:      r.id,
        type:      r.type,
        prompt:    r.prompt,
        flowMode:  r.flow_mode as FlowMode,
        thumbnail: r.thumbnail ?? null,
        session:   (r.session ?? {}) as unknown as SessionState,
        isPublic:  r.is_public ?? false,
      })))
    })
  }, [user])

  function addCreation(c: Omit<Creation, 'id' | 'dbId' | 'isPublic'>) {
    const entry: Creation = { ...c, id: Math.random().toString(36).slice(2, 8), dbId: null, isPublic: false }
    setCreations(prev => [entry, ...prev])
    if (!user) return
    // Persist to DB in background and store the returned DB id
    persistCreation(entry).then(dbId => {
      if (dbId) setCreations(prev => prev.map(p => p.id === entry.id ? { ...p, dbId } : p))
    })
  }

  function setPublic(id: string, isPublic: boolean) {
    setCreations(prev => prev.map(c => c.id === id ? { ...c, isPublic } : c))
  }

  function open(session: SessionState, flowMode: FlowMode, thumbnail: string | null) {
    setOpenRequest({ session: restoreSession(session, thumbnail), flowMode })
    setShowRecent(false)
    setShowGallery(false)
    navigate('/create')
  }

  return (
    <CreationsContext.Provider value={{
      creations, addCreation, setPublic,
      showRecent, toggleRecent: () => setShowRecent(s => !s),
      openGallery: () => setShowGallery(true),
      openRequest, clearOpenRequest: () => setOpenRequest(null),
    }}>
      {children}

      {showRecent && (
        <RecentPanel
          creations={creations}
          onSelect={id => {
            const c = creations.find(x => x.id === id)
            if (c) open(c.session, c.flowMode, c.thumbnail)
          }}
          onClose={() => setShowRecent(false)}
        />
      )}

      {showGallery && (
        <GalleryPage
          user={user}
          onClose={() => setShowGallery(false)}
          onLoad={(row: DbCreation) => {
            if (row.session) open(row.session as unknown as SessionState, row.flow_mode as FlowMode, row.thumbnail)
          }}
        />
      )}
    </CreationsContext.Provider>
  )
}

export function useCreations() {
  const ctx = useContext(CreationsContext)
  if (!ctx) throw new Error('useCreations must be used inside CreationsProvider')
  return ctx
}
