import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { SiteNav } from '../components/SiteNav'
import { useAuth } from '../contexts/AuthContext'
import {
  loadProjects, CATEGORIES, MACHINES, MATERIALS,
  type ProjectCard, type ProjectSort,
} from '../lib/projects'

const SORTS: { key: ProjectSort; label: string }[] = [
  { key: 'newest',    label: 'Newest'          },
  { key: 'downloads', label: 'Most Downloaded' },
  { key: 'likes',     label: 'Most Liked'      },
]

export function ProjectsGallery() {
  const { user } = useAuth()
  const [category, setCategory] = useState<string | null>(null)
  const [machine,  setMachine]  = useState<string | null>(null)
  const [material, setMaterial] = useState<string | null>(null)
  const [sort,     setSort]     = useState<ProjectSort>('newest')
  const [items,    setItems]    = useState<ProjectCard[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await loadProjects(user?.id ?? null, { category, machine, material }, sort)
    setItems(data)
    setLoading(false)
  }, [user?.id, category, machine, material, sort])

  useEffect(() => { void load() }, [load])

  function resetFilters() {
    setCategory(null); setMachine(null); setMaterial(null)
  }

  const sideBtn = (active: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
    background: active ? 'rgba(249,115,22,.12)' : 'transparent',
    border: 'none',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontSize: 13, fontWeight: active ? 700 : 500,
    marginBottom: 2, transition: 'all .15s',
  })

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px', borderRadius: 16, cursor: 'pointer',
    background: active ? 'rgba(249,115,22,.12)' : 'var(--surface2)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--muted)',
    fontSize: 11, fontWeight: 600, marginRight: 6, marginBottom: 6,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteNav />

      {/* Hero banner — advertising slot. Drop a real TwoTrees ED1 photo at
          public/hero-projects.jpg; falls back to the generated banner until then. */}
      <div style={{ width: '100%', background: '#0a0f1c', borderBottom: '1px solid var(--border)' }}>
        <img
          src="/hero-projects.jpg"
          onError={e => { const t = e.currentTarget; if (!t.src.endsWith('.svg')) t.src = '/hero-projects.svg' }}
          alt="WeCarver community projects"
          style={{ display: 'block', width: '100%', height: 320, objectFit: 'cover' }}
        />
      </div>

      <div style={{ display: 'flex', flex: 1, maxWidth: 1440, width: '100%', margin: '0 auto' }}>
        {/* ── Sidebar ── */}
        <aside style={{
          width: 232, flexShrink: 0, padding: '24px 16px',
          borderRight: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Category
          </div>
          <button onClick={() => setCategory(null)} style={sideBtn(category === null)}>▦ All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={sideBtn(category === c)}>{c}</button>
          ))}

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>
            Machine
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 4px' }}>
            {MACHINES.map(m => (
              <button key={m} onClick={() => setMachine(machine === m ? null : m)} style={chip(machine === m)}>{m}</button>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' }}>
            Material
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 4px' }}>
            {MATERIALS.map(m => (
              <button key={m} onClick={() => setMaterial(material === m ? null : m)} style={chip(material === m)}>{m}</button>
            ))}
          </div>

          {(category || machine || material) && (
            <button
              onClick={resetFilters}
              style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              ↻ Reset all filters
            </button>
          )}
        </aside>

        {/* ── Main grid ── */}
        <main style={{ flex: 1, padding: '20px 24px 48px', minWidth: 0 }}>
          {/* Sort row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, marginBottom: 20 }}>
            {SORTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: sort === key ? 700 : 500,
                  color: sort === key ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

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
              <div style={{ fontSize: 44, marginBottom: 14 }}>📦</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No projects yet</div>
              <div style={{ fontSize: 13 }}>Be the first to upload a project for the community.</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 20,
            }}>
              {items.map(p => <ProjectCardView key={p.id} project={p} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ProjectCardView({ project }: { project: ProjectCard }) {
  const cover = project.pictures[0]
  return (
    <Link
      to={`/projects/${project.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
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
        <div style={{ position: 'relative', paddingTop: '72%', background: '#0a0d12' }}>
          {cover ? (
            <img src={cover} alt={project.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 34 }}>🗂</div>
          )}
          {project.category && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              background: 'rgba(0,0,0,.6)', color: '#fff', backdropFilter: 'blur(4px)',
            }}>
              {project.category}
            </span>
          )}
          {/* Bottom overlay: author + stats */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '18px 10px 8px',
            background: 'linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0))',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>
                {(project.author_name ?? 'W')[0].toUpperCase()}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.author_name ?? 'WeCarver'}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#fff', flexShrink: 0 }}>
              <span>👍 {project.like_count}</span>
              <span>⬇ {project.download_count}</span>
            </span>
          </div>
        </div>

        <div style={{ padding: '10px 12px 12px' }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.name || 'Untitled project'}
          </div>
        </div>
      </div>
    </Link>
  )
}
