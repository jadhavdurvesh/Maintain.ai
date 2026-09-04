const LABELS = {
  healthy: 'Healthy',
  attention: 'Attention',
  critical: 'Critical',
  normal: 'Normal',
  warning: 'Warning',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const CLASS_MAP = {
  healthy: 'healthy',
  normal: 'healthy',
  low: 'healthy',
  attention: 'warning',
  warning: 'warning',
  medium: 'warning',
  critical: 'critical',
  high: 'critical',
}

export default function StatusBadge({ status }) {
  if (!status) return null
  const cls = CLASS_MAP[status] || 'neutral'
  const label = LABELS[status] || status
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  )
}
