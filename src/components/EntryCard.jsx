import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import s from './EntryCard.module.css'

const CATEGORIES = [
  { id:'work',     label:'Work',     icon:'💼', color:'#4cc9f0' },
  { id:'fitness',  label:'Fitness',  icon:'🏃', color:'#06d6a0' },
  { id:'personal', label:'Personal', icon:'🧡', color:'#ffd166' },
  { id:'social',   label:'Social',   icon:'👥', color:'#ff4d6d' },
  { id:'creative', label:'Creative', icon:'🎨', color:'#c77dff' },
  { id:'health',   label:'Health',   icon:'🍃', color:'#80ffdb' },
]

export function AvatarThumb({ url, username, small }) {
  const imgCls  = small ? s.commentAvatarImg   : s.avatarImg
  const fbCls   = small ? s.commentAvatarFb    : s.avatarFb
  const emojiCls = small ? s.commentAvatarEmoji : s.avatarEmoji
  if (!url) return <div className={fbCls}>{(username||'?')[0].toUpperCase()}</div>
  if (url.startsWith('emoji:')) return <div className={emojiCls}>{url.replace('emoji:','')}</div>
  return <img src={url} alt="" className={imgCls} />
}

export default function EntryCard({ entry, currentUserId, onLike, onFollow, delay = 0 }) {
  const nav = useNavigate()
  const [showComments, setShowComments]     = useState(false)
  const [comments, setComments]             = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [comment, setComment]               = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [localFollowing, setLocalFollowing] = useState(entry.following || false)
  const [localLikeCount, setLocalLikeCount] = useState(entry.like_count || 0)
  const [localCommentCount, setLocalCommentCount] = useState(entry.comment_count || 0)
  const channelRef = useRef(null)
  const bottomRef  = useRef(null)

  const isOwn   = entry.user_id === currentUserId
  const profile = entry.profiles || {}
  const cats    = (entry.cats || []).map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean)
  const mediaUrls = entry.media_urls || []
  const isVideo   = url => /\.(mp4|mov|webm)/i.test(url)
  const dateStr   = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })

  // ── Real-time subscription when comments are open ──
  useEffect(() => {
    if (!showComments) {
      // Unsubscribe when closed
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    // Subscribe to new comments on this entry
    const channel = supabase
      .channel(`comments:${entry.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `entry_id=eq.${entry.id}`,
      }, async (payload) => {
        // Fetch the full comment with profile
        const { data } = await supabase
          .from('comments')
          .select('*, profiles(username, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setComments(prev => {
            // Avoid duplicates (our own submission already added it)
            if (prev.find(c => c.id === data.id)) return prev
            return [...prev, data]
          })
          setLocalCommentCount(c => c + 1)
          // Scroll to bottom
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [showComments, entry.id])

  // ── Real-time like count ──
  useEffect(() => {
    const channel = supabase
      .channel(`likes:${entry.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'likes',
        filter: `entry_id=eq.${entry.id}`,
      }, () => {
        // Refetch like count
        supabase.from('entries').select('like_count').eq('id', entry.id).single()
          .then(({ data }) => { if (data) setLocalLikeCount(data.like_count) })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [entry.id])

  async function loadComments() {
    if (commentsLoaded) return
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('entry_id', entry.id)
      .order('created_at', { ascending: true })
      .limit(50)
    setComments(data || [])
    setCommentsLoaded(true)
  }

  function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded) loadComments()
  }

  async function submitComment() {
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    const text = comment.trim()
    setComment('')
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ entry_id: entry.id, user_id: currentUserId, text })
        .select('*, profiles(username, avatar_url)')
        .single()
      if (!error && data) {
        setComments(p => [...p, data])
        setLocalCommentCount(c => c + 1)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        if (entry.user_id !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id:  entry.user_id,
            actor_id: currentUserId,
            type:     'comment',
            entry_id: entry.id,
            meta:     { text: text.slice(0, 80) },
          })
        }
      }
    } finally { setSubmitting(false) }
  }

  async function handleFollowClick(e) {
    e.stopPropagation()
    const newVal = !localFollowing
    setLocalFollowing(newVal)
    await onFollow?.(entry.user_id, localFollowing)
    if (newVal) {
      await supabase.from('notifications').insert({
        user_id: entry.user_id, actor_id: currentUserId, type: 'follow',
      })
    }
  }

  function handleLikeClick() {
    onLike(entry.id, entry.liked)
    setLocalLikeCount(c => entry.liked ? c - 1 : c + 1)
  }

  return (
    <div className={s.card} style={{ animationDelay: `${Math.min(delay * 0.04, 0.3)}s` }}>

      {/* Author */}
      <div className={s.author} onClick={() => nav(`/profile/${entry.user_id}`)}>
        <div className={s.avatarWrap}>
          <AvatarThumb url={profile.avatar_url} username={profile.username} />
          {(profile.streak||0) >= 3 && <div className={s.streakDot}>🔥</div>}
        </div>
        <div className={s.authorInfo}>
          <span className={s.username}>@{profile.username || 'unknown'}</span>
          <div className={s.meta}>
            <span className={s.date}>{dateStr}</span>
            {(profile.streak||0) >= 7 && <span className={s.streakPill}>🔥 {profile.streak}d</span>}
          </div>
        </div>
        {!isOwn && (
          <button className={s.followBtn + (localFollowing ? ' ' + s.following : '')} onClick={handleFollowClick}>
            {localFollowing ? 'Following' : '+ Follow'}
          </button>
        )}
        {isOwn && <span className={s.ownBadge}>You</span>}
      </div>

      {/* Tags */}
      {(entry.mood || cats.length > 0) && (
        <div className={s.tags}>
          {entry.mood && <span className={s.mood}>{entry.mood}</span>}
          {cats.map(c => (
            <span key={c.id} className={s.cat} style={{'--cc': c.color}}>
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Text */}
      {entry.text && <p className={s.text}>{entry.text}</p>}

      {/* Media */}
      {mediaUrls.length > 0 && (
        <div className={s.media + (mediaUrls.length > 1 ? ' ' + s.mediaGrid : '')}>
          {mediaUrls.map((url, i) =>
            isVideo(url)
              ? <video key={i} src={url} className={s.mediaItem} controls playsInline muted loop />
              : <img   key={i} src={url} alt="" className={s.mediaItem} loading="lazy" />
          )}
        </div>
      )}

      {/* Actions */}
      <div className={s.actions}>
        <button className={s.actionBtn + (entry.liked ? ' ' + s.liked : '')} onClick={handleLikeClick}>
          <HeartIcon filled={entry.liked} />
          <span>{localLikeCount}</span>
        </button>
        <button className={s.actionBtn + (showComments ? ' ' + s.active : '')} onClick={toggleComments}>
          <CommentIcon />
          <span>{localCommentCount}</span>
          {showComments && <span className={s.liveDot} title="Live" />}
        </button>
        <button className={s.actionBtn} onClick={() => {
          if (navigator.share) navigator.share({
            title: `@${profile.username} on CalenStar`,
            text: entry.text,
            url: `${window.location.origin}/profile/${entry.user_id}`
          })
        }}>
          <ShareIcon />
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className={s.comments}>
          {comments.length === 0 && commentsLoaded && (
            <p className={s.noComments}>No comments yet — be the first!</p>
          )}
          {comments.length > 0 && (
            <div className={s.commentList}>
              {comments.map(c => (
                <div key={c.id} className={s.commentRow + ' fade-up'}>
                  <div className={s.commentAvatar}>
                    <AvatarThumb url={c.profiles?.avatar_url} username={c.profiles?.username} small />
                  </div>
                  <div className={s.commentBody}>
                    <span className={s.commentUser}>@{c.profiles?.username}</span>
                    <span className={s.commentText}> {c.text}</span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
          <div className={s.commentInput}>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
              placeholder="Add a comment…"
              className={s.commentBox}
            />
            <button className={s.commentSend} onClick={submitComment} disabled={!comment.trim() || submitting}>
              {submitting ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HeartIcon({ filled }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled?'var(--accent)':'none'} stroke={filled?'var(--accent)':'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
function CommentIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function ShareIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
}
