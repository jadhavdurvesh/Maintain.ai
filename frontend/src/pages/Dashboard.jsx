import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Factory, CheckCircle2, AlertTriangle, Flame, ClipboardList, CalendarClock, Bell } from 'lucide-react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { HealthDistributionChart, MachineHealthBarChart } from '../components/Charts.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function Dashboard() {
  usePageHeader('Dashboard')
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [machines, setMachines] = useState([])
  const [alerts, setAlerts] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [reliability, setReliability] = useState([])
  const [recentFaults, setRecentFaults] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/reports/dashboard'),
      api.get('/api/machines'),
      api.get('/api/alerts'),
      api.get('/api/maintenance/due/upcoming'),
      api.get('/api/reports/reliability'),
      api.get('/api/reports/recent-faults'),
      api.get('/api/reports/recent-activity'),
    ])
      .then(([s, m, a, u, r, rf, ra]) => {
        setSummary(s); setMachines(m); setAlerts(a); setUpcoming(u); setReliability(r)
        setRecentFaults(rf); setRecentActivity(ra)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!summary) return <Loading />

  const tiles = [
    { label: 'TOTAL MACHINES', value: summary.total_machines, cls: '', icon: Factory },
    { label: 'HEALTHY', value: summary.healthy, cls: 'healthy', icon: CheckCircle2 },
    { label: 'NEEDS ATTENTION', value: summary.attention, cls: 'warning', icon: AlertTriangle },
    { label: 'CRITICAL', value: summary.critical, cls: 'critical', icon: Flame },
    { label: 'OPEN WORK ORDERS', value: summary.open_work_orders, cls: '', icon: ClipboardList },
    { label: 'UPCOMING MAINTENANCE', value: summary.upcoming_maintenance, cls: '', icon: CalendarClock },
    { label: 'ACTIVE ALERTS', value: summary.active_alerts, cls: summary.active_alerts > 0 ? 'warning' : '', icon: Bell },
  ]

  return (
    <>
      <div className="stat-grid">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <LiquidGlass lens variant="regular" className={`stat-tile${t.cls ? ` tone-${t.cls}` : ''}`} key={t.label}>
              <Icon size={16} strokeWidth={1.75} className={`stat-icon${t.cls ? ` ${t.cls}` : ''}`} />
              <div className="stat-label">{t.label}</div>
              <div className={`stat-value ${t.cls}`}>{t.value}</div>
            </LiquidGlass>
          )
        })}
      </div>

      <div className="grid-2 section-gap">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Health Distribution</span></div>
          <div className="panel-body">
            <HealthDistributionChart healthy={summary.healthy} attention={summary.attention} critical={summary.critical} />
          </div>
        </LiquidGlass>
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Health Score by Machine</span></div>
          <div className="panel-body">
            <MachineHealthBarChart machines={machines} />
          </div>
        </LiquidGlass>
      </div>

      <div className="grid-2 section-gap">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Machine Health Overview</span></div>
          <table>
            <thead>
              <tr><th>Machine</th><th>Health</th><th>Status</th></tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => navigate(`/machines/${m.id}`)}>
                  <td>{m.name}</td>
                  <td className="mono">{m.health_score}/100</td>
                  <td><StatusBadge status={m.status} /></td>
                </tr>
              ))}
              {machines.length === 0 && <tr><td colSpan={3} className="empty-state">No machines yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Active Alerts</span></div>
          <table>
            <thead><tr><th>Message</th><th>Severity</th></tr></thead>
            <tbody>
              {alerts.slice(0, 6).map((a) => (
                <tr key={a.id}>
                  <td>{a.message}</td>
                  <td><StatusBadge status={a.severity} /></td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={2} className="empty-state">No active alerts.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>
      </div>

      <div className="grid-2 section-gap">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Recent Faults</span></div>
          <table>
            <thead><tr><th>Machine</th><th>Fault</th><th>Cause</th><th></th></tr></thead>
            <tbody>
              {recentFaults.map((f) => (
                <tr key={f.id}>
                  <td>{f.machine_name}</td>
                  <td>{f.description}</td>
                  <td>{f.cause || '—'}</td>
                  <td>{f.resolved ? <StatusBadge status="healthy" /> : <StatusBadge status={f.severity} />}</td>
                </tr>
              ))}
              {recentFaults.length === 0 && <tr><td colSpan={4} className="empty-state">No faults logged yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Recent Technician Activity</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--text)' }}>{e.description}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 11.5, marginTop: 2 }}>
                    {e.machine_name} · {e.performed_by || 'unassigned'} · {timeAgo(e.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <div className="empty-state">No completed activity yet.</div>}
          </div>
        </LiquidGlass>
      </div>

      <div className="grid-2">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Upcoming Maintenance</span></div>
          <table>
            <thead><tr><th>Machine</th><th>Hours Remaining</th><th></th></tr></thead>
            <tbody>
              {upcoming.slice(0, 6).map((u) => (
                <tr key={u.machine_id}>
                  <td>{u.name}</td>
                  <td className="mono">{u.hours_remaining}h</td>
                  <td>{u.overdue ? <StatusBadge status="critical" /> : u.due_soon ? <StatusBadge status="warning" /> : <StatusBadge status="healthy" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Most Frequently Failing Machines</span></div>
          <table>
            <thead><tr><th>Machine</th><th>Faults</th><th>Completion Rate</th></tr></thead>
            <tbody>
              {reliability.slice(0, 6).map((r) => (
                <tr key={r.machine_id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.fault_count}</td>
                  <td className="mono">{r.completion_rate != null ? `${r.completion_rate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LiquidGlass>
      </div>
    </>
  )
}

export function Loading() {
  return <div className="empty-state">Loading…</div>
}

function timeAgo(isoString) {
  if (!isoString) return 'unknown time'
  const diffMs = Date.now() - new Date(isoString + 'Z').getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ErrorState({ message }) {
  return (
    <LiquidGlass lens variant="regular" contentClassName="panel-body">
      <strong style={{ color: 'var(--critical)' }}>Couldn't reach the backend.</strong>
      <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
        Make sure the API is running (see backend/README) and VITE_API_URL points at it.
      </p>
      <p className="mono" style={{ color: 'var(--text-faint)', marginTop: 8, fontSize: 12 }}>{message}</p>
    </LiquidGlass>
  )
}
