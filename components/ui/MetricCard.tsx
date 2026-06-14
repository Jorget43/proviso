interface MetricCardProps {
  label: string
  value: string
  color?: 'green' | 'red' | 'blue' | 'pink' | 'teal'
  sub?: string
}

export default function MetricCard({ label, value, color, sub }: MetricCardProps) {
  return (
    <div className="mc">
      <div className="mc-label">{label}</div>
      <div className={`mc-value${color ? ` ${color}` : ''}`}>{value}</div>
      {sub && <div className="mc-sub">{sub}</div>}
    </div>
  )
}
