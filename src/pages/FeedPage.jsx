import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import EntryCard from '../components/EntryCard'
import AdCard from '../components/AdCard'
import Spinner from '../components/Spinner'
import s from './FeedPage.module.css'

const PAGE_SIZE = 15

export default function FeedPage() {
  const session = useAuth()
  const nav = useNavigate()
  const uid = session.user.id
  const today = new Date().toISOString().slice(0,10)

  const [profile, setProfile]       = useState(null)
  const [todayDone, setTodayDone]   = useState(false)
  const [todayEntry, setTodayEntry] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [feed, setFeed]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [countdown, setCountdown]   = useState('--:--:--')

  // Midnight countdown
  useEffect(() => {
    function tick() {
      const now = new Date()
      const midnight = new Date(now); midnight.setHours(24,0,0,0)
      const diff = midnight - now
      const h = Math.floor(diff/3600000)
      const m = Math.floor((diff%3600000)/60000)
      const sec = Math.floor((diff%60000)/1000)
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => { loadProfile(); loadFeed() }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
      setProfile(prof)

      const { data: te } = await supabase.from('entries').select('*').eq('user_id', uid).eq('date', today).maybeSingle()
      setTodayDone(!!te); setTodayEntry(te)

      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted')
      const friendIds = (follows||[]).map(f => f.following_id)
      const leaderIds = [uid, ...friendIds]

      const { data: leaders } = await supabase
        .from('profiles').select('id, username, avatar_url, streak')
        .in('id', leaderIds).order('streak', { ascending: false }).limit(8)
      setLeaderboard(leaders || [])
    } finally { setLoading(false) }
  }

  async function loadFeed() {
    setFeedLoading(true)
    try {
      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted')
      const friendIds = (follows||[]).map(f => f.following_id)
      const feedIds = [uid, ...friendIds]

      const { data: entries } = await supabase
        .from('entries')
        .select('*, profiles(id, username, avatar_url, streak)')
        .in('user_id', feedIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (!entries?.length) { setFeed([]); return }

      const entryIds = entries.map(e => e.id)
      const { data: myLikes } = await supabase.from('likes').select('entry_id').eq('user_id', uid).in('entry_id', entryIds)
      const likedSet = new Set((myLikes||[]).map(l => l.entry_id))

      // Check which authors current user follows
      const authorIds = [...new Set(entries.map(e => e.user_id).filter(id => id !== uid))]
      const { data: myFollows } = await supabase.from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted').in('following_id', authorIds)
      const followingSet = new Set((myFollows||[]).map(f => f.following_id))

      const withAds = []
      entries.forEach((item, i) => {
        withAds.push({ type:'entry', data: { ...item, liked: likedSet.has(item.id), following: followingSet.has(item.user_id) } })
        if ((i+1) % 5 === 0) withAds.push({ type:'ad', id:`ad-${i}` })
      })
      setFeed(withAds)
    } finally { setFeedLoading(false) }
  }

  async function handleLike(entryId, liked) {
    if (liked) {
      await supabase.from('likes').delete().eq('entry_id', entryId).eq('user_id', uid)
    } else {
      await supabase.from('likes').insert({ entry_id: entryId, user_id: uid })
    }
    setFeed(prev => prev.map(item =>
      item.type === 'entry' && item.data.id === entryId
        ? { ...item, data: { ...item.data, liked: !liked, like_count: (item.data.like_count||0) + (liked?-1:1) } }
        : item
    ))
  }

  async function handleFollow(followingId, isFollowing) {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', followingId)
    } else {
      await supabase.from('follows').insert({ follower_id: uid, following_id: followingId, status: 'accepted' })
    }
    setFeed(prev => prev.map(item =>
      item.type === 'entry' && item.data.user_id === followingId
        ? { ...item, data: { ...item.data, following: !isFollowing } }
        : item
    ))
    // Reload feed so new friend's posts appear
    if (!isFollowing) loadFeed()
  }

  const streak = profile?.streak || 0
  const hoursLeft = parseInt(countdown.split(':')[0])
  const urgent = !todayDone && hoursLeft < 3

  return (
    <div className={s.page}>

      {/* ── Streak Hero ── */}
      {loading ? (
        <div className={s.heroSkeleton}><Spinner /></div>
      ) : (
        <div className={s.hero}>
          <div className={s.heroRings}>
            {[130,185,240].map((sz,i) => <div key={i} className={s.ring} style={{width:sz,height:sz}} />)}
          </div>
          <p className={s.heroLabel}>Current Streak</p>
          <div className={s.heroNum}>{streak}</div>
          <p className={s.heroSub}>days in a row</p>
          <div className={s.weekRow}>
            {Array.from({length:7}).map((_,i) => {
              const daysAgo = 6 - i
              const filled = daysAgo < streak || (daysAgo === 0 && todayDone)
              const isToday = daysAgo === 0
              return (
                <div key={i} className={[s.weekDot, filled&&s.dotFilled, isToday&&s.dotToday].filter(Boolean).join(' ')}>
                  {filled ? '★' : ''}
                </div>
              )
            })}
          </div>
          {profile?.best_streak > 0 && (
            <p className={s.bestStreak}>Best: {profile.best_streak} days</p>
          )}
        </div>
      )}

      {/* ── Log CTA ── */}
      {!loading && (
        !todayDone ? (
          <button className={[s.logCta, urgent&&s.logCtaUrgent].filter(Boolean).join(' ')} onClick={() => nav('/log')}>
            <div className={s.logCtaLeft}>
              <span className={s.logCtaIcon}>✦</span>
              <div>
                <p className={s.logCtaTitle}>{urgent ? '⚠ Streak at risk!' : "Log today's entry"}</p>
                <p className={s.logCtaSub}>{urgent ? `Only ${countdown} left — log now!` : `${countdown} until midnight`}</p>
              </div>
            </div>
            <span className={s.arrow}>→</span>
          </button>
        ) : (
          <div className={s.loggedBanner} onClick={() => nav('/log')}>
            <span className={s.loggedCheck}>✓</span>
            <div>
              <p className={s.loggedTitle}>Logged! {todayEntry?.mood}</p>
              <p className={s.loggedSub}>Tap to edit today's entry</p>
            </div>
            <span className={s.loggedStreakBadge}>🔥 {streak}</span>
          </div>
        )
      )}

      {/* ── Streak Leaderboard ── */}
      {!loading && leaderboard.length > 0 && (
        <div className={s.section}>
          <p className={s.sectionTitle}>🏆 Friend Streaks</p>
          <div className={s.leaderScroll}>
            {leaderboard.map((p, i) => (
              <div key={p.id} className={s.leaderCard} onClick={() => nav(`/profile/${p.id}`)}>
                <span className={s.leaderRank} style={{color: i===0?'var(--gold)':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--text-3)'}}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                </span>
                <div className={s.leaderAvatar}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className={s.leaderAvatarImg} />
                    : <div className={s.leaderAvatarFb}>{(p.username||'?')[0].toUpperCase()}</div>
                  }
                </div>
                <p className={s.leaderName}>{p.id===uid?'You':`@${p.username}`}</p>
                <p className={s.leaderStreak}>🔥 {p.streak}d</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Friends Feed ── */}
      <div className={s.section}>
        <p className={s.sectionTitle}>Friends' Days</p>
        {feedLoading ? (
          <div className={s.center}><Spinner /></div>
        ) : feed.length === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyIcon}>👥</p>
            <p className={s.emptyTitle}>No posts from friends yet</p>
            <p className={s.emptySub}>Follow people on Discover to see their daily entries here.</p>
            <button className={s.discoverBtn} onClick={() => nav('/discover')}>Go to Discover →</button>
          </div>
        ) : (
          <div className={s.feed}>
            {feed.map((item, i) =>
              item.type === 'ad'
                ? <AdCard key={item.id} />
                : <EntryCard
                    key={item.data.id}
                    entry={item.data}
                    currentUserId={uid}
                    onLike={handleLike}
                    onFollow={handleFollow}
                    delay={i}
                  />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
