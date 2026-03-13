import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePushNotifications } from '../hooks/usePushNotifications'
import Spinner from '../components/Spinner'
import s from './NotificationsPage.module.css'

export default function NotificationsPage() {
  const session = useAuth()
  const uid = session.user.id
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(true)

  const { supported, permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(uid)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!actor_id(username, avatar_url)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(40)
      setNotifs(data || [])
      setLoading(false)
      // Mark all read
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', uid).eq('read', false)
    }
    load()
  }, [])

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Activity</h1>

        {/* Push notification toggle */}
        {supported && (
          <div className={s.pushRow}>
            <div className={s.pushInfo}>
              <p className={s.pushTitle}>Push notifications</p>
              <p className={s.pushSub}>
                {!subscribed
                  ? 'Get notified when someone likes or follows you'
                  : 'You\'ll be notified of likes, comments & follows'
                }
              </p>
            </div>
            {pushLoading ? <Spinner size={20} /> : (
              subscribed
                ? <button className={s.pushBtn + ' ' + s.pushOn} onClick={unsubscribe}>On</button>
                : <button className={s.pushBtn} onClick={subscribe} disabled={permission === 'denied'}>
                    {permission === 'denied' ? 'Blocked' : 'Turn on'}
                  </button>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <div className={s.center}><Spinner /></div>
      ) : notifs.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyIcon}>🔔</p>
          <p className={s.emptyTitle}>No activity yet</p>
          <p className={s.emptySub}>Likes, comments, and follows will appear here.</p>
        </div>
      ) : (
        <div className={s.list}>
          {notifs.map(n => (
            <div key={n.id} className={s.item + (!n.read ? ' ' + s.unread : '')}>
              <div className={s.actorAvatar}>
                {n.actor?.avatar_url?.startsWith('emoji:')
                  ? <div className={s.actorEmoji}>{n.actor.avatar_url.replace('emoji:','')}</div>
                  : n.actor?.avatar_url
                    ? <img src={n.actor.avatar_url} alt="" className={s.actorImg} />
                    : <div className={s.actorFb}>{(n.actor?.username||'?')[0].toUpperCase()}</div>
                }
              </div>
              <p className={s.notifText}>
                <strong>@{n.actor?.username}</strong>
                {n.type === 'like'    && ' liked your entry'}
                {n.type === 'comment' && ` commented: "${n.meta?.text}"`}
                {n.type === 'follow'  && ' started following you'}
              </p>
              <span className={s.time}>{timeAgo(n.created_at)}</span>
              {!n.read && <div className={s.unreadDot} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function timeAgo(iso) {
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (sec < 60) return 'now'
  if (sec < 3600) return `${Math.floor(sec/60)}m`
  if (sec < 86400) return `${Math.floor(sec/3600)}h`
  return `${Math.floor(sec/86400)}d`
}
