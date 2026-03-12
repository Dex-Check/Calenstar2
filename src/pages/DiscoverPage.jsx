import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import EntryCard from '../components/EntryCard'
import Spinner from '../components/Spinner'
import s from './DiscoverPage.module.css'

const MOODS = ["🔥","✨","💪","🌙","🌱","😤","🎯","🧘","🏆","💡"]

export default function DiscoverPage() {
  const session = useAuth()
  const uid = session.user.id

  const [entries, setEntries]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterMood, setFilterMood] = useState(null)

  useEffect(() => { load() }, [filterMood])

  async function load() {
    setLoading(true)
    try {
      let q = supabase
        .from('entries')
        .select('*, profiles(id, username, avatar_url, streak)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(40)

      if (filterMood) q = q.eq('mood', filterMood)
      const { data: rawEntries } = await q

      if (!rawEntries?.length) { setEntries([]); return }

      // Check which ones current user liked
      const entryIds = rawEntries.map(e => e.id)
      const { data: myLikes } = await supabase
        .from('likes').select('entry_id').eq('user_id', uid).in('entry_id', entryIds)
      const likedSet = new Set((myLikes||[]).map(l => l.entry_id))

      // Check which authors current user follows
      const authorIds = [...new Set(rawEntries.map(e => e.user_id).filter(id => id !== uid))]
      const { data: myFollows } = await supabase
        .from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted')
        .in('following_id', authorIds)
      const followingSet = new Set((myFollows||[]).map(f => f.following_id))

      setEntries(rawEntries.map(e => ({ ...e, liked: likedSet.has(e.id), following: followingSet.has(e.user_id) })))
    } finally {
      setLoading(false)
    }
  }

  async function handleLike(entryId, liked) {
    if (liked) {
      await supabase.from('likes').delete().eq('entry_id', entryId).eq('user_id', uid)
    } else {
      await supabase.from('likes').insert({ entry_id: entryId, user_id: uid })
    }
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, liked: !liked, like_count: (e.like_count||0) + (liked?-1:1) } : e
    ))
  }

  async function handleFollow(followingId, isFollowing) {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', followingId)
    } else {
      await supabase.from('follows').insert({ follower_id: uid, following_id: followingId, status: 'accepted' })
    }
    setEntries(prev => prev.map(e =>
      e.user_id === followingId ? { ...e, following: !isFollowing } : e
    ))
  }

  const filtered = search.trim()
    ? entries.filter(e =>
        e.text?.toLowerCase().includes(search.toLowerCase()) ||
        e.profiles?.username?.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Discover</h1>
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>◎</span>
          <input
            className={s.searchInput}
            placeholder="Search entries & people…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className={s.clearSearch} onClick={() => setSearch('')}>×</button>}
        </div>
        <div className={s.moodRow}>
          {MOODS.map(m => (
            <button
              key={m}
              className={s.moodPill + (filterMood === m ? ' ' + s.moodActive : '')}
              onClick={() => setFilterMood(filterMood === m ? null : m)}
            >{m}</button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className={s.center}><Spinner /></div>
      ) : (
        <div className={s.feed}>
          {filtered.length === 0 ? (
            <div className={s.empty}>
              <p>No public posts found.</p>
            </div>
          ) : (
            filtered.map((e, i) => (
              <EntryCard
                key={e.id}
                entry={e}
                currentUserId={uid}
                onLike={handleLike}
                onFollow={handleFollow}
                delay={i}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
