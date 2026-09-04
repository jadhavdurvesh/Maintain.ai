import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = { healthy: '#3ee0b8', attention: '#f5b448', critical: '#ff5d51', accent: '#5b9dff' }

const tooltipStyle = {
  background: '#161b23',
  border: '1px solid #232b36',
  borderRadius: 4,
  fontSize: 12,
  color: '#eef2f7',
  boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
}

const GRADIENT_DEFS = (
  <defs>
    <linearGradient id="gradHealthy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#3ee0b8" stopOpacity={1} />
      <stop offset="100%" stopColor="#1f8f74" stopOpacity={0.85} />
    </linearGradient>
    <linearGradient id="gradWarning" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f5b448" stopOpacity={1} />
      <stop offset="100%" stopColor="#b8801f" stopOpacity={0.85} />
    </linearGradient>
    <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff5d51" stopOpacity={1} />
      <stop offset="100%" stopColor="#c22e24" stopOpacity={0.85} />
    </linearGradient>
    <linearGradient id="gradAccent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#7db4ff" stopOpacity={1} />
      <stop offset="100%" stopColor="#3d6fd6" stopOpacity={0.85} />
    </linearGradient>
  </defs>
)

const FILL_FOR = { healthy: 'url(#gradHealthy)', attention: 'url(#gradWarning)', critical: 'url(#gradCritical)' }

export function HealthDistributionChart({ healthy, attention, critical }) {
  const data = [
    { name: 'Healthy', value: healthy, key: 'healthy' },
    { name: 'Attention', value: attention, key: 'attention' },
    { name: 'Critical', value: critical, key: 'critical' },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return <div className="empty-state">No machines yet.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        {GRADIENT_DEFS}
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4} stroke="none">
          {data.map((d) => <Cell key={d.key} fill={FILL_FOR[d.key]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MachineHealthBarChart({ machines }) {
  const data = machines.map((m) => ({
    name: m.name.length > 14 ? m.name.slice(0, 13) + '…' : m.name,
    health: m.health_score,
    tone: m.health_score >= 70 ? 'healthy' : m.health_score >= 40 ? 'attention' : 'critical',
  }))

  if (data.length === 0) {
    return <div className="empty-state">No machines yet.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {GRADIENT_DEFS}
        <CartesianGrid strokeDasharray="3 3" stroke="#232b36" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#8a97a8', fontSize: 11 }} axisLine={{ stroke: '#232b36' }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#8a97a8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="health" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={FILL_FOR[d.tone]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GenericBarChart({ data, xKey, yKey, tone = 'accent', height = 220 }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">Nothing to show yet.</div>
  }
  const fill = tone === 'accent' ? 'url(#gradAccent)' : FILL_FOR[tone] || 'url(#gradAccent)'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {GRADIENT_DEFS}
        <CartesianGrid strokeDasharray="3 3" stroke="#232b36" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: '#8a97a8', fontSize: 11 }} axisLine={{ stroke: '#232b36' }} tickLine={false} />
        <YAxis tick={{ fill: '#8a97a8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey={yKey} fill={fill} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
