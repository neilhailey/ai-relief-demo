import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthModal } from '../components/AuthModal'

interface AuthCtx {
  user:         User | null
  loading:      boolean
  signOut:      () => Promise<void>
  promptSignIn: () => void
}

const AuthContext = createContext<AuthCtx>({
  user:         null,
  loading:      true,
  signOut:      async () => {},
  promptSignIn: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, promptSignIn: () => setShowAuth(true) }}>
      {children}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
