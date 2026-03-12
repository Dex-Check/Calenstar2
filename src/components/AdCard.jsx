import s from './AdCard.module.css'

// Placeholder ad card — in production swap this for Google AdSense, Meta Audience Network, etc.
const ADS = [
  { label:'Sponsored', brand:'DayOne Pro', copy:'The most private journal app — now with AI summaries.', cta:'Try free', color:'#4cc9f0', emoji:'📓' },
  { label:'Sponsored', brand:'Headspace', copy:'Take 10 minutes. Feel calmer today.', cta:'Start meditating', color:'#06d6a0', emoji:'🧘' },
  { label:'Sponsored', brand:'Nike Training', copy:'Your next PR starts today.', cta:'Download app', color:'#ff4d6d', emoji:'🏃' },
]

export default function AdCard() {
  const ad = ADS[Math.floor(Math.random() * ADS.length)]
  return (
    <div className={s.card} style={{ '--ad-color': ad.color }}>
      <span className={s.label}>{ad.label}</span>
      <div className={s.inner}>
        <span className={s.emoji}>{ad.emoji}</span>
        <div className={s.content}>
          <p className={s.brand}>{ad.brand}</p>
          <p className={s.copy}>{ad.copy}</p>
        </div>
        <button className={s.cta}>{ad.cta}</button>
      </div>
    </div>
  )
}
