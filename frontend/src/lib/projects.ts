import { supabase } from './supabase'
import { stubCards, stubDetail, isStubId } from './stubProjects'

// ── Shared taxonomy (easy to retune) ─────────────────────────────────────────

export const CATEGORIES = [
  'Workshop Tools',
  'Maker Projects',
  'Home & Living',
  'Art & Gifts',
  'Models & Toys',
] as const

export const MACHINES  = ['TTC 450 Pro', 'ED1', 'TTC 6050', 'TTC 450 Ultra'] as const
export const MATERIALS = ['Wood', 'Plastic', 'Aluminum', 'Brass', 'Acrylic', 'Composite'] as const

// Accepted file extensions per slot
export const NC_EXTS    = ['nc', 'cnc', 'ngc', 'tap', 'gcode']
export const MODEL_EXTS = ['stl', 'step', 'stp', 'obj', '3mf', 'f3d', 'gltf', 'glb', 'ply', 'iges', 'igs']

export type ProjectStatus   = 'draft' | 'published'
export type LicenseAdapt     = 'yes' | 'no' | 'sa'
export type ProjectFileKind  = 'nc' | 'cam' | 'model' | 'attachment'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectFile {
  id?:        string
  kind:       ProjectFileKind
  name:       string
  url:        string
  path:       string
  size_bytes: number
  // Optional CAM metadata — populated for stub/demo content and, later, for
  // uploads that carry toolpath info. Omitted for plain user uploads for now.
  machining_time?: string
  paths?:          number
  tool_count?:     number
  source?:         string
  machine?:        string
  material?:       string
  tools?:          string[]
  nc_paths?:       { name: string; tool: string; note?: string }[]
}

export interface ProjectComment {
  author:       string
  when:         string
  text:         string
  avatar_color?: string
}

export interface Project {
  id:                 string
  user_id:            string
  name:               string
  description:        string
  category:           string | null
  is_original:        boolean
  remix_source:       string | null
  license_adapt:      LicenseAdapt
  license_commercial: boolean
  post_process:       string | null
  pictures:           string[]
  tags:               string[]
  machines:           string[]
  materials:          string[]
  status:             ProjectStatus
  download_count:     number
  created_at:         string
  updated_at:         string
  published_at:       string | null
}

export interface ProjectCard extends Project {
  like_count:   number
  is_liked:     boolean
  author_name?: string
  views?:       number
}

export interface ProjectDetail extends Project {
  files:        ProjectFile[]
  like_count:   number
  is_liked:     boolean
  is_saved:     boolean
  author_name?: string
  views?:       number
  comments?:    ProjectComment[]
}

// Everything the wizard collects, minus server-managed fields.
export type ProjectInput = Pick<Project,
  | 'name' | 'description' | 'category' | 'is_original' | 'remix_source'
  | 'license_adapt' | 'license_commercial' | 'post_process'
  | 'pictures' | 'tags' | 'machines' | 'materials'
>

// ── Storage ──────────────────────────────────────────────────────────────────

function rand() { return Math.random().toString(36).slice(2, 10) }

/** Upload a File to the public `models` bucket under a per-upload prefix. */
export async function uploadProjectFile(
  file: File,
  uploadId: string,
  kind: ProjectFileKind,
): Promise<ProjectFile | null> {
  if (!supabase) return null
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `projects/${uploadId}/${kind}/${rand()}-${safeName}`
  const { error } = await supabase.storage
    .from('models')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' })
  if (error) { console.error('uploadProjectFile failed:', error); return null }
  const { data } = supabase.storage.from('models').getPublicUrl(path)
  return { kind, name: file.name, url: data.publicUrl, path, size_bytes: file.size }
}

/** Upload a picture (File) for a project; returns its public URL. */
export async function uploadProjectImage(file: File, uploadId: string): Promise<string | null> {
  if (!supabase) return null
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `projects/${uploadId}/images/${rand()}-${safeName}`
  const { error } = await supabase.storage
    .from('models')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) { console.error('uploadProjectImage failed:', error); return null }
  const { data } = supabase.storage.from('models').getPublicUrl(path)
  return data.publicUrl
}

// ── Create / update ──────────────────────────────────────────────────────────

/** Insert a new project row (draft or published). Returns the new id. */
export async function createProject(
  input: ProjectInput,
  status: ProjectStatus,
): Promise<string | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...input,
      user_id:      user.id,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) { console.error('createProject failed:', error); return null }
  return data.id as string
}

export async function updateProject(
  id: string,
  input: ProjectInput,
  status: ProjectStatus,
): Promise<boolean> {
  if (!supabase) return false
  const patch: Record<string, unknown> = { ...input, status }
  if (status === 'published') patch.published_at = new Date().toISOString()
  const { error } = await supabase.from('projects').update(patch).eq('id', id)
  if (error) { console.error('updateProject failed:', error); return false }
  return true
}

