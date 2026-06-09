import { useState } from 'react'
import { publishCreation, unpublishCreation } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

interface Props {
  dbId:      string | null   // null = not signed in / not saved yet
  isPublic:  boolean
  onToggle:  (nowPublic: boolean) => void
}

export function PublishButton({ dbId, isPublic, onToggle }: Props) {
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  if (!dbId) {
    return (
      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '4px 0' }}>
        {t.publishSignIn}
      </div>
    )
  }

  async function handleClick() {
    if (!dbId) return
    setLoading(true)
    const ok = isPublic
      ? await unpublishCreation(dbId)
      : await publishCreation(dbId)
    setLoading(false)
    if (ok) {
      onToggle(!isPublic)
      if (!isPublic) setDone(true)  // show "Published!" briefly
      setTimeout(() => setDone(false), 3000)
    }
  }

  if (done) {
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(5,150,105,.15)', border: '1px solid rgba(5,150,105,.35)',
        color: '#6ee7b7', fontSize: 13, fontWeight: 600, textAlign: 'center',
      }}>
        {t.publishedDone}
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: '100%', padding: '10px 14px',
        background: isPublic ? 'rgba(5,150,105,.15)' : 'var(--surface2)',
        border: `1px solid ${isPublic ? 'rgba(5,150,105,.4)' : 'var(--border)'}`,
        borderRadius: 8, cursor: loading ? 'default' : 'pointer',
        fontSize: 12, fontWeight: 700,
        color: isPublic ? '#6ee7b7' : 'var(--text-dim)',
        transition: 'all .2s', opacity: loading ? 0.6 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      {loading ? '…' : isPublic ? t.publishRemove : t.publishToGallery}
    </button>
  )
}
