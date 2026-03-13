import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import s from './StatsPage.module.css'
import Spinner from '../components/Spinner'

const MOODS = ["🔥","✨","💪","🌙","🌱","😤","🎯","🧘","🏆","💡"]
const MOOD_LABELS = {
  "🔥":"Fired up","✨":"Inspired","💪":"Strong","🌙":"Reflective",
  "🌱":"Growing","😤":"Frustrated","🎯":"Focused","🧘":"Zen","🏆":"Winning","💡":"Creative"
}
const CATS = [
  { id:'work',     icon:'💼', color:'#4cc9f0' },
  { id:'fitness',  icon:'🏃', color:'#06d6a0' },
  { id:'personal', icon:'🧡', color:'#ffd166' },
  { id:'social',   icon:'👥', color:'#ff4d6d' },
  { id:'creative', icon:'🎨', color:'#c77dff' },
  { id:'health',   icon:'🍃', color:'#80ffdb' },
]

export default function StatsPage() {
  const session = useAuth()
  const uid = session.user.id
  const [entries, setEntries] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState(30) // days

  useEffect(() => { load() }, [range])

  async function load() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - range)
    const [{ data: ents }, { data: prof }] = await Promise.all([
      supabase.from('entries').select('*').eq('user_id', uid)
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', uid).single(),
    ])
    setEntries(ents || [])
    setProfile(prof)
    setLoading(false)
  }

  // ── Derived stats ──
  const totalEntries = entries.length
  const totalLikes   = entries.reduce((s, e) => s + (e.like_count||0), 0)
  const avgWords     = totalEntries === 0 ? 0 : Math.round(
    entries.reduce((s, e) => s + (e.text?.split(/\s+/).filter(Boolean).length || 0), 0) / totalEntries
  )

  // Mood frequency
  const moodCounts = {}
  entries.forEach(e => { if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood]||0) + 1 })
  const topMood    = Object.entries(moodCounts).sort((a,b) => b[1]-a[1])[0]
  const moodMax    = Math.max(...Object.values(moodCounts), 1)

  // Category frequency
  const catCounts = {}
  entries.forEach(e => (e.cats||[]).forEach(c => { catCounts[c] = (catCounts[c]||0) + 1 }))
  const catMax = Math.max(...Object.values(catCounts), 1)

  // 30/90-day calendar heatmap
  const heatmapDates = new Set(entries.map(e => e.date))
  const calDays = Array.from({ length: range }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (range - 1 - i))
    return d.toISOString().split('T')[0]
  })

  // Streak calculation from entries
  let longestStreak = 0, curStreak = 0
  const sortedDates = [...heatmapDates].sort()
  sortedDates.forEach((date, i) => {
    if (i === 0) { curStreak = 1 }
    else {
      const prev = new Date(sortedDates[i-1])
      const curr = new Date(date)
      const diff = (curr - prev) / 86400000
      curStreak = diff === 1 ? curStreak + 1 : 1
    }
    longestStreak = Math.max(longestStreak, curStreak)
  })

  // Weekly bar chart (entries per week)
  const weeks = {}
  entries.forEach(e => {
    const d   = new Date(e.date + 'T12:00:00')
    const mon = new Date(d)
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = mon.toISOString().split('T')[0]
    weeks[key] = (weeks[key]||0) + 1
  })
  const weekData = Object.entries(weeks).sort((a,b) => a[0].localeCompare(b[0])).slice(-8)
  const weekMax  = Math.max(...weekData.map(w => w[1]), 1)

  if (loading) return <div className={s.center}><Spinner /></div>

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Your Stats</h1>
        <div className={s.rangeTabs}>
          {[7,30,90].map(r => (
            <button key={r} className={s.rangeTab + (range===r ? ' '+s.rangeActive : '')} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Top cards ── */}
      <div className={s.cards}>
        <div className={s.card}>
          <p className={s.cardVal}>{profile?.streak || 0}<span className={s.cardUnit}>🔥</span></p>
          <p className={s.cardLabel}>Current streak</p>
        </div>
        <div className={s.card}>
          <p className={s.cardVal}>{profile?.best_streak || 0}<span className={s.cardUnit}>⭐</span></p>
          <p className={s.cardLabel}>Best streak</p>
        </div>
        <div className={s.card}>
          <p className={s.cardVal}>{totalEntries}</p>
          <p className={s.cardLabel}>Entries ({range}d)</p>
        </div>
        <div className={s.card}>
          <p className={s.cardVal}>{totalLikes}<span className={s.cardUnit}>❤️</span></p>
          <p className={s.cardLabel}>Likes received</p>
        </div>
        <div className={s.card}>
          <p className={s.cardVal}>{avgWords}</p>
          <p className={s.cardLabel}>Avg words/entry</p>
        </div>
        <div className={s.card}>
          <p className={s.cardVal}>{longestStreak}<span className={s.cardUnit}>🏆</span></p>
          <p className={s.cardLabel}>Longest ({range}d)</p>
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className={s.section}>
        <p className={s.sectionTitle}>Activity heatmap</p>
        <div className={s.heatmap} style={{ '--cols': range <= 7 ? 7 : range <= 30 ? 10 : 13 }}>
          {calDays.map(date => {
            const entry = entries.find(e => e.date === date)
            const has   = heatmapDates.has(date)
            const isToday = date === new Date().toISOString().split('T')[0]
            return (
              <div
                key={date}
                className={s.heatCell + (has ? ' '+s.heatFilled : '') + (isToday ? ' '+s.heatToday : '')}
                title={`${date}${entry ? ` · ${entry.mood||''}` : ''}`}
                style={has ? { '--mood': entry?.mood } : {}}
              >
                {has && entry?.mood && <span className={s.heatMood}>{entry.mood}</span>}
              </div>
            )
          })}
        </div>
        <p className={s.heatLegend}>{totalEntries} entries in the last {range} days</p>
      </div>

      {/* ── Weekly chart ── */}
      {weekData.length > 0 && (
        <div className={s.section}>
          <p className={s.sectionTitle}>Weekly entries</p>
          <div className={s.barChart}>
            {weekData.map(([week, count]) => {
              const label = new Date(week+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
              return (
                <div key={week} className={s.bar}>
                  <div className={s.barFill} style={{ height: `${(count/weekMax)*100}%` }} />
                  <p className={s.barCount}>{count}</p>
                  <p className={s.barLabel}>{label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Mood breakdown ── */}
      {Object.keys(moodCounts).length > 0 && (
        <div className={s.section}>
          <p className={s.sectionTitle}>Mood breakdown</p>
          <div className={s.moodList}>
            {MOODS.filter(m => moodCounts[m]).sort((a,b) => (moodCounts[b]||0)-(moodCounts[a]||0)).map(mood => (
              <div key={mood} className={s.moodRow}>
                <span className={s.moodEmoji}>{mood}</span>
                <div className={s.moodBarWrap}>
                  <div className={s.moodBar} style={{ width: `${(moodCounts[mood]/moodMax)*100}%` }} />
                </div>
                <span className={s.moodCount}>{moodCounts[mood]}</span>
                <span className={s.moodName}>{MOOD_LABELS[mood]}</span>
              </div>
            ))}
          </div>
          {topMood && (
            <p className={s.topMoodNote}>Your vibe lately: {topMood[0]} {MOOD_LABELS[topMood[0]]}</p>
          )}
        </div>
      )}

      {/* ── Category breakdown ── */}
      {Object.keys(catCounts).length > 0 && (
        <div className={s.section}>
          <p className={s.sectionTitle}>Top categories</p>
          <div className={s.catList}>
            {CATS.filter(c => catCounts[c.id]).sort((a,b) => (catCounts[b.id]||0)-(catCounts[a.id]||0)).map(cat => (
              <div key={cat.id} className={s.catRow}>
                <span className={s.catIcon}>{cat.icon}</span>
                <div className={s.catBarWrap}>
                  <div className={s.catBar} style={{ width: `${(catCounts[cat.id]/catMax)*100}%`, background: cat.color }} />
                </div>
                <span className={s.catCount}>{catCounts[cat.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalEntries === 0 && (
        <div className={s.empty}>
          <p className={s.emptyIcon}>📊</p>
          <p className={s.emptyTitle}>No entries in the last {range} days</p>
          <p className={s.emptySub}>Start logging daily to see your stats here.</p>
        </div>
      )}

      <div style={{height:32}} />
    </div>
  )
}
