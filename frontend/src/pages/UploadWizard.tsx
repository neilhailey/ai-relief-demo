import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SiteNav } from '../components/SiteNav'
import { RichTextEditor } from '../components/RichTextEditor'
import { useAuth } from '../contexts/AuthContext'
import {
  uploadProjectFile, uploadProjectImage, createProject, saveProjectFiles,
  CATEGORIES, MACHINES, MATERIALS, NC_EXTS, MODEL_EXTS,
  type ProjectFile, type ProjectFileKind, type LicenseAdapt, type ProjectInput,
} from '../lib/projects'

type WizStep = 1 | 2 | 3

const STEPS: { n: WizStep; label: string }[] = [
  { n: 1, label: 'Files' },
  { n: 2, label: 'Information' },
  { n: 3, label: 'Publish' },
]

function stripTags(html: string) { return html.replace(/<[^>]*>/g, '').trim() }
function uid() { return Math.random().toString(36).slice(2, 12) }

export function UploadWizard() {
  const { user, promptSignIn } = useAuth()
  const navigate = useNavigate()

  const [uploadId] = useState(uid)
  const [step, setStep] = useState<WizStep>(1)

  // Files
  const [ncFiles,    setNcFiles]    = useState<ProjectFile[]>([])
  const [camFiles,   setCamFiles]   = useState<ProjectFile[]>([])
  const [modelFiles, setModelFiles] = useState<ProjectFile[]>([])
  const [attachments, setAttachments] = useState<ProjectFile[]>([])

  // Information
  const [isOriginal,  setIsOriginal]  = useState(true)
  const [remixSource, setRemixSource] = useState('')
  const [pictures,    setPictures]    = useState<string[]>([])
  const [name,        setName]        = useState('')
  const [category,    setCategory]    = useState('')
  const [adapt,       setAdapt]       = useState<LicenseAdapt | ''>('')
  const [commercial,  setCommercial]  = useState(true)
  const [description, setDescription] = useState('')
  const [tags,        setTags]        = useState<string[]>([])
  const [tagInput,    setTagInput]    = useState('')
  const [postProcess, setPostProcess] = useState('')
  const [machines,    setMachines]    = useState<string[]>([])
  const [materials,   setMaterials]   = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [uploadingPics, setUploadingPics] = useState(false)

  // ── Requirement checklist ──
  const reqs: { key: string; label: string; done: boolean }[] = [
    { key: 'nc',    label: 'NC File',              done: ncFiles.length > 0 },
    { key: 'cam',   label: 'CAM File',             done: camFiles.length > 0 },
    { key: 'model', label: 'Model File',           done: modelFiles.length > 0 },
    { key: 'orig',  label: 'Original Declaration', done: true },
    { key: 'pics',  label: 'Project Pictures',     done: pictures.length > 0 },
    { key: 'name',  label: 'Project Name',         done: name.trim().length > 0 },
    { key: 'cat',   label: 'Category',             done: category !== '' },
    { key: 'lic',   label: 'License',              done: adapt !== '' },
    { key: 'desc',  label: 'Description',          done: stripTags(description).length > 0 },
  ]
  const allDone = reqs.every(r => r.done)

  function buildInput(): ProjectInput {
    return {
      name: name.trim(),
      description,
      category: category || null,
      is_original: isOriginal,
      remix_source: isOriginal ? null : (remixSource.trim() || null),
      license_adapt: (adapt || 'yes') as LicenseAdapt,
      license_commercial: commercial,
      post_process: postProcess.trim() || null,
      pictures,
      tags,
      machines,
      materials,
    }
  }

  async function persist(status: 'draft' | 'published') {
    if (!user) { promptSignIn(); return }
    setSaving(true)
    const id = await createProject(buildInput(), status)
    if (!id) { setSaving(false); alert('Could not save project. Please try again.'); return }
    await saveProjectFiles(id, [...ncFiles, ...camFiles, ...modelFiles, ...attachments])
    setSaving(false)
    navigate(status === 'published' ? `/projects/${id}` : '/')
  }

  function addTag() {
    const v = tagInput.trim().replace(/^#/, '')
    if (v && tags.length < 5 && !tags.includes(v)) setTags([...tags, v])
    setTagInput('')
  }

  if (!user) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '100px 24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔐</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Sign in to upload a project</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>You need an account to publish projects to the community.</div>
          <button onClick={promptSignIn} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            Sign in
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 24px 100px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 268px', gap: 24, alignItems: 'start' }}>
        {/* ── Left: stepper + step content ── */}
        <div style={{ minWidth: 0 }}>
          {/* Stepper */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center' }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <button onClick={() => setStep(s.n)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: step >= s.n ? 'var(--text)' : 'var(--surface2)',
                    color: step >= s.n ? 'var(--bg)' : 'var(--muted)',
                  }}>{step > s.n ? '✓' : s.n}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: step >= s.n ? 'var(--text)' : 'var(--muted)' }}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, margin: '0 14px', background: step > s.n ? 'var(--text)' : 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Files */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card title="NC File" required>
                <FileDrop kind="nc" uploadId={uploadId} accept={NC_EXTS} files={ncFiles} setFiles={setNcFiles}
                  hint="Supported formats: nc, cnc, ngc, tap, gcode" big />
              </Card>
              <Card title="CAM File" required hint="Your CAM project / setup file so others can edit the toolpaths.">
                <FileDrop kind="cam" uploadId={uploadId} files={camFiles} setFiles={setCamFiles} label="+ Add CAM Files" />
              </Card>
              <Card title="Model File" required hint="The source 3D model (STL, STEP, etc.).">
                <FileDrop kind="model" uploadId={uploadId} accept={MODEL_EXTS} files={modelFiles} setFiles={setModelFiles} label="+ Add Model Files" />
              </Card>
            </div>
          )}

          {/* Step 2: Information */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card title="Add Project Information">
                {/* Original / remix */}
                <Label required>Is this your original creation?</Label>
                <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
                  <Radio checked={isOriginal} onChange={() => setIsOriginal(true)} label="Original Creation" />
                  <Radio checked={!isOriginal} onChange={() => setIsOriginal(false)} label="Remix / Derived Work" />
                </div>
                {!isOriginal && (
                  <input value={remixSource} onChange={e => setRemixSource(e.target.value)} placeholder="Link to the original work (optional)"
                    style={inputStyle} />
                )}

                {/* Pictures */}
                <Label required>Project Pictures ({pictures.length}/10)</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                  {pictures.map((pic, i) => (
                    <div key={i} style={{ position: 'relative', width: 104, height: 104, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setPictures(pictures.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  ))}
                  {pictures.length < 10 && (
                    <ImagePicker uploadId={uploadId} uploading={uploadingPics} setUploading={setUploadingPics}
                      onAdd={url => setPictures(p => [...p, url])} remaining={10 - pictures.length} />
                  )}
                </div>

                {/* Name */}
                <Label required>Project Name</Label>
                <input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Please input project name"
                  style={{ ...inputStyle, marginBottom: 18 }} />

                {/* Category */}
                <Label required>Category</Label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 18, cursor: 'pointer' }}>
                  <option value="">Please select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* License */}
                <Label required>License</Label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Allow adaptations of your work to be shared?</div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                    <Radio checked={adapt === 'yes'} onChange={() => setAdapt('yes')} label="Yes" />
                    <Radio checked={adapt === 'no'}  onChange={() => setAdapt('no')}  label="No (ND)" />
                    <Radio checked={adapt === 'sa'}  onChange={() => setAdapt('sa')}  label="Yes, as long as others share alike (SA)" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Allow commercial use?</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <Radio checked={commercial} onChange={() => setCommercial(true)} label="Yes" />
                    <Radio checked={!commercial} onChange={() => setCommercial(false)} label="No (NC)" />
                  </div>
                </div>

                {/* Machines / materials */}
                <Label>Compatible Machines</Label>
                <ChipMulti options={[...MACHINES]} selected={machines} setSelected={setMachines} />
                <div style={{ height: 14 }} />
                <Label>Materials</Label>
                <ChipMulti options={[...MATERIALS]} selected={materials} setSelected={setMaterials} />
              </Card>

              <Card title="Description" required>
                <RichTextEditor value={description} onChange={setDescription} placeholder="Describe your project, the process, tips…" />
                <div style={{ marginTop: 18 }}>
                  <Label>Tags ({tags.length}/5)</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        #{tag}
                        <button onClick={() => setTags(tags.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </span>
                    ))}
                  </div>
                  {tags.length < 5 && (
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                      placeholder="Type a tag and press Enter" style={inputStyle} />
                  )}
                </div>
              </Card>

              <Card title="Add Other Information">
                <Label>Post Process</Label>
                <textarea value={postProcess} onChange={e => setPostProcess(e.target.value)} rows={3}
                  placeholder="Sanding, finishing, assembly notes…" style={{ ...inputStyle, resize: 'vertical', marginBottom: 18 }} />
                <Label>Attachments ({attachments.length}/10)</Label>
                <FileDrop kind="attachment" uploadId={uploadId} files={attachments} setFiles={setAttachments} label="+ Add attachment" />
              </Card>
            </div>
          )}

          {/* Step 3: Publish */}
          {step === 3 && (
            <Card title="Review & Publish">
              <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.9 }}>
                <Row label="Project name" value={name || '—'} />
                <Row label="Category" value={category || '—'} />
                <Row label="Files" value={`${ncFiles.length} NC · ${camFiles.length} CAM · ${modelFiles.length} model · ${attachments.length} attachments`} />
                <Row label="Pictures" value={`${pictures.length}`} />
                <Row label="License" value={`${isOriginal ? 'Original' : 'Remix'} · ${adapt || '—'} · ${commercial ? 'commercial ok' : 'non-commercial'}`} />
                <Row label="Tags" value={tags.length ? tags.map(t => '#' + t).join(' ') : '—'} />
              </div>
              {!allDone && (
                <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>
                  ⚠ Some required fields are still missing (see the checklist). You can still <b>Save Draft</b>, but publishing needs everything complete.
                </div>
              )}
            </Card>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as WizStep)} style={btnSecondary}>← Previous Step</button>
            )}
            <button onClick={() => persist('draft')} disabled={saving} style={btnSecondary}>
              {saving ? '…' : '☁ Save Draft'}
            </button>
            {step < 3 ? (
              <button onClick={() => setStep((step + 1) as WizStep)} style={btnPrimary}>Next Step →</button>
            ) : (
              <button onClick={() => persist('published')} disabled={saving || !allDone} style={{ ...btnPrimary, opacity: allDone ? 1 : 0.5, cursor: allDone ? 'pointer' : 'not-allowed' }}>
                {saving ? 'Publishing…' : '✈ Publish'}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: help + checklist ── */}
        <aside style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Help</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              Fill in each required field. The checklist below turns blue as you complete items.
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Required Information</div>
            {reqs.map(r => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: r.done ? 'var(--text)' : 'var(--muted)' }}>
                  <span style={{ color: '#ef4444', marginRight: 5 }}>*</span>{r.label}
                </span>
                <span style={{ color: r.done ? 'var(--accent)' : 'var(--border)', fontWeight: 700 }}>✓</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Shell>
  )
}

