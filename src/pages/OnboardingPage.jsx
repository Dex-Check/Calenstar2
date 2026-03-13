import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'
import s from './OnboardingPage.module.css'

const EMOJI_AVATARS = ['🦁','🐺','🦊','🐻','🐼','🦋','🌙','⚡','🔥','🌊','🌿','💎','🎯','🚀','🎸','🌸']

export default function OnboardingPage({ onComplete }) {
  const session = useAuth()
  const uid = session.user.id

  const [step, setStep]           = useState(0) // 0=avatar, 1=username, 2=bio
  const [avatarMode, setAvatarMode] = useState('emoji') // emoji | photo
  const [selectedEmoji, setSelectedEmoji] = useState('🦁')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [username, setUsername]   = useState(session.user.email?.split('@')[0]?.replace(/[^a-z0-9_]/gi,'').toLowerCase() || '')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio]             = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [usernameOk, setUsernameOk] = useState(true)
  const fileRef = useRef()

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAvatarMode('photo')
  }

  async function checkUsername(val) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g,'')
    setUsername(clean)
    if (clean.length < 3) return
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).neq('id', uid).maybeSingle()
    setUsernameOk(!data)
  }

  async function finish() {
    if (saving) return
    setSaving(true); setError(null)
    try {
      let avatar_url = null

      if (avatarMode === 'photo' && photoFile) {
        const ext  = photoFile.name.split('.').pop()
        const path = `${uid}/avatar.${ext}`
        const { error: upErr } = await supabase.storage.from('entry-media').upload(path, photoFile, { upsert: true })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('entry-media').getPublicUrl(path)
        avatar_url = publicUrl
      } else {
        // Store emoji as a special URL we'll render as text
        avatar_url = `emoji:${selectedEmoji}`
      }

      const { error: dbErr } = await supabase.from('profiles').update({
        username:     username.trim(),
        display_name: displayName.trim() || username.trim(),
        bio:          bio.trim(),
        avatar_url,
        is_private:   isPrivate,
        onboarded:    true,
      }).eq('id', uid)
      if (dbErr) throw dbErr

      onComplete()
    } catch(e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canNext0 = true
  const canNext1 = username.length >= 3 && usernameOk
  const canFinish = canNext1

  return (
    <div className={s.wrap}>
      <div className={s.bg} />

      {/* Progress */}
      <div className={s.progress}>
        {[0,1,2].map(i => (
          <div key={i} className={s.dot + (i <= step ? ' ' + s.dotActive : '')} />
        ))}
      </div>

      {/* ── Step 0: Avatar ── */}
      {step === 0 && (
        <div className={s.card + ' scale-in'}>
          <div className={s.logo}>★</div>
          <h2 className={s.title}>Pick your look</h2>
          <p className={s.sub}>This is how you'll appear to others</p>

          {/* Avatar preview */}
          <div className={s.avatarPreview}>
            {avatarMode === 'photo' && photoPreview
              ? <img src={photoPreview} alt="" className={s.avatarPreviewImg} />
              : <div className={s.avatarPreviewEmoji}>{selectedEmoji}</div>
            }
          </div>

          {/* Mode tabs */}
          <div className={s.modeTabs}>
            <button className={s.modeTab + (avatarMode==='emoji'?' '+s.modeTabActive:'')} onClick={() => setAvatarMode('emoji')}>Emoji</button>
            <button className={s.modeTab + (avatarMode==='photo'?' '+s.modeTabActive:'')} onClick={() => { setAvatarMode('photo'); if(!photoPreview) fileRef.current.click() }}>Photo</button>
          </div>

          {avatarMode === 'emoji' && (
            <div className={s.emojiGrid}>
              {EMOJI_AVATARS.map(e => (
                <button key={e} className={s.emojiBtn + (selectedEmoji===e?' '+s.emojiActive:'')} onClick={() => setSelectedEmoji(e)}>{e}</button>
              ))}
            </div>
          )}

          {avatarMode === 'photo' && (
            <button className={s.photoBtn} onClick={() => fileRef.current.click()}>
              {photoPreview ? '↺ Change photo' : '+ Upload photo'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto} />

          <button className={s.next} onClick={() => setStep(1)}>Continue →</button>
        </div>
      )}

      {/* ── Step 1: Username ── */}
      {step === 1 && (
        <div className={s.card + ' scale-in'}>
          <div className={s.logo}>★</div>
          <h2 className={s.title}>Your identity</h2>
          <p className={s.sub}>Choose a username and display name</p>

          <div className={s.field}>
            <label className={s.label}>Username</label>
            <div className={s.inputWrap}>
              <span className={s.inputPrefix}>@</span>
              <input
                className={s.input + ' ' + s.inputPrefixed + (!usernameOk && username.length >= 3 ? ' ' + s.inputError : '')}
                value={username}
                onChange={e => checkUsername(e.target.value)}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={20}
              />
              {username.length >= 3 && (
                <span className={s.inputCheck}>{usernameOk ? '✓' : '✗'}</span>
              )}
            </div>
            {!usernameOk && username.length >= 3 && <p className={s.fieldError}>That username is taken</p>}
            <p className={s.fieldHint}>Letters, numbers, underscores only. Min 3 chars.</p>
          </div>

          <div className={s.field}>
            <label className={s.label}>Display name <span className={s.optional}>(optional)</span></label>
            <input
              className={s.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your Name"
              maxLength={40}
            />
          </div>

          <div className={s.btnRow}>
            <button className={s.back} onClick={() => setStep(0)}>← Back</button>
            <button className={s.next} onClick={() => setStep(2)} disabled={!canNext1}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Bio + Privacy ── */}
      {step === 2 && (
        <div className={s.card + ' scale-in'}>
          <div className={s.logo}>★</div>
          <h2 className={s.title}>About you</h2>
          <p className={s.sub}>A short bio and your privacy preference</p>

          <div className={s.field}>
            <label className={s.label}>Bio <span className={s.optional}>(optional)</span></label>
            <textarea
              className={s.textarea}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="What are you working on? What's your goal?"
              rows={3}
              maxLength={150}
            />
            <p className={s.charCount}>{bio.length}/150</p>
          </div>

          <div className={s.privacyRow}>
            <div className={s.privacyInfo}>
              <p className={s.privacyTitle}>{isPrivate ? '🔒 Private account' : '🌍 Public account'}</p>
              <p className={s.privacySub}>{isPrivate ? 'Only approved followers see your posts' : 'Anyone can see your posts and follow you'}</p>
            </div>
            <button className={s.toggle + (isPrivate ? '' : ' ' + s.toggleOn)} onClick={() => setIsPrivate(v => !v)}>
              <div className={s.toggleThumb} />
            </button>
          </div>

          {error && <p className={s.error}>{error}</p>}

          <div className={s.btnRow}>
            <button className={s.back} onClick={() => setStep(1)}>← Back</button>
            <button className={s.finish} onClick={finish} disabled={saving || !canFinish}>
              {saving ? <Spinner size={18} color="#fff" /> : "Let's go! →"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
