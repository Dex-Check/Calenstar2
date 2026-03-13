import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import AuthPage          from './pages/AuthPage'
import OnboardingPage    from './pages/OnboardingPage'
import FeedPage          from './pages/FeedPage'
import LogPage           from './pages/LogPage'
import ProfilePage       from './pages/ProfilePage'
import DiscoverPage      from './pages/DiscoverPage'
import NotificationsPage from './pages/NotificationsPage'
import AppShell          from './components/AppShell'
import Spinner           from './components/Spinner'

function Routes_() {
  const session = useAuth()
  const [needsOnboarding, setNeedsOnboarding] = useState(null) // null=checking

  useEffect(() => {
    if (!session) { setNeedsOnboarding(null); return }
    checkOnboarding()
  }, [session])

  async function checkOnboarding() {
    const { data } = await supabase
      .from('profiles')
      .select('onboarded, username')
      .eq('id', session.user.id)
      .single()
    // Needs onboarding if never completed it, or username is still the raw email prefix with special chars
    setNeedsOnboarding(!data?.onboarded)
  }

  // Loading state
  if (session === undefined || (session && needsOnboarding === null)) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:32, color:'var(--accent)', filter:'drop-shadow(0 0 12px rgba(255,77,109,.4))' }}>★</div>
      <Spinner />
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="*" element={<AuthPage />} />
    </Routes>
  )

  if (needsOnboarding) return (
    <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
  )

  return (
    <AppShell>
      <Routes>
        <Route path="/"              element={<FeedPage />} />
        <Route path="/log"           element={<LogPage />} />
        <Route path="/discover"      element={<DiscoverPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile"       element={<ProfilePage />} />
        <Route path="/profile/:id"   element={<ProfilePage />} />
        <Route path="*"              element={<Navigate to="/" />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes_ />
    </AuthProvider>
  )
}
