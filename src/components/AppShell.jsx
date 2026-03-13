import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const TABS = [
  { path: '/',              icon: HomeIcon,    label: 'Feed'     },
  { path: '/discover',      icon: DiscoverIcon,label: 'Discover' },
  { path: '/log',           icon: LogIcon,     label: 'Log',  special: true },
  { path: '/messages',      icon: DMIcon,      label: 'DMs'      },
  { path: '/profile',       icon: ProfileIcon, label: 'Me'       },
]

export default function AppShell({ children }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const session = useAuth()
  const uid = session?.user?.id
  const [unreadDMs, setUnreadDMs] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  useEffect(() => {
    if (!uid) return
    checkUnread()
    // Subscribe to new messages for badge
    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${uid}` },
        () => setUnreadDMs(c => c + 1))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => setUnreadNotifs(c => c + 1))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [uid])

  async function checkUnread() {
    const [{ count: dms }, { count: notifs }] = await Promise.all([
      supabase.from('messages').select('*', { count:'exact', head:true }).eq('recipient_id', uid).eq('read', false),
      supabase.from('notifications').select('*', { count:'exact', head:true }).eq('user_id', uid).eq('read', false),
    ])
    setUnreadDMs(dms || 0)
    setUnreadNotifs(notifs || 0)
  }

  function handleTabPress(path) {
    if (path === '/messages') setUnreadDMs(0)
    nav(path)
  }

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'var(--bg)', overflow:'hidden' }}>
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', paddingTop:'var(--safe-top)' }}>
        {children}
      </div>

      <nav style={{
        display: 'flex', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(13,0,24,.95) 0%, rgba(26,0,48,1) 100%)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        borderTop: '2px solid rgba(255,45,155,.35)',
        boxShadow: '0 -4px 32px rgba(255,45,155,.2), 0 -1px 0 rgba(0,180,255,.15)',
        paddingBottom: 'var(--safe-bot)',
        height: 'calc(var(--nav-h) + var(--safe-bot))',
        flexShrink: 0, zIndex: 100,
      }}>
        {TABS.map(tab => {
          const active = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path))
          const Icon = tab.icon
          const badge = tab.path === '/messages' ? unreadDMs : 0
          if (tab.special) return (
            <button key={tab.path} onClick={() => handleTabPress(tab.path)}
              style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', background:'none', border:'none', paddingBottom:4 }}>
              <div style={{
                width:56, height:56, borderRadius:'50%', marginTop:-26,
                background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 0 0 3px var(--bg), 0 0 0 5px var(--accent), 0 8px 32px rgba(255,45,155,.6)',
                transition:'transform .15s',
                fontSize: 22,
              }}>
                ✦
              </div>
            </button>
          )
          return (
            <button key={tab.path} onClick={() => handleTabPress(tab.path)}
              style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                background:'none', border:'none', padding:'10px 0',
                color: active ? 'var(--gold)' : 'var(--text-3)',
                transition:'color .2s', position:'relative',
              }}>
              <div style={{ position:'relative' }}>
                <Icon size={22} color={active ? 'var(--gold)' : 'var(--text-3)'} />
                {active && (
                  <div style={{
                    position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
                    width:4, height:4, borderRadius:'50%',
                    background:'var(--gold)',
                    boxShadow:'0 0 6px var(--gold)',
                  }}/>
                )}
                {badge > 0 && (
                  <div style={{
                    position:'absolute', top:-5, right:-8,
                    minWidth:16, height:16, borderRadius:8, padding:'0 3px',
                    background:'var(--accent)', fontSize:9, fontWeight:900,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', border:'2px solid var(--bg)',
                    fontFamily:'var(--font-display)',
                  }}>{badge > 9 ? '9+' : badge}</div>
                )}
              </div>
              <span style={{
                fontSize:9, fontFamily:'var(--font-display)',
                letterSpacing:.5, textTransform:'uppercase', fontWeight:400,
              }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function HomeIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
}
function DiscoverIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
}
function LogIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function DMIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></svg>
}
function ProfileIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
