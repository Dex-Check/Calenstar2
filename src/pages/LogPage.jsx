import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'
import s from './LogPage.module.css'

const MOODS = ["🔥","✨","💪","🌙","🌱","😤","🎯","🧘","🏆","💡"]
const CATEGORIES = [
  { id:'work',     label:'Work',     icon:'💼', color:'#4cc9f0' },
  { id:'fitness',  label:'Fitness',  icon:'🏃', color:'#06d6a0' },
  { id:'personal', label:'Personal', icon:'🧡', color:'#ffd166' },
  { id:'social',   label:'Social',   icon:'👥', color:'#ff4d6d' },
  { id:'creative', label:'Creative', icon:'🎨', color:'#c77dff' },
  { id:'health',   label:'Health',   icon:'🍃', color:'#80ffdb' },
]

export default function LogPage() {
  const session = useAuth()
  const nav     = useNavigate()

  const [text, setText]     = useState('')
  const [mood, setMood]     = useState('🔥')
  const [cats, setCats]     = useState([])
  const [isPublic, setIsPublic] = useState(true)
  const [media, setMedia]   = useState([]) // { file, preview, type }
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const fileRef = useRef()

  const today = new Date().toISOString().slice(0,10)

  function toggleCat(id) {
    setCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    const newMedia = files.slice(0, 4 - media.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : 'image',
    }))
    setMedia(p => [...p, ...newMedia])
  }

  function removeMedia(i) {
    setMedia(p => p.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!text.trim() || saving) return
    setSaving(true); setError(null)
    try {
      const uid = session.user.id

      // Upload media files to Supabase Storage
      const mediaUrls = []
      for (const m of media) {
        const ext  = m.file.name.split('.').pop()
        const path = `${uid}/${today}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('entry-media').upload(path, m.file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('entry-media').getPublicUrl(path)
        mediaUrls.push(publicUrl)
      }

      // Upsert entry
      const { error: dbErr } = await supabase.from('entries').upsert({
        user_id:    uid,
        date:       today,
        text:       text.trim(),
        mood,
        cats,
        is_public:  isPublic,
        media_urls: mediaUrls,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      if (dbErr) throw dbErr

      // Update streak
      await supabase.rpc('update_streak', { p_user_id: uid })

      nav('/')
    } catch(e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ready = text.trim().length > 0 && !saving

  return (
    <div className={s.page}>
      <div className={s.header}>
        <button className={s.back} onClick={() => nav('/')}>← Back</button>
        <div className={s.headerCenter}>
          <p className={s.dateLabel}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
        </div>
        <button className={s.saveBtn} onClick={handleSave} disabled={!ready}>
          {saving ? <Spinner size={16} color="#fff" /> : 'Post'}
        </button>
      </div>

      <div className={s.body}>
        {/* Mood */}
        <section className={s.section + ' fade-up'}>
          <p className={s.sectionLabel}>Mood</p>
          <div className={s.moods}>
            {MOODS.map(m => (
              <button key={m} className={s.moodBtn + (mood === m ? ' ' + s.moodActive : '')} onClick={() => setMood(m)}>
                {m}
              </button>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className={s.section + ' fade-up d1'}>
          <p className={s.sectionLabel}>Categories</p>
          <div className={s.cats}>
            {CATEGORIES.map(cat => {
              const active = cats.includes(cat.id)
              return (
                <button key={cat.id} className={s.catBtn + (active ? ' ' + s.catActive : '')}
                  style={{ '--cat': cat.color }} onClick={() => toggleCat(cat.id)}>
                  <span>{cat.icon}</span><span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Text */}
        <section className={s.section + ' fade-up d2'}>
          <p className={s.sectionLabel}>What happened today?</p>
          <textarea
            className={s.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write anything — big wins, small moments, what you felt, what you learned…"
            rows={5}
          />
          <p className={s.charCount}>{text.length} characters</p>
        </section>

        {/* Media */}
        <section className={s.section + ' fade-up d3'}>
          <p className={s.sectionLabel}>Add photos or videos</p>
          <div className={s.mediaGrid}>
            {media.map((m, i) => (
              <div key={i} className={s.mediaThumb}>
                {m.type === 'video'
                  ? <video src={m.preview} className={s.mediaImg} muted playsInline />
                  : <img   src={m.preview} className={s.mediaImg} alt="" />
                }
                <button className={s.removeMedia} onClick={() => removeMedia(i)}>×</button>
              </div>
            ))}
            {media.length < 4 && (
              <button className={s.addMedia} onClick={() => fileRef.current.click()}>
                <span className={s.addIcon}>+</span>
                <span className={s.addLabel}>Photo / Video</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:'none' }} onChange={handleFiles} />
        </section>

        {/* Visibility */}
        <section className={s.section + ' fade-up d4'}>
          <div className={s.visRow}>
            <div>
              <p className={s.visTitle}>{isPublic ? '🌍 Public' : '🔒 Private'}</p>
              <p className={s.visSub}>{isPublic ? 'Anyone can see this on your profile & the feed' : 'Only you can see this entry'}</p>
            </div>
            <button className={s.toggle + (isPublic ? ' ' + s.toggleOn : '')} onClick={() => setIsPublic(v => !v)}>
              <div className={s.toggleThumb} />
            </button>
          </div>
        </section>

        {error && <p className={s.error}>{error}</p>}

        <button className={s.bigSave} onClick={handleSave} disabled={!ready}>
          {saving ? <Spinner size={20} color="#fff" /> : '✦ Post Today\'s Entry'}
        </button>
      </div>
    </div>
  )
}
