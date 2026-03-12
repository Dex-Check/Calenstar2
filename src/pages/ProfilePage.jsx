import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'
import s from './ProfilePage.module.css'

export default function ProfilePage() {
  const { id } = useParams()
  const session = useAuth()
  const nav = useNavigate()

  const uid        = id || session?.user.id
  const isOwn      = uid === session?.user.id

  const [profile, setProfile]   = useState(null)
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [tab, setTab] = useState('grid') // grid | list

  useEffect(() => { if (uid) load() }, [uid])

  async function load() {
    setLoading(true)
    try {
      const [{ data: prof }, { data: ents }, { count: frs }, { count: fing }, { data: myFollow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('entries').select('*').eq('user_id', uid).eq('is_public', true).order('date', { ascending: false }).limit(60),
        supabase.from('follows').select('*', { count:'exact', head:true }).eq('following_id', uid).eq('status','accepted'),
        supabase.from('follows').select('*', { count:'exact', head:true }).eq('follower_id', uid).eq('status','accepted'),
        isOwn ? { data: null } : supabase.from('follows').select('status').eq('follower_id', session.user.id).eq('following_id', uid).maybeSingle(),
      ])
      setProfile(prof)
      setEntries(ents || [])
      setFollowerCount(frs || 0)
      setFollowingCount(fing || 0)
      setFollowing(!!myFollow?.status)
    } finally {
      setLoading(false)
    }
  }

  async function handleFollow() {
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', uid)
      setFollowing(false); setFollowerCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: uid, status: profile?.is_private ? 'pending' : 'accepted' })
      setFollowing(true); setFollowerCount(c => c + 1)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <div className={s.center}><Spinner /></div>
  if (!profile) return <div className={s.center}><p style={{color:'var(--text-2)'}}>User not found</p></div>

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        {!isOwn && <button className={s.back} onClick={() => nav(-1)}>←</button>}
        <span className={s.headerTitle}>{isOwn ? 'My Profile' : `@${profile.username}`}</span>
        {isOwn && <button className={s.settingsBtn} onClick={handleSignOut}>Sign out</button>}
      </div>

      {/* Profile hero */}
      <div className={s.hero}>
        <div className={s.avatarWrap}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className={s.avatar} />
            : <div className={s.avatarFallback}>{(profile.username||'?')[0].toUpperCase()}</div>
          }
          <div className={s.streakRing} style={{ '--streak-angle': `${Math.min((profile.streak||0)/30*360, 360)}deg` }} />
        </div>
        <h2 className={s.username}>@{profile.username}</h2>
        {profile.bio && <p className={s.bio}>{profile.bio}</p>}

        {/* Stats row */}
        <div className={s.statsRow}>
          <div className={s.stat}>
            <span className={s.statVal}>{profile.streak || 0}</span>
            <span className={s.statLabel}>🔥 Streak</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal}>{followerCount}</span>
            <span className={s.statLabel}>Followers</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal}>{followingCount}</span>
            <span className={s.statLabel}>Following</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal}>{entries.length}</span>
            <span className={s.statLabel}>Entries</span>
          </div>
        </div>

        {/* Follow / edit */}
        {!isOwn && (
          <button className={s.followBtn + (following ? ' ' + s.following : '')} onClick={handleFollow}>
            {following ? (profile.is_private ? 'Requested' : 'Following') : '+ Follow'}
          </button>
        )}
        {isOwn && (
          <button className={s.editBtn} onClick={() => nav('/log')}>✦ Log Today</button>
        )}
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button className={s.tabBtn + (tab === 'grid' ? ' ' + s.tabActive : '')} onClick={() => setTab('grid')}>Grid</button>
        <button className={s.tabBtn + (tab === 'list' ? ' ' + s.tabActive : '')} onClick={() => setTab('list')}>List</button>
      </div>

      {/* Entry grid */}
      {entries.length === 0 ? (
        <div className={s.empty}>
          <p>{isOwn ? 'Start logging to fill your profile.' : 'No public entries yet.'}</p>
        </div>
      ) : tab === 'grid' ? (
        <div className={s.grid}>
          {entries.map(e => {
            const img = e.media_urls?.[0]
            return (
              <div key={e.id} className={s.gridCell}>
                {img
                  ? <img src={img} alt="" className={s.gridImg} />
                  : <div className={s.gridText}><span className={s.gridMood}>{e.mood}</span><p className={s.gridSnippet}>{e.text?.slice(0,40)}</p></div>
                }
              </div>
            )
          })}
        </div>
      ) : (
        <div className={s.list}>
          {entries.map(e => (
            <div key={e.id} className={s.listItem}>
              <span className={s.listMood}>{e.mood}</span>
              <div className={s.listBody}>
                <p className={s.listDate}>{new Date(e.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
                <p className={s.listText}>{e.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
