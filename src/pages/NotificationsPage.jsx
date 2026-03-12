import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'
import s from './NotificationsPage.module.css'

export default function NotificationsPage() {
  const session = useAuth()
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!actor_id(username, avatar_url)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(40)
      setNotifs(data || [])
      setLoading(false)

      // Mark all read
      await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id).eq('read', false)
    }
    load()
  }, [])

  return (
    <div className={s.page}>
      <header className={s.header}><h1 className={s.title}>Activity</h1></header>
      {loading
        ? <div className={s.center}><Spinner /></div>
        : notifs.length === 0
          ? <div className={s.empty}><p className={s.emptyTitle}>No activity yet</p><p className={s.emptySub}>Likes and follows will appear here.</p></div>
          : <div className={s.list}>
              {notifs.map(n => (
                <div key={n.id} className={s.item + (!n.read ? ' ' + s.unread : '')}>
                  <div className={s.actor}>
                    {n.actor?.avatar_url
                      ? <img src={n.actor.avatar_url} alt="" className={s.actorAvatar} />
                      : <div className={s.actorFallback}>{(n.actor?.username||'?')[0].toUpperCase()}</div>
                    }
                  </div>
                  <p className={s.notifText}>
                    <strong>@{n.actor?.username}</strong>
                    {n.type === 'like' && ' liked your entry'}
                    {n.type === 'comment' && ` commented: "${n.meta?.text}"`}
                    {n.type === 'follow' && ' started following you'}
                  </p>
                  <span className={s.time}>{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
      }
    </div>
  )
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}
