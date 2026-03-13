import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(() => {
    try { return Notification?.permission || 'default' } catch { return 'default' }
  })
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const supported = typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  const vapidReady = VAPID_PUBLIC_KEY.length > 10

  useEffect(() => {
    if (!userId || !supported) return
    checkExisting()
  }, [userId])

  async function checkExisting() {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      setSubscribed(!!existing)
    } catch (e) {
      console.warn('Push check failed:', e)
    }
  }

  async function subscribe() {
    setError(null)

    if (!vapidReady) {
      setError('Push not configured yet — add VITE_VAPID_PUBLIC_KEY to Vercel env vars')
      return
    }
    if (!userId) return

    setLoading(true)
    try {
      // Request browser permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Permission denied — allow notifications in your browser settings')
        return
      }

      // Wait for service worker
      const reg = await navigator.serviceWorker.ready
      if (!reg) throw new Error('Service worker not ready')

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save to Supabase
      const json = sub.toJSON()
      const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh:   json.keys.p256dh,
        auth:     json.keys.auth,
      }, { onConflict: 'user_id,endpoint' })

      if (dbErr) throw dbErr
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe error:', e)
      setError(e.message || 'Could not enable push notifications')
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setError(null)
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions')
          .delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return { supported, vapidReady, permission, subscribed, loading, error, subscribe, unsubscribe }
}
