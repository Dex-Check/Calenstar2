import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'
import s from './AuthPage.module.css'

export default function AuthPage() {
  const [mode, setMode]       = useState('login') // login | signup
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g,'') } }
        })
        if (error) throw error
        setSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.logo}>★</div>
        <h2 className={s.title}>Check your email</h2>
        <p className={s.sub}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
      </div>
    </div>
  )

  return (
    <div className={s.wrap}>
      <div className={s.bg} />
      <div className={s.card + ' scale-in'}>
        <div className={s.logo}>⭐</div>
        <h1 className={s.brand}>★ CalenStar ★</h1>
        <p className={s.tagline}>✦ your daily life, shared ✦</p>

        <div className={s.tabs}>
          <button className={mode==='login'?s.tabActive:s.tab} onClick={()=>{setMode('login');setError(null)}}>Sign in</button>
          <button className={mode==='signup'?s.tabActive:s.tab} onClick={()=>{setMode('signup');setError(null)}}>Create account</button>
        </div>

        <form onSubmit={handleSubmit} className={s.form}>
          {mode === 'signup' && (
            <div className={s.field}>
              <label className={s.label}>Username</label>
              <input className={s.input} type="text" placeholder="yourname" value={username} onChange={e=>setUsername(e.target.value)} required autoCapitalize="none" autoCorrect="off" />
            </div>
          )}
          <div className={s.field}>
            <label className={s.label}>Email</label>
            <input className={s.input} type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className={s.field}>
            <label className={s.label}>Password</label>
            <input className={s.input} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <p className={s.error}>{error}</p>}
          <button className={s.submit} type="submit" disabled={loading}>
            {loading ? <Spinner size={18} color="#fff" /> : mode==='login' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>
      </div>
    </div>
  )
}
