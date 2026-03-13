import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'
import s from './ProfilePage.module.css'

const EMOJI_AVATARS = ['🦁','🐺','🦊','🐻','🐼','🦋','🌙','⚡','🔥','🌊','🌿','💎','🎯','🚀','🎸','🌸']

function AvatarDisplay({ url, username, size = 88 }) {
  if (!url) return (
    <div className={s.avatarFb} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(username||'?')[0].toUpperCase()}
    </div>
  )
  if (url.startsWith('emoji:')) return (
    <div className={s.avatarEmoji} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {url.replace('emoji:', '')}
    </div>
  )
  return <img src={url} alt="" className={s.avatarImg} style={{ width: size, height: size }} />
}

export default function ProfilePage() {
  const { id } = useParams()
  const session = useAuth()
  const nav = useNavigate()
  const uid = id || session?.user.id
  const isOwn = uid === session?.user.id
  const fileRef = useRef()

  const [profile, setProfile]         = useState(null)
  const [entries, setEntries]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [following, setFollowing]     = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [tab, setTab]                 = useState('grid')
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)

  // Edit fields
  const [editUsername, setEditUsername]   = useState('')
  const [editBio, setEditBio]             = useState('')
  const [editPrivate, setEditPrivate]     = useState(false)
  const [editAvatar, setEditAvatar]       = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState(null)
  const [editAvatarMode, setEditAvatarMode] = useState('current') // current | emoji | photo
  const [usernameOk, setUsernameOk]       = useState(true)
  const [saveMsg, setSaveMsg]             = useState('')

  useEffect(() => { if (uid) load() }, [uid])

  async function load() {
    setLoading(true)
    try {
      // Build entries query — own profile sees all, others only see public
      let entriesQ = supabase.from('entries').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(60)
      if (!isOwn) entriesQ = entriesQ.eq('is_public', true)

      const [{ data: prof }, { data: ents }, { count: frs }, { count: fing }, { data: myFollow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        entriesQ,
        supabase.from('follows').select('*', { count:'exact', head:true }).eq('following_id', uid).eq('status','accepted'),
        supabase.from('follows').select('*', { count:'exact', head:true }).eq('follower_id', uid).eq('status','accepted'),
        isOwn ? Promise.resolve({ data: null }) : supabase.from('follows').select('status').eq('follower_id', session.user.id).eq('following_id', uid).maybeSingle(),
      ])
      setProfile(prof)
      setEntries((ents||[]).filter(e => isOwn || e.is_public))
      setFollowerCount(frs || 0)
      setFollowingCount(fing || 0)
      setFollowing(!!myFollow?.status)

      if (prof) {
        setEditUsername(prof.username || '')
        setEditBio(prof.bio || '')
        setEditPrivate(prof.is_private || false)
        setEditAvatar(prof.avatar_url || '')
      }
    } finally { setLoading(false) }
  }

  async function checkUsername(val) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g,'')
    setEditUsername(clean)
    if (clean.length < 3) return
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).neq('id', uid).maybeSingle()
    setUsernameOk(!data)
  }

  function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditAvatarFile(file)
    setEditAvatarPreview(URL.createObjectURL(file))
    setEditAvatarMode('photo')
  }

  async function saveProfile() {
    if (saving || !usernameOk) return
    setSaving(true)
    try {
      let avatar_url = editAvatar

      if (editAvatarMode === 'photo' && editAvatarFile) {
        const ext  = editAvatarFile.name.split('.').pop()
        const path = `${uid}/avatar.${ext}`
        await supabase.storage.from('entry-media').upload(path, editAvatarFile, { upsert: true })
        const { data: { publicUrl } } = supabase.storage.from('entry-media').getPublicUrl(path)
        avatar_url = publicUrl
      } else if (editAvatarMode === 'emoji') {
        avatar_url = `emoji:${editAvatar.replace('emoji:','')}`
      }

      const { data, error } = await supabase.from('profiles').update({
        username:   editUsername,
        bio:        editBio,
        is_private: editPrivate,
        avatar_url,
      }).eq('id', uid).select().single()

      if (error) throw error
      setProfile(data)
      setEditing(false)
      setSaveMsg('Profile saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch(e) {
      setSaveMsg('Error: ' + e.message)
    } finally { setSaving(false) }
  }

  async function handleFollow() {
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', uid)
      setFollowing(false); setFollowerCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: uid, status: profile?.is_private ? 'pending' : 'accepted' })
      setFollowing(true); setFollowerCount(c => c + 1)
      await supabase.from('notifications').insert({ user_id: uid, actor_id: session.user.id, type: 'follow' })
    }
  }

  if (loading) return <div className={s.center}><Spinner /></div>
  if (!profile) return <div className={s.center}><p style={{color:'var(--text-2)'}}>User not found</p></div>

  const avatarUrl = editAvatarPreview || (editAvatarMode === 'emoji' ? `emoji:${editAvatar.replace('emoji:','')}` : editAvatar) || profile.avatar_url

  return (
    <div className={s.page}>

      {/* Header */}
      <div className={s.header}>
        {!isOwn
          ? <button className={s.headerBack} onClick={() => nav(-1)}>←</button>
          : <div />
        }
        <span className={s.headerTitle}>{isOwn ? 'My Profile' : `@${profile.username}`}</span>
        {isOwn
          ? <button className={s.headerBtn} onClick={() => setEditing(v => !v)}>{editing ? 'Cancel' : 'Edit'}</button>
          : <div />
        }
      </div>

      {/* Save toast */}
      {saveMsg && <div className={s.toast}>{saveMsg}</div>}

      {/* Profile hero */}
      <div className={s.hero}>
        {/* Avatar */}
        <div className={s.avatarWrap}>
          <AvatarDisplay url={profile.avatar_url} username={profile.username} size={88} />
          <div className={s.streakRing} style={{ '--angle': `${Math.min((profile.streak||0)/30*360,360)}deg` }} />
        </div>

        {!editing ? (
          <>
            <h2 className={s.username}>@{profile.username}</h2>
            {profile.display_name && profile.display_name !== profile.username && (
              <p className={s.displayName}>{profile.display_name}</p>
            )}
            {profile.bio && <p className={s.bio}>{profile.bio}</p>}
            {profile.is_private && <span className={s.privateBadge}>🔒 Private</span>}
          </>
        ) : (
          <div className={s.editForm}>
            {/* Avatar edit */}
            <div className={s.editAvatarSection}>
              <div className={s.editAvatarPreview}>
                <AvatarDisplay
                  url={editAvatarPreview || (editAvatarMode==='emoji'?`emoji:${editAvatar.replace('emoji:','')}`:'') || profile.avatar_url}
                  username={editUsername}
                  size={64}
                />
              </div>
              <div className={s.editAvatarBtns}>
                <button className={s.smallBtn} onClick={() => setEditAvatarMode('emoji')}>Pick emoji</button>
                <button className={s.smallBtn} onClick={() => fileRef.current.click()}>Upload photo</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarFile} />
            </div>

            {/* Emoji picker (only when in emoji mode) */}
            {editAvatarMode === 'emoji' && (
              <div className={s.emojiGrid}>
                {EMOJI_AVATARS.map(e => {
                  const isActive = editAvatar === `emoji:${e}` || editAvatar === e
                  return (
                    <button key={e} className={s.emojiBtn + (isActive?' '+s.emojiActive:'')}
                      onClick={() => { setEditAvatar(`emoji:${e}`); setEditAvatarPreview(null) }}>
                      {e}
                    </button>
                  )
                })}
              </div>
            )}

            <div className={s.editField}>
              <label className={s.editLabel}>Username</label>
              <div className={s.editInputWrap}>
                <span className={s.editPrefix}>@</span>
                <input className={s.editInput + (!usernameOk&&editUsername.length>=3?' '+s.inputErr:'')}
                  value={editUsername} onChange={e => checkUsername(e.target.value)}
                  autoCapitalize="none" maxLength={20} />
                {editUsername.length>=3 && <span className={s.check}>{usernameOk?'✓':'✗'}</span>}
              </div>
            </div>

            <div className={s.editField}>
              <label className={s.editLabel}>Bio</label>
              <textarea className={s.editTextarea} value={editBio} onChange={e=>setEditBio(e.target.value)}
                rows={3} maxLength={150} placeholder="Tell people about yourself…" />
              <p className={s.charCount}>{editBio.length}/150</p>
            </div>

            <div className={s.editPrivacyRow}>
              <div>
                <p className={s.editPrivacyTitle}>{editPrivate?'🔒 Private':'🌍 Public'}</p>
                <p className={s.editPrivacySub}>{editPrivate?'Only approved followers':'Anyone can follow you'}</p>
              </div>
              <button className={s.toggle+(editPrivate?' '+s.toggleOn:'')} onClick={()=>setEditPrivate(v=>!v)}>
                <div className={s.toggleThumb} />
              </button>
            </div>

            <button className={s.saveBtn} onClick={saveProfile} disabled={saving||!usernameOk||editUsername.length<3}>
              {saving ? <Spinner size={16} color="#fff" /> : 'Save profile'}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className={s.stats}>
          <div className={s.stat}><span className={s.statVal}>{profile.streak||0}</span><span className={s.statLabel}>🔥 Streak</span></div>
          <div className={s.statDiv} />
          <div className={s.stat}><span className={s.statVal}>{followerCount}</span><span className={s.statLabel}>Followers</span></div>
          <div className={s.statDiv} />
          <div className={s.stat}><span className={s.statVal}>{followingCount}</span><span className={s.statLabel}>Following</span></div>
          <div className={s.statDiv} />
          <div className={s.stat}><span className={s.statVal}>{entries.length}</span><span className={s.statLabel}>Entries</span></div>
        </div>

        {/* Action buttons */}
        {isOwn ? (
          <button className={s.logBtn} onClick={() => nav('/log')}>✦ Log Today</button>
        ) : (
          <div className={s.actionRow}>
            <button className={s.followBtn+(following?' '+s.following:'')} onClick={handleFollow}>
              {following ? (profile.is_private?'Requested':'Following ✓') : '+ Follow'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button className={s.tabBtn+(tab==='grid'?' '+s.tabActive:'')} onClick={()=>setTab('grid')}>Grid</button>
        <button className={s.tabBtn+(tab==='list'?' '+s.tabActive:'')} onClick={()=>setTab('list')}>List</button>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className={s.empty}>
          <p>{isOwn ? 'Start logging to fill your profile.' : 'No public entries yet.'}</p>
        </div>
      ) : tab === 'grid' ? (
        <div className={s.grid}>
          {entries.map(e => {
            const img = e.media_urls?.[0]
            return (
              <div key={e.id} className={s.gridCell + (!e.is_public?' '+s.gridPrivate:'')}>
                {img
                  ? <img src={img} alt="" className={s.gridImg} />
                  : <div className={s.gridNoMedia}><span className={s.gridMood}>{e.mood||'✦'}</span><p className={s.gridSnippet}>{e.text?.slice(0,50)}</p></div>
                }
                {!e.is_public && <span className={s.privateDot}>🔒</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className={s.list}>
          {entries.map(e => (
            <div key={e.id} className={s.listItem}>
              <span className={s.listMood}>{e.mood||'✦'}</span>
              <div className={s.listBody}>
                <div className={s.listMeta}>
                  <p className={s.listDate}>{new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
                  {!e.is_public && <span className={s.privateLabel}>🔒 Private</span>}
                </div>
                <p className={s.listText}>{e.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sign out at bottom of own profile */}
      {isOwn && (
        <div className={s.profileActions}>
          <button className={s.profileActionBtn} onClick={() => nav('/stats')}>📊 My Stats</button>
          <button className={s.profileActionBtn} onClick={() => nav('/notifications')}>🔔 Activity</button>
          <button className={s.signOutBtn} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      )}
    </div>
  )
}
