import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useLang } from '../contexts/LanguageContext'

interface Props {
  /** Page-specific buttons rendered left of the shared controls (e.g. My Creations). */
  rightExtra?: ReactNode
}

export function SiteNav({ rightExtra }: Props) {
  const { user, signOut, promptSignIn } = useAuth()
  const { theme, toggle: toggleTheme }  = useTheme()
  const { lang, toggle: toggleLang }    = useLang()
  const navigate = useNavigate()

  const tabStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    fontSize: 14, fontWeight: 600, textDecoration: 'none',
    color: isActive ? 'var(--text)' : 'var(--muted)',
    padding: '4px 2px',
    borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
    transition: 'color .15s',
  })

  const pill: React.CSSProperties = {
    padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    fontSize: 12, fontWeight: 700, color: 'var(--text-dim)',
    letterSpacing: '.02em', transition: 'all .2s',
  }

  return (
    <header style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexShrink: 0, position: 'sticky', top: 0, zIndex: 60,
    }}>
      {/* Left: brand + nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <NavLink to="/" end style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>W</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>WeCarver</span>
        </NavLink>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NavLink to="/" end style={tabStyle}>Projects</NavLink>
          <NavLink to="/create" style={tabStyle}>AI Create</NavLink>
          <a
            href="https://twotrees3d.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 14, fontWeight: 600, textDecoration: 'none', color: 'var(--muted)', padding: '4px 2px', borderBottom: '2px solid transparent' }}
          >
            Store ↗
          </a>
        </nav>
      </div>

      {/* Right: page extras + shared controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rightExtra}

        <button
          onClick={() => navigate('/projects/new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            background: 'var(--accent)', border: 'none',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}
        >
          ⬆ Upload
        </button>

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={pill}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <button
          onClick={toggleLang}
          title={lang === 'en' ? '切换到中文' : 'Switch to English'}
          style={pill}
        >
          {lang === 'en' ? '中文' : 'EN'}
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </span>
            <button onClick={signOut} style={{ ...pill, fontWeight: 600, fontSize: 11 }}>Sign out</button>
          </div>
        ) : (
          <button
            onClick={promptSignIn}
            style={{
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              background: 'var(--accent)', border: 'none',
              fontSize: 12, fontWeight: 700, color: '#fff',
            }}
          >Sign in</button>
        )}
      </div>
    </header>
  )
}
