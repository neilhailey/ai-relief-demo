import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { SiteNav } from '../components/SiteNav'
import { useAuth } from '../contexts/AuthContext'
import {
  loadProjectDetail, toggleProjectLike, toggleProjectSave, incrementProjectDownload,
  type ProjectDetail as ProjectDetailT, type ProjectFile,
} from '../lib/projects'

const LICENSE_LABEL: Record<string, string> = {
  yes: 'Adaptations allowed',
  no:  'No derivatives (ND)',
  sa:  'Share-alike (SA)',
}

type Tab = 'description' | 'files' | 'post' | 'comments'

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${n}`
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
function isReal(url: string) { return !!url && url !== '#' }

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, promptSignIn } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetailT | null>(null)
  const [loading, setLoading] = useState(true)
  const [heroIdx, setHeroIdx] = useState(0)
  const [activeSec, setActiveSec] = useState<Tab>('description')
  const [copied, setCopied] = useState(false)
  const secRefs = useRef<Partial<Record<Tab, HTMLDivElement | null>>>({})
  const setSecRef = (key: Tab) => (el: HTMLDivElement | null) => { secRefs.current[key] = el }
  const scrollToSec = (key: Tab) => secRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    loadProjectDetail(id, user?.id ?? null).then(p => { setProject(p); setLoading(false) })
  }, [id, user?.id])

  // Highlight the section nearest the top as the user scrolls through sections.
  useEffect(() => {
    if (!project) return
    const obs = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActiveSec(top.target.getAttribute('data-sec') as Tab)
    }, { rootMargin: '-140px 0px -55% 0px', threshold: 0 })
    Object.values(secRefs.current).forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [project])

  async function handleLike() {
    if (!project) return
    if (!user) { promptSignIn(); return }
    const was = project.is_liked
    setProject({ ...project, is_liked: !was, like_count: project.like_count + (was ? -1 : 1) })
    const ok = await toggleProjectLike(project.id, was)
    if (!ok) setProject(p => p && ({ ...p, is_liked: was, like_count: p.like_count + (was ? 1 : -1) }))
  }
  async function handleSave() {
    if (!project) return
    if (!user) { promptSignIn(); return }
    const was = project.is_saved
    setProject({ ...project, is_saved: !was })
    const ok = await toggleProjectSave(project.id, was)
    if (!ok) setProject(p => p && ({ ...p, is_saved: was }))
  }
  function handleDownload() {
    if (project) void incrementProjectDownload(project.id)
  }
  function handleShare() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    })
  }

  if (loading) {
    return <Shell><Spinner /></Shell>
  }
  if (!project) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Project not found</div>
          <button onClick={() => navigate('/')} style={{ marginTop: 12, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700 }}>
            ← Back to Projects
          </button>
        </div>
      </Shell>
    )
  }

  const hero = project.pictures[heroIdx] ?? project.pictures[0]
  const ncFiles = project.files.filter(f => f.kind === 'nc')
  const primaryFile = project.files.find(f => isReal(f.url))
  const commentCount = project.comments?.length ?? 0

  const TABS: { key: Tab; label: string; show: boolean }[] = [
    { key: 'description', label: 'Description', show: true },
    { key: 'files',       label: 'NC Files',    show: project.files.length > 0 },
    { key: 'post',        label: 'Post Process', show: !!project.post_process },
    { key: 'comments',    label: 'Comments',    show: true },
  ]

  return (
    <Shell>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '18px 24px 80px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Projects</Link>
          {project.category && <><span>›</span><span style={{ color: 'var(--text-dim)' }}>{project.category}</span></>}
        </div>

        {/* Top: gallery + info panel */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
          {/* Gallery */}
          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'relative', paddingTop: '62%', background: '#0a0d12', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {hero ? (
                <img src={hero} alt={project.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 48 }}>🗂</div>
              )}
            </div>
            {project.pictures.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {project.pictures.map((pic, i) => (
                  <button key={i} onClick={() => setHeroIdx(i)}
                    style={{ width: 84, height: 60, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', padding: 0, border: `2px solid ${i === heroIdx ? 'var(--accent)' : 'var(--border)'}` }}>
                    <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info panel */}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, lineHeight: 1.25 }}>{project.name || 'Untitled project'}</h1>

            {/* Author + stats line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                  {(project.author_name ?? 'W')[0].toUpperCase()}
                </span>
                <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{project.author_name ?? 'WeCarver'}</span>
              </span>
              <span>{fmtDate(project.published_at ?? project.created_at)}</span>
              {project.views != null && <span>👁 {fmtNum(project.views)}</span>}
              <span>⬇ {fmtNum(project.download_count)}</span>
            </div>

            {/* File summary card(s) */}
            {ncFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {ncFiles.map((f, i) => <FileSummary key={i} file={f} onClick={() => scrollToSec('files')} />)}
              </div>
            )}

            {/* Primary actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {isReal(primaryFile?.url ?? '') ? (
                <a href={primaryFile!.url} download={primaryFile!.name} onClick={handleDownload}
                  style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: 10, background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
                  ⬇ Download Files
                </a>
              ) : (
                <button disabled title="Demo project — no downloadable files"
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 700, cursor: 'not-allowed' }}>
                  ⬇ Download Files
                </button>
              )}
            </div>
            <button style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
              ⚖ Use Based On The License
            </button>

            {/* Stat buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBtn active={project.is_liked} icon="👍" label={fmtNum(project.like_count)} onClick={handleLike} />
              <StatBtn active={project.is_saved} icon="🔖" label="Save" onClick={handleSave} />
              <StatBtn icon="💬" label={fmtNum(commentCount)} onClick={() => scrollToSec('comments')} />
              <StatBtn icon={copied ? '✓' : '↗'} label={copied ? 'Copied' : 'Share'} onClick={handleShare} />
            </div>

            {/* License summary */}
            <div style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>License</div>
              <div>• {project.is_original ? 'Original creation' : 'Remix / derived work'}</div>
              <div>• {LICENSE_LABEL[project.license_adapt] ?? project.license_adapt}</div>
              <div>• {project.license_commercial ? 'Commercial use allowed' : 'Non-commercial only'}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {/* Sticky section nav — jumps to sections that are all rendered below */}
        <div style={{
          position: 'sticky', top: 53, zIndex: 40, background: 'var(--bg)',
          display: 'flex', gap: 28, borderBottom: '1px solid var(--border)',
          margin: '36px 0 28px', paddingTop: 6,
        }}>
          {TABS.filter(t => t.show).map(t => (
            <button key={t.key} onClick={() => scrollToSec(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px',
                fontSize: 15, fontWeight: 600,
                color: activeSec === t.key ? 'var(--accent)' : 'var(--muted)',
                borderBottom: `2px solid ${activeSec === t.key ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
              }}>
              {t.label}{t.key === 'comments' && commentCount > 0 ? ` (${commentCount})` : ''}
            </button>
          ))}
        </div>

        {/* All sections stacked — visible as you scroll, no clicking required */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          <section data-sec="description" ref={setSecRef('description')} style={{ scrollMarginTop: 120 }}>
            <SecHeading>Description</SecHeading>
            <div className="project-rich" style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-dim)', maxWidth: 820 }}
              dangerouslySetInnerHTML={{ __html: project.description || '<p style="color:var(--muted)">No description provided.</p>' }} />
          </section>

          {project.files.length > 0 && (
            <section data-sec="files" ref={setSecRef('files')} style={{ scrollMarginTop: 120 }}>
              <SecHeading>NC Files</SecHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {project.files.map((f, i) => <FileDetail key={i} file={f} />)}
              </div>
            </section>
          )}

          {project.post_process && (
            <section data-sec="post" ref={setSecRef('post')} style={{ scrollMarginTop: 120 }}>
              <SecHeading>Post Process</SecHeading>
              <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', maxWidth: 820 }}>
                {project.post_process}
              </div>
            </section>
          )}

          <section data-sec="comments" ref={setSecRef('comments')} style={{ scrollMarginTop: 120 }}>
            <SecHeading>Comments{commentCount > 0 ? ` (${commentCount})` : ''}</SecHeading>
            <Comments project={project} user={user} onSignInRequired={promptSignIn} />
          </section>
        </div>

        {/* Tags */}
        {project.tags.length > 0 && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {project.tags.map(tag => (
              <span key={tag} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBtn({ active, icon, label, onClick }: { active?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '9px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background: active ? 'rgba(249,115,22,.14)' : 'var(--surface2)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--text-dim)',
      }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  )
}

function FileSummary({ file, onClick }: { file: ProjectFile; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>NC</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {[file.machining_time && `⏱ ${file.machining_time}`, file.paths != null && `${file.paths} paths`, file.tool_count != null && `${file.tool_count} tool${file.tool_count === 1 ? '' : 's'}`, file.source && `· ${file.source}`].filter(Boolean).join('  ')}
        </div>
      </div>
    </button>
  )
}

function FileDetail({ file }: { file: ProjectFile }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{file.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {[file.machining_time && `Time · ${file.machining_time}`, file.paths != null && `Paths · ${file.paths}`, file.tool_count != null && `Tools · ${file.tool_count}`, file.source && `Source · ${file.source}`].filter(Boolean).join('   |   ')}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(file.machine || file.material) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {file.machine && <MetaBox icon="🛠" label="Machine" value={file.machine} />}
            {file.material && <MetaBox icon="🧱" label="Material" value={file.material} />}
          </div>
        )}
        {file.tools && file.tools.length > 0 && (
          <MetaBox icon="🔧" label="Tools" value={file.tools.join(' · ')} />
        )}
        {file.nc_paths && file.nc_paths.length > 0 && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚙ NC Path ({file.nc_paths.length})</div>
            {file.nc_paths.map((p, i) => (
              <div key={i} style={{ paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.name}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>  |  Tool: {p.tool}</span>
                </div>
                {p.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{p.note}</div>}
              </div>
            ))}
          </div>
        )}
        {isReal(file.url) && (
          <a href={file.url} download={file.name}
            style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
            ⬇ Download {file.name}
          </a>
        )}
      </div>
    </div>
  )
}

function MetaBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Comments({ project, user, onSignInRequired }: { project: ProjectDetailT; user: unknown; onSignInRequired: () => void }) {
  const [draft, setDraft] = useState('')
  const comments = project.comments ?? []
  return (
    <div style={{ maxWidth: 860 }}>
      {/* Input */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onFocus={() => { if (!user) onSignInRequired() }}
            placeholder="Say something…"
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          {draft && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>💬 Commenting is coming soon.</div>
          )}
        </div>
      </div>

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 14 }}>No comments yet — be the first!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: c.avatar_color ?? 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {c.author[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.author}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.when}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SecHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{children}</h2>
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(249,115,22,.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.9s linear infinite' }} />
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteNav />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
