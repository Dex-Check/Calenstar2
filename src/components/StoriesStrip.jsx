import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AvatarThumb } from './EntryCard'
import s from './StoriesStrip.module.css'

export default function StoriesStrip({ onAddStory }) {
  const session = useAuth()
  const uid = session.user.id
  const fileRef = useRef()

  const [stories, setStories]       = useState([]) // grouped by user
  const [viewing, setViewing]       = useState(null) // { userStories, index }
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0) // story auto-advance timer

  useEffect(() => { loadStories() }, [])

  async function loadStories() {
    // Get followed users + self
    const { data: follows } = await supabase
      .from('follows').select('following_id').eq('follower_id', uid).eq('status','accepted')
    const ids = [uid, ...(follows||[]).map(f => f.following_id)]

    const { data } = await supabase
      .from('stories')
      .select('*, profiles(id, username, avatar_url, streak)')
      .in('user_id', ids)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    // Group by user, own stories first
    const grouped = {}
    ;(data||[]).forEach(story => {
      const uid_ = story.user_id
      if (!grouped[uid_]) grouped[uid_] = { profile: story.profiles, stories: [] }
      grouped[uid_].stories.push(story)
    })
    // Own stories first
    const sorted = Object.values(grouped).sort((a,b) => a.profile.id === uid ? -1 : 1)
    setStories(sorted)
  }

  async function handleAddStory(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${uid}/story-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('entry-media').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('entry-media').getPublicUrl(path)
      const isVid = file.type.startsWith('video')
      await supabase.from('stories').insert({
        user_id:    uid,
        media_url:  publicUrl,
        media_type: isVid ? 'video' : 'image',
      })
      await loadStories()
    } finally { setUploading(false) }
  }

  function openStory(group) {
    setViewing({ group, storyIndex: 0 })
    recordView(group.stories[0].id)
  }

  async function recordView(storyId) {
    await supabase.from('story_views').upsert({ story_id: storyId, user_id: uid }, { onConflict: 'story_id,user_id' })
    await supabase.from('stories').update({ view_count: supabase.rpc('increment') }).eq('id', storyId)
  }

  function nextStory() {
    if (!viewing) return
    const { group, storyIndex } = viewing
    if (storyIndex < group.stories.length - 1) {
      const next = storyIndex + 1
      setViewing({ group, storyIndex: next })
      recordView(group.stories[next].id)
    } else {
      // Try next group
      const groupIdx = stories.findIndex(g => g.profile.id === group.profile.id)
      if (groupIdx < stories.length - 1) {
        const nextGroup = stories[groupIdx + 1]
        setViewing({ group: nextGroup, storyIndex: 0 })
        recordView(nextGroup.stories[0].id)
      } else {
        setViewing(null)
      }
    }
  }

  function prevStory() {
    if (!viewing) return
    const { group, storyIndex } = viewing
    if (storyIndex > 0) {
      setViewing({ group, storyIndex: storyIndex - 1 })
    }
  }

  const ownStories = stories.find(g => g.profile.id === uid)
  const hasOwnStory = ownStories?.stories?.length > 0

  return (
    <>
      {/* ── Story strip ── */}
      <div className={s.strip}>
        {/* Add story button */}
        <div className={s.addStory} onClick={() => fileRef.current.click()}>
          <div className={s.addAvatar}>
            {uploading
              ? <div className={s.uploadSpinner} />
              : hasOwnStory
                ? <div className={s.ownRing}><span className={s.addPlus}>+</span></div>
                : <span className={s.addPlus}>+</span>
            }
          </div>
          <p className={s.storyLabel}>Your story</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:'none'}} onChange={handleAddStory} />

        {/* Friend stories */}
        {stories.filter(g => g.profile.id !== uid).map(group => (
          <div key={group.profile.id} className={s.storyItem} onClick={() => openStory(group)}>
            <div className={s.storyRing}>
              <AvatarThumb url={group.profile.avatar_url} username={group.profile.username} />
            </div>
            <p className={s.storyLabel}>@{group.profile.username}</p>
          </div>
        ))}

        {/* Own story if exists */}
        {hasOwnStory && (
          <div className={s.storyItem} onClick={() => openStory(ownStories)}>
            <div className={s.storyRingViewed}>
              <AvatarThumb url={ownStories.profile.avatar_url} username={ownStories.profile.username} />
            </div>
            <p className={s.storyLabel}>Your story</p>
          </div>
        )}
      </div>

      {/* ── Full screen viewer ── */}
      {viewing && (
        <StoryViewer
          group={viewing.group}
          storyIndex={viewing.storyIndex}
          currentUserId={uid}
          onNext={nextStory}
          onPrev={prevStory}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}

function StoryViewer({ group, storyIndex, currentUserId, onNext, onPrev, onClose }) {
  const story   = group.stories[storyIndex]
  const profile = group.profile
  const total   = group.stories.length
  const timerRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const DURATION = story.media_type === 'video' ? 15000 : 5000

  useEffect(() => {
    setElapsed(0)
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const pct = Math.min((Date.now() - start) / DURATION * 100, 100)
      setElapsed(pct)
      if (pct >= 100) { clearInterval(timerRef.current); onNext() }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [story.id])

  const timeLeft = Math.ceil((DURATION - elapsed / 100 * DURATION) / 1000)
  const isOwn    = profile.id === currentUserId

  return (
    <div className={s.viewer} onClick={e => {
      const x = e.clientX / window.innerWidth
      x > 0.5 ? onNext() : onPrev()
    }}>
      {/* Progress bars */}
      <div className={s.progressBars}>
        {group.stories.map((_, i) => (
          <div key={i} className={s.progressBar}>
            <div className={s.progressFill} style={{
              width: i < storyIndex ? '100%' : i === storyIndex ? `${elapsed}%` : '0%'
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={s.viewerHeader} onClick={e => e.stopPropagation()}>
        <AvatarThumb url={profile.avatar_url} username={profile.username} />
        <div className={s.viewerInfo}>
          <p className={s.viewerUsername}>@{profile.username}</p>
          <p className={s.viewerTime}>{timeLeft}s · {new Date(story.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</p>
        </div>
        <button className={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Media */}
      {story.media_type === 'video'
        ? <video src={story.media_url} className={s.storyMedia} autoPlay playsInline muted loop />
        : <img   src={story.media_url} className={s.storyMedia} alt="" />
      }

      {/* Caption */}
      {story.caption && (
        <div className={s.caption}>{story.caption}</div>
      )}

      {/* View count for own stories */}
      {isOwn && (
        <div className={s.viewCount} onClick={e => e.stopPropagation()}>
          👁 {story.view_count || 0} views
        </div>
      )}
    </div>
  )
}
