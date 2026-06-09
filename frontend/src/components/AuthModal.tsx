import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ onClose, onSuccess }: Props) {
  const { t } = useLang()
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)   // signup confirmation

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true); setError(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setDone(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onSuccess()
        onClose()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 400, background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16, padding: '32px 28px',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {mode === 'signin' ? t.signInTitle : t.signUpTitle}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {mode === 'signin' ? t.signInSubtitle : t.signUpSubtitle}
          </div>
        </div>

        {done ? (
          <div style={{
            padding: '16px', borderRadius: 10,
            background: 'rgba(5,150,105,.1)', border: '1px solid rgba(5,150,105,.3)',
            color: '#6ee7b7', fontSize: 14, textAlign: 'center', lineHeight: 1.6,
          }}>
            {t.checkEmail}
            <button
              onClick={() => { setMode('signin'); setDone(false) }}
              style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
            >{t.goToSignIn}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <input
                type="email"
                placeholder={t.emailAddress}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  padding: '11px 14px', borderRadius: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 14, outline: 'none',
                }}
              />
              <input
                type="password"
                placeholder={t.password}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  padding: '11px 14px', borderRadius: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 14, outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 12, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                color: '#fca5a5', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? 'rgba(249,115,22,.5)' : 'var(--accent)',
                border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                color: '#fff', fontSize: 15, fontWeight: 700,
                transition: 'opacity .2s',
              }}
            >
              {loading ? '…' : mode === 'signin' ? t.signInBtn : t.createAccountBtn}
            </button>
          </form>
        )}

        {/* Toggle */}
        {!done && (
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            {mode === 'signin' ? t.noAccount + ' ' : t.alreadyHaveOne + ' '}
            <button
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-glow)', cursor: 'pointer', fontSize: 13 }}
            >
              {mode === 'signin' ? t.signUpFree : t.signInBtn}
            </button>
          </p>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none',
            color: 'var(--muted)', fontSize: 20, cursor: 'pointer',
            lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  )
}
