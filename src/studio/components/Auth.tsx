// Sign-in screen and session gate. The session is kept on-device, so a
// signed-in artist can keep working offline.
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { Btn, Field } from './ui'

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
)

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        if (error) throw error
        setMsg('If that email has an account, a reset link is on its way.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const social = async (provider: 'google' | 'apple') => {
    setErr(null)
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin })
    if (result.error) setErr(result.error.message ?? 'Sign-in failed')
  }

  return (
    <div className="page auth-page">
      <h1>{mode === 'signup' ? 'Create your studio account' : mode === 'forgot' ? 'Reset your password' : 'Sign in to your studio'}</h1>
      <p className="lede">Your records, settings and photos are saved to your private account and stay available offline on this device.</p>
      {mode !== 'forgot' && (
        <div className="auth-social">
          <button type="button" className="social-btn google-btn" onClick={() => void social('google')}><GoogleG /><span>Continue with Google</span></button>
          <button type="button" className="social-btn apple-btn" onClick={() => void social('apple')}><span>Continue with Apple</span></button>
          <p className="fineprint auth-or">or use email</p>
        </div>
      )}
      <form className="form" onSubmit={submit}>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode !== 'forgot' && (
          <Field label="Password"><input className="input" type="password" minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        )}
        {err && <p className="auth-error" role="alert">{err}</p>}
        {msg && <p className="fineprint">{msg}</p>}
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
        </Btn>
      </form>
      <div className="row-actions auth-switch">
        {mode !== 'signin' && <Btn variant="ghost" onClick={() => setMode('signin')}>Have an account? Sign in</Btn>}
        {mode !== 'signup' && <Btn variant="ghost" onClick={() => setMode('signup')}>New here? Create account</Btn>}
        {mode === 'signin' && <Btn variant="ghost" onClick={() => setMode('forgot')}>Forgot password?</Btn>}
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    void supabase.auth.getSession().then(({ data: d }) => setSession(d.session))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="page"><p>Loading your studio…</p></div>
  if (!session) return <div className="app-shell"><main className="app-main"><AuthScreen /></main></div>
  return <>{children(session)}</>
}
