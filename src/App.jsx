import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage   from './pages/AuthPage'
import FeedPage   from './pages/FeedPage'
import LogPage    from './pages/LogPage'
import ProfilePage from './pages/ProfilePage'
import DiscoverPage from './pages/DiscoverPage'
import NotificationsPage from './pages/NotificationsPage'
import AppShell   from './components/AppShell'
import Spinner    from './components/Spinner'

function Routes_() {
  const session = useAuth()

  if (session === undefined) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:32 }}>★</div>
      <Spinner />
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="*" element={<AuthPage />} />
    </Routes>
  )

  return (
    <AppShell>
      <Routes>
        <Route path="/"           element={<FeedPage />} />
        <Route path="/log"        element={<LogPage />} />
        <Route path="/discover"   element={<DiscoverPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile"    element={<ProfilePage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="*"           element={<Navigate to="/" />} />
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
