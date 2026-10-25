import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('Supabase env vars not set — auth and persistence disabled')
}

export const supabase = (url && key) ? createClient(url, key) : null

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbCreation {
  id:           string
  user_id:      string
  type:         'relief' | 'model3d'
  flow_mode:    string
  prompt:       string
  thumbnail:    string | null
  glb_url:      string | null
  stl_url:      string | null
  session:      Record<string, unknown> | null
  is_public:    boolean
  published_at: string | null
  created_at:   string
}

// ── Private creations ────────────────────────────────────────────────────────

export async function saveCreation(creation: Omit<DbCreation, 'id' | 'user_id' | 'created_at' | 'is_public' | 'published_at'>) {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('creations')
    .insert({ ...creation, user_id: user.id, is_public: false })
    .select()
    .single()

  if (error) { console.error('saveCreation failed:', error); return null }
  return data as DbCreation
}

export async function loadCreations(): Promise<DbCreation[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('creations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error('loadCreations failed:', error); return [] }
  return (data ?? []) as DbCreation[]
}

export async function deleteCreation(id: string) {
  if (!supabase) return
  await supabase.from('creations').delete().eq('id', id)
}

// ── Gallery (public creations) ────────────────────────────────────────────────

export async function publishCreation(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('creations')
    .update({ is_public: true, published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('publishCreation failed:', error); return false }
  return true
}

export async function unpublishCreation(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('creations')
    .update({ is_public: false, published_at: null })
    .eq('id', id)
  if (error) { console.error('unpublishCreation failed:', error); return false }
  return true
}

export async function loadGallery(): Promise<DbCreation[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('creations')
    .select('id, type, flow_mode, prompt, thumbnail, stl_url, published_at, created_at')
    .eq('is_public', true)
    .order('published_at', { ascending: false })

  if (error) { console.error('loadGallery failed:', error); return [] }
  return (data ?? []) as DbCreation[]
}

// ── Community Gallery with likes & saves ─────────────────────────────────────

export interface GalleryItem extends Omit<DbCreation, 'session' | 'glb_url'> {
  like_count: number
  is_liked:   boolean
  is_saved:   boolean
}

export async function loadGalleryWithLikes(userId: string | null): Promise<GalleryItem[]> {
  if (!supabase) return []

  const { data: creations, error } = await supabase
    .from('creations')
    .select('id, type, flow_mode, prompt, thumbnail, stl_url, published_at, created_at, user_id, is_public')
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .limit(100)

  if (error || !creations || creations.length === 0) return []

  const ids = creations.map(c => c.id)

  // Fetch all likes for these creations in one query
  const { data: likes } = await supabase
    .from('creation_likes')
    .select('creation_id, user_id')
    .in('creation_id', ids)

  const countMap: Record<string, number> = {}
  const userLikedSet = new Set<string>()
  likes?.forEach(({ creation_id, user_id }) => {
    countMap[creation_id] = (countMap[creation_id] ?? 0) + 1
    if (userId && user_id === userId) userLikedSet.add(creation_id)
  })

  // Fetch current user's saves
  const savedSet = new Set<string>()
  if (userId) {
    const { data: saves } = await supabase
      .from('creation_saves')
      .select('creation_id')
      .eq('user_id', userId)
      .in('creation_id', ids)
    saves?.forEach(({ creation_id }) => savedSet.add(creation_id))
  }

  return creations.map(c => ({
    ...(c as DbCreation),
    like_count: countMap[c.id] ?? 0,
    is_liked:   userLikedSet.has(c.id),
    is_saved:   savedSet.has(c.id),
  }))
}

export async function toggleLike(creationId: string, isCurrentlyLiked: boolean): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  if (isCurrentlyLiked) {
    const { error } = await supabase.from('creation_likes')
      .delete().eq('creation_id', creationId).eq('user_id', user.id)
    return !error
  } else {
    const { error } = await supabase.from('creation_likes')
      .insert({ creation_id: creationId, user_id: user.id })
    return !error
  }
}

export async function toggleSave(creationId: string, isCurrentlySaved: boolean): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  if (isCurrentlySaved) {
    const { error } = await supabase.from('creation_saves')
      .delete().eq('creation_id', creationId).eq('user_id', user.id)
    return !error
  } else {
    const { error } = await supabase.from('creation_saves')
      .insert({ creation_id: creationId, user_id: user.id })
    return !error
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadDataUrl(
  dataUrl: string,
  path: string,
  contentType = 'image/png',
): Promise<string | null> {
  if (!supabase) return null
  try {
    const base64 = dataUrl.split(',')[1]
    const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const { error } = await supabase.storage
      .from('models')
      .upload(path, bytes, { contentType, upsert: true })
    if (error) { console.error('upload failed:', error); return null }
    const { data } = supabase.storage.from('models').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error('uploadDataUrl error:', e)
    return null
  }
}
