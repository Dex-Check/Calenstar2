export default function Spinner({ size = 24, color = 'var(--accent)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,.1)`,
      borderTopColor: color,
      animation: 'spin .7s linear infinite',
      flexShrink: 0,
    }} />
  )
}