/** Replace the file rows for a project (simple delete-then-insert). */
export async function saveProjectFiles(projectId: string, files: ProjectFile[]): Promise<boolean> {
  if (!supabase) return false
  await supabase.from('project_files').delete().eq('project_id', projectId)
  if (files.length === 0) return true
  const rows = files.map(f => ({
    project_id: projectId,
    kind:       f.kind,
    name:       f.name,
    url:        f.url,
    path:       f.path,
    size_bytes: f.size_bytes,
  }))
  const { error } = await supabase.from('project_files').insert(rows)
  if (error) { console.error('saveProjectFiles failed:', error); return false }
  return true
}

// ── Read: gallery ────────────────────────────────────────────────────────────

export type ProjectSort = 'newest' | 'downloads' | 'likes'

export interface ProjectFilters {
  category?: string | null
  machine?:  string | null
  material?: string | null
}

export async function loadProjects(
  userId: string | null,
  filters: ProjectFilters = {},
  sort: ProjectSort = 'newest',
): Promise<ProjectCard[]> {
  if (!supabase) return []

  let q = supabase
    .from('projects')
    .select('*')
    .eq('status', 'published')

  if (filters.category) q = q.eq('category', filters.category)
  if (filters.machine)  q = q.contains('machines', [filters.machine])
  if (filters.material) q = q.contains('materials', [filters.material])

  if (sort === 'downloads')   q = q.order('download_count', { ascending: false })
  else                        q = q.order('published_at',   { ascending: false })

  const { data: projects, error } = await q.limit(200)
  // Fall back to stub/seed content while there are no real published projects.
  if (error || !projects || projects.length === 0) return stubCards(filters, sort)

  const ids = projects.map(p => p.id)
  const { data: likes } = await supabase
    .from('project_likes')
    .select('project_id, user_id')
    .in('project_id', ids)

  const countMap: Record<string, number> = {}
  const likedSet = new Set<string>()
  likes?.forEach(({ project_id, user_id }) => {
    countMap[project_id] = (countMap[project_id] ?? 0) + 1
    if (userId && user_id === userId) likedSet.add(project_id)
  })

  const cards: ProjectCard[] = projects.map(p => ({
    ...(p as Project),
    like_count: countMap[p.id] ?? 0,
    is_liked:   likedSet.has(p.id),
  }))

  if (sort === 'likes') cards.sort((a, b) => b.like_count - a.like_count)
  return cards
}

/** A single user's own projects (any status), for a "My Projects" view. */
export async function loadMyProjects(userId: string): Promise<Project[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) { console.error('loadMyProjects failed:', error); return [] }
  return (data ?? []) as Project[]
}

// ── Read: detail ─────────────────────────────────────────────────────────────

export async function loadProjectDetail(
  id: string,
  userId: string | null,
): Promise<ProjectDetail | null> {
  if (isStubId(id)) return stubDetail(id)
  if (!supabase) return null

  const { data: project, error } = await supabase
    .from('projects').select('*').eq('id', id).single()
  if (error || !project) { if (error) console.error('loadProjectDetail failed:', error); return null }

  const { data: files } = await supabase
    .from('project_files').select('*').eq('project_id', id)

  const { data: likes } = await supabase
    .from('project_likes').select('user_id').eq('project_id', id)

  let is_saved = false
  if (userId) {
    const { data: save } = await supabase
      .from('project_saves').select('project_id')
      .eq('project_id', id).eq('user_id', userId).maybeSingle()
    is_saved = !!save
  }

  return {
    ...(project as Project),
    files:      (files ?? []) as ProjectFile[],
    like_count: likes?.length ?? 0,
    is_liked:   !!(userId && likes?.some(l => l.user_id === userId)),
    is_saved,
  }
}

// ── Likes / saves / downloads ────────────────────────────────────────────────

export async function toggleProjectLike(projectId: string, isLiked: boolean): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (isLiked) {
    const { error } = await supabase.from('project_likes')
      .delete().eq('project_id', projectId).eq('user_id', user.id)
    return !error
  }
  const { error } = await supabase.from('project_likes')
    .insert({ project_id: projectId, user_id: user.id })
  return !error
}

export async function toggleProjectSave(projectId: string, isSaved: boolean): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (isSaved) {
    const { error } = await supabase.from('project_saves')
      .delete().eq('project_id', projectId).eq('user_id', user.id)
    return !error
  }
  const { error } = await supabase.from('project_saves')
    .insert({ project_id: projectId, user_id: user.id })
  return !error
}

export async function incrementProjectDownload(projectId: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('increment_project_download', { pid: projectId })
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('projects').delete().eq('id', id)
  return !error
}
