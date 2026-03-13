// supabase/functions/send-push/index.ts
// Triggered via Supabase Database Webhook on notifications INSERT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@calenstar.app'

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const record = body.record // the new notification row

    if (!record?.user_id) return new Response('No user_id', { status: 400 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get actor username for notification text
    const { data: actor } = await supabase
      .from('profiles').select('username').eq('id', record.actor_id).single()

    // Build notification payload
    const messages = {
      like:    `@${actor?.username} liked your entry ❤️`,
      comment: `@${actor?.username} commented on your entry 💬`,
      follow:  `@${actor?.username} started following you 🔥`,
    }
    const body_text = messages[record.type] || 'You have a new notification'

    // Get all push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)

    if (!subs?.length) return new Response('No subscriptions', { status: 200 })

    // Send to each subscription using Web Push
    const results = await Promise.allSettled(subs.map(sub =>
      sendWebPush(sub, {
        title: 'CalenStar',
        body:  body_text,
        icon:  '/icon-192.png',
        url:   '/notifications',
      })
    ))

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error(e)
    return new Response(String(e), { status: 500 })
  }
})

// Minimal Web Push implementation using VAPID
async function sendWebPush(sub: any, payload: any) {
  const { default: webpush } = await import('npm:web-push@3.6.7')
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  )
}
