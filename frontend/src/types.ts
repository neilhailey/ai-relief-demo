import type { ImageOption } from './components/SelectStep'

export type FlowMode = 'ai' | 'upload' | 'model3d'

export interface SessionState {
  sessionId:      string
  prompt:         string
  enhancedPrompt: string
  images:         ImageOption[]
  selectedIndex:  number | null
  heightmapUrl:   string | null
  stlUrl:         string | null
  glbUrl:         string | null
  renderedUrl:    string | null
}

export interface Creation {
  id:        string
  dbId:      string | null   // Supabase row id (null if not signed in)
  type:      'relief' | 'model3d'
  prompt:    string
  thumbnail: string | null   // data URL — heightmap for relief, rendered image for 3D
  session:   SessionState
  flowMode:  FlowMode
  isPublic:  boolean
}

export interface BackgroundJob {
  jobId:       string
  prompt:      string
  status:      'running' | 'done' | 'failed'
  tripoStatus: string        // 'queued' | 'running' | 'success' — raw Tripo phase
  progress:    number        // 0–100, real value from Tripo API
  result:      SessionState | null
  error:       string | null
}
