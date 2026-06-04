import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('Supabase env vars not set — auth and persistence disabled')
}

export const supabase = (url && key) ? createClient(url, key) : null

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbCreation {
  id:         string
  user_id:    string
  type:       'relief' | 'model3d'
  flow_mode:  string
  prompt:     string
  thumbnail:  string | null
  glb_url:    string | null
  stl_url:    string | null
  session:    Record<string, unknown> | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function saveCreation(creation: Omit<DbCreation, 'id' | 'user_id' | 'created_at'>) {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('creations')
    .insert({ ...creation, user_id: user.id })
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
    .limit(20)

  if (error) { console.error('loadCreations failed:', error); return [] }
  return (data ?? []) as DbCreation[]
}

export async function deleteCreation(id: string) {
  if (!supabase) return
  await supabase.from('creations').delete().eq('id', id)
}

// ── Storage helpers ───────────────────────────────────────────────────────────
// Upload a data-URL (base64) blob to Supabase Storage and return the public URL.

export async function uploadDataUrl(
  dataUrl: string,
  path: string,     // e.g. "thumbnails/abc123.png"
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
