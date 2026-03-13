import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import EntryCard from '../components/EntryCard'
import Spinner from '../components/Spinner'
import s from './DiscoverPage.module.css'

const MOODS = ["🔥","✨","💪","🌙","🌱","😤","🎯","🧘","🏆","💡"]

export default function DiscoverPage() {
  const session = useAuth()
  const uid = session.user.id
  const inputRef = useRef()

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

      const entryIds  = rawEntries.map(e => e.id)
      const authorIds = [...new Set(rawEntries.map(e => e.user_id).filter(id => id !== uid))]

      const [{ data: myLikes }, { data: myFollows }] = await Promise.all([
        supabase.from('likes').select('entry_id').eq('user_id', uid).in('entry_id', entryIds),
        supabase.from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted').in('following_id', authorIds),
      ])

      const likedSet     = new Set((myLikes||[]).map(l => l.entry_id))
      const followingSet = new Set((myFollows||[]).map(f => f.following_id))

      setEntries(rawEntries.map(e => ({ ...e, liked: likedSet.has(e.id), following: followingSet.has(e.user_id) })))
    } finally { setLoading(false) }
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
      {/* Sticky header — fixed so keyboard doesn't push it away */}
      <div className={s.header}>
        <h1 className={s.title}>Discover</h1>
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>◎</span>
          <input
            ref={inputRef}
            className={s.searchInput}
            placeholder="Search entries & people…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            // Dismiss keyboard on Enter
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
          />
          {search && (
            <button className={s.clearBtn} onClick={() => { setSearch(''); inputRef.current?.focus() }}>✕</button>
          )}
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
      </div>

      {/* Scrollable content */}
      <div className={s.feed}>
        {loading ? (
          <div className={s.center}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyIcon}>{search ? '🔍' : '✨'}</p>
            <p className={s.emptyTitle}>{search ? `No results for "${search}"` : 'No public posts yet'}</p>
            <p className={s.emptySub}>{search ? 'Try a different search term' : 'Be the first to post something public!'}</p>
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
    </div>
  )
}