// ── Small building blocks ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 8,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, outline: 'none',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 700,
}
const btnSecondary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text-dim)', fontSize: 14, fontWeight: 600,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteNav />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function Card({ title, required, hint, children }: { title: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: hint ? 4 : 16 }}>
        {required && <span style={{ color: '#ef4444', marginRight: 5 }}>*</span>}{title}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
      {required && <span style={{ color: '#ef4444', marginRight: 5 }}>*</span>}{children}
    </div>
  )
}

function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
      <span style={{ width: 120, flexShrink: 0, color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function ChipMulti({ options, selected, setSelected }: { options: string[]; selected: string[]; setSelected: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <button key={opt} onClick={() => setSelected(on ? selected.filter(s => s !== opt) : [...selected, opt])}
            style={{
              padding: '5px 13px', borderRadius: 16, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: on ? 'rgba(249,115,22,.12)' : 'var(--surface2)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              color: on ? 'var(--accent)' : 'var(--muted)',
            }}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// File uploader with drag/drop + button
function FileDrop({ kind, uploadId, accept, files, setFiles, label = '+ Add Files', hint, big }: {
  kind: ProjectFileKind
  uploadId: string
  accept?: string[]
  files: ProjectFile[]
  setFiles: React.Dispatch<React.SetStateAction<ProjectFile[]>>
  label?: string
  hint?: string
  big?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setErr(null); setBusy(true)
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (accept && !accept.includes(ext)) {
        setErr(`"${file.name}" is not a supported format`)
        continue
      }
      const uploaded = await uploadProjectFile(file, uploadId, kind)
      if (uploaded) setFiles(prev => [...prev, uploaded])
      else setErr(`Failed to upload "${file.name}"`)
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input ref={inputRef} type="file" multiple hidden
        accept={accept ? accept.map(e => '.' + e).join(',') : undefined}
        onChange={e => handleFiles(e.target.files)} />

      {big ? (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          style={{ background: 'var(--surface2)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', border: '1px dashed var(--border)' }}
        >
          <div style={{ fontSize: 26, marginBottom: 8 }}>🗂</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag your files here</div>
          {hint && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{hint}</div>}
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            style={{ ...btnPrimary, background: 'var(--accent)', color: '#fff' }}>
            {busy ? 'Uploading…' : label}
          </button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          style={{ width: '100%', padding: '11px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600 }}>
          {busy ? 'Uploading…' : label}
        </button>
      )}

      {err && <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>{err}</div>}

      {files.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 11px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImagePicker({ uploadId, onAdd, remaining, uploading, setUploading }: {
  uploadId: string
  onAdd: (url: string) => void
  remaining: number
  uploading: boolean
  setUploading: (v: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handle(list: FileList | null) {
    if (!list) return
    setUploading(true)
    for (const file of Array.from(list).slice(0, remaining)) {
      const url = await uploadProjectImage(file, uploadId)
      if (url) onAdd(url)
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => handle(e.target.files)} />
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        style={{ width: 104, height: 104, borderRadius: 10, cursor: 'pointer', background: 'var(--surface2)', border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 26 }}>
        {uploading ? '…' : '+'}
      </button>
    </>
  )
}
