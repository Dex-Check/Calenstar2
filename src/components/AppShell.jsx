import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const TABS = [
  { path: '/',              icon: HomeIcon,    label: 'Feed'      },
  { path: '/discover',      icon: DiscoverIcon,label: 'Discover'  },
  { path: '/log',           icon: LogIcon,     label: 'Log',  special: true },
  { path: '/notifications', icon: BellIcon,    label: 'Activity'  },
  { path: '/profile',       icon: ProfileIcon, label: 'Me'        },
]

export default function AppShell({ children }) {
  const loc = useNavigate()
  const { pathname } = useLocation()

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'var(--bg)', overflow:'hidden' }}>
      {/* Main scroll area */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', paddingTop:'var(--safe-top)' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <nav style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(10,10,15,.97)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'var(--safe-bot)',
        height: 'calc(var(--nav-h) + var(--safe-bot))',
        flexShrink: 0,
        zIndex: 100,
      }}>
        {TABS.map(tab => {
          const active = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path))
          const Icon = tab.icon
          if (tab.special) return (
            <button key={tab.path} onClick={() => loc(tab.path)}
              style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', background:'none', border:'none', paddingBottom:4 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', marginTop: -22,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 28px var(--accent-glow), 0 4px 16px rgba(0,0,0,.5)',
                transition: 'transform .15s',
              }}>
                <Icon size={22} color="#fff" />
              </div>
            </button>
          )
          return (
            <button key={tab.path} onClick={() => loc(tab.path)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', padding:'10px 0', color: active ? 'var(--accent)' : 'var(--text-3)', transition:'color .2s' }}>
              <Icon size={22} color={active ? 'var(--accent)' : 'var(--text-3)'} />
              <span style={{ fontSize:9, fontFamily:'var(--font-display)', letterSpacing:1, textTransform:'uppercase', fontWeight:600 }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────
function HomeIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
}
function DiscoverIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
}
function LogIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function BellIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function ProfileIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
