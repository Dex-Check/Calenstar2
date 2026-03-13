import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AvatarThumb } from '../components/EntryCard'
import Spinner from '../components/Spinner'
import s from './DMPage.module.css'

export default function DMPage() {
  const session = useAuth()
  const uid = session.user.id
  const [view, setView]             = useState('list') // list | chat
  const [conversations, setConvos]  = useState([])
  const [activeUser, setActiveUser] = useState(null)
  const [messages, setMessages]     = useState([])
  const [text, setText]             = useState('')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [searchUsers, setSearchUsers] = useState('')
  const [userResults, setUserResults] = useState([])
  const [searching, setSearching]   = useState(false)
  const channelRef = useRef(null)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => { loadConversations() }, [])

  async function loadConversations() {
    setLoading(true)
    try {
      // Get all messages involving current user
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(id, username, avatar_url), recipient:profiles!recipient_id(id, username, avatar_url)')
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order('created_at', { ascending: false })

      // Group into conversations by the other user
      const convMap = {}
      ;(data||[]).forEach(msg => {
        const other = msg.sender_id === uid ? msg.recipient : msg.sender
        if (!other) return
        if (!convMap[other.id]) {
          convMap[other.id] = { profile: other, lastMsg: msg, unread: 0 }
        }
        if (!msg.read && msg.recipient_id === uid) convMap[other.id].unread++
      })
      setConvos(Object.values(convMap).sort((a,b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)))
    } finally { setLoading(false) }
  }

  async function openChat(userProfile) {
    setActiveUser(userProfile)
    setView('chat')
    loadMessages(userProfile.id)
    subscribeToMessages(userProfile.id)
    // Mark messages as read
    await supabase.from('messages').update({ read: true })
      .eq('recipient_id', uid).eq('sender_id', userProfile.id).eq('read', false)
  }

  async function loadMessages(otherId) {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, username, avatar_url)')
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
    setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
  }

  function subscribeToMessages(otherId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`dm:${[uid, otherId].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${uid}`,
      }, async (payload) => {
        if (payload.new.sender_id !== otherId) return
        const { data } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(id, username, avatar_url)')
          .eq('id', payload.new.id).single()
        if (data) {
          setMessages(p => [...p, data])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          await supabase.from('messages').update({ read: true }).eq('id', data.id)
        }
      })
      .subscribe()
    channelRef.current = channel
  }

  function closeChat() {
    setView('list')
    setActiveUser(null)
    setMessages([])
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    loadConversations()
  }

  async function sendMessage() {
    if (!text.trim() || sending || !activeUser) return
    setSending(true)
    const content = text.trim()
    setText('')
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: uid, recipient_id: activeUser.id, text: content })
        .select('*, sender:profiles!sender_id(id, username, avatar_url)')
        .single()
      if (!error && data) {
        setMessages(p => [...p, data])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        // Notification
        await supabase.from('notifications').insert({
          user_id: activeUser.id, actor_id: uid, type: 'message',
          meta: { text: content.slice(0, 60) }
        })
      }
    } finally { setSending(false) }
  }

  async function searchForUsers(val) {
    setSearchUsers(val)
    if (val.trim().length < 2) { setUserResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${val}%`)
      .neq('id', uid)
      .limit(8)
    setUserResults(data || [])
    setSearching(false)
  }

  const timeStr = iso => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff/60000)}m`
    if (diff < 86400000) return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  }

  // ── Chat view ──
  if (view === 'chat' && activeUser) return (
    <div className={s.chatPage}>
      <div className={s.chatHeader}>
        <button className={s.backBtn} onClick={closeChat}>←</button>
        <div className={s.chatHeaderUser} onClick={() => {}}>
          <AvatarThumb url={activeUser.avatar_url} username={activeUser.username} />
          <span className={s.chatHeaderName}>@{activeUser.username}</span>
        </div>
      </div>

      <div className={s.messageList}>
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === uid
          const showAvatar = !isMe && (i === 0 || messages[i-1]?.sender_id !== msg.sender_id)
          return (
            <div key={msg.id} className={s.msgRow + (isMe ? ' ' + s.msgRowMe : '')}>
              {!isMe && (
                <div className={s.msgAvatar}>
                  {showAvatar ? <AvatarThumb url={activeUser.avatar_url} username={activeUser.username} small /> : <div className={s.msgAvatarSpace} />}
                </div>
              )}
              <div className={s.bubble + (isMe ? ' ' + s.bubbleMe : '')}>
                <p className={s.bubbleText}>{msg.text}</p>
                <p className={s.bubbleTime}>{timeStr(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className={s.chatInput}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={`Message @${activeUser.username}…`}
          className={s.chatInputBox}
        />
        <button className={s.chatSend} onClick={sendMessage} disabled={!text.trim() || sending}>
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  )

  // ── Conversation list ──
  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Messages</h1>
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>◎</span>
          <input
            className={s.searchInput}
            placeholder="Find someone to message…"
            value={searchUsers}
            onChange={e => searchForUsers(e.target.value)}
          />
          {searchUsers && <button className={s.clearBtn} onClick={() => { setSearchUsers(''); setUserResults([]) }}>✕</button>}
        </div>
        {searching && <div className={s.searchingDot}><Spinner size={14} /></div>}
        {userResults.length > 0 && (
          <div className={s.userResults}>
            {userResults.map(u => (
              <div key={u.id} className={s.userResult} onClick={() => { setSearchUsers(''); setUserResults([]); openChat(u) }}>
                <AvatarThumb url={u.avatar_url} username={u.username} />
                <span className={s.userResultName}>@{u.username}</span>
                <span className={s.userResultArrow}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className={s.center}><Spinner /></div>
      ) : conversations.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyIcon}>💬</p>
          <p className={s.emptyTitle}>No messages yet</p>
          <p className={s.emptySub}>Search for someone above to start a conversation.</p>
        </div>
      ) : (
        <div className={s.convList}>
          {conversations.map(c => (
            <div key={c.profile.id} className={s.convItem} onClick={() => openChat(c.profile)}>
              <div className={s.convAvatar}>
                <AvatarThumb url={c.profile.avatar_url} username={c.profile.username} />
                {c.unread > 0 && <div className={s.unreadBadge}>{c.unread}</div>}
              </div>
              <div className={s.convBody}>
                <div className={s.convTop}>
                  <span className={s.convName}>@{c.profile.username}</span>
                  <span className={s.convTime}>{timeStr(c.lastMsg.created_at)}</span>
                </div>
                <p className={s.convPreview + (c.unread > 0 ? ' ' + s.convUnread : '')}>
                  {c.lastMsg.sender_id === uid ? 'You: ' : ''}{c.lastMsg.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
