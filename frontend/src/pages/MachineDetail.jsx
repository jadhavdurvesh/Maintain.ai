import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function MachineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [machine, setMachine] = useState(null)
  const [components, setComponents] = useState([])
  const [readings, setReadings] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [error, setError] = useState(null)
  const [newReading, setNewReading] = useState({ reading_type: 'temperature', value: '', unit: '°C' })
  const [newComponent, setNewComponent] = useState('')

  usePageHeader(
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn secondary" onClick={() => navigate('/machines')}>← Back</button>
      {machine?.name || 'Machine'}
    </span>,
    machine ? <StatusBadge status={machine.status} /> : null
  )

  const load = () => {
    Promise.all([
      api.get(`/api/machines/${id}`),
      api.get(`/api/machines/${id}/components`),
      api.get(`/api/machines/${id}/readings`),
      api.get(`/api/maintenance?machine_id=${id}`),
    ])
      .then(([m, c, r, mt]) => { setMachine(m); setComponents(c); setReadings(r); setMaintenance(mt) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [id])

  const addReading = async (e) => {
    e.preventDefault()
    await api.post(`/api/machines/${id}/readings`, { ...newReading, value: Number(newReading.value) })
    setNewReading({ ...newReading, value: '' })
    load()
  }

  const addComponent = async (e) => {
    e.preventDefault()
    if (!newComponent.trim()) return
    await api.post(`/api/machines/${id}/components`, { name: newComponent })
    setNewComponent('')
    load()
  }

  if (error) return <ErrorState message={error} />
  if (!machine) return <Loading />

  return (
    <>
      <div className="stat-grid">
        <LiquidGlass lens variant="regular" className="stat-tile"><div className="stat-label">HEALTH SCORE</div><div className={`stat-value ${machine.status}`}>{machine.health_score}/100</div></LiquidGlass>
        <LiquidGlass lens variant="regular" className="stat-tile"><div className="stat-label">OPERATING HOURS</div><div className="stat-value">{machine.operating_hours}</div></LiquidGlass>
        <LiquidGlass lens variant="regular" className="stat-tile"><div className="stat-label">CRITICALITY</div><div className="stat-value">{machine.criticality}</div></LiquidGlass>
        <LiquidGlass lens variant="regular" className="stat-tile"><div className="stat-label">NEXT MAINTENANCE</div><div className="stat-value" style={{ fontSize: 15 }}>{machine.next_maintenance_date ? new Date(machine.next_maintenance_date).toLocaleDateString() : '—'}</div></LiquidGlass>
      </div>

      <div className="grid-2 section-gap">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Machine Info</span></div>
          <div className="panel-body">
            <InfoRow label="Machine code" value={machine.machine_code} mono />
            <InfoRow label="Category" value={machine.category} />
            <InfoRow label="Manufacturer" value={machine.manufacturer} />
            <InfoRow label="Model" value={machine.model_number} />
            <InfoRow label="Location" value={machine.location} />
            <InfoRow label="Department" value={machine.department} />
            <InfoRow label="Maintenance interval" value={`${machine.maintenance_interval_hours} hrs`} />
          </div>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Components</span></div>
          <div className="panel-body">
            {components.map((c) => <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{c.name}</div>)}
            {components.length === 0 && <div className="empty-state" style={{ padding: '8px 0' }}>No components logged yet.</div>}
            <form onSubmit={addComponent} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={newComponent} onChange={(e) => setNewComponent(e.target.value)} placeholder="e.g. Drive-end bearing" />
              <button className="btn secondary" type="submit">Add</button>
            </form>
          </div>
        </LiquidGlass>
      </div>

      <div className="grid-2">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Sensor / Manual Readings</span></div>
          <div className="panel-body">
            <form onSubmit={addReading} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={newReading.reading_type} onChange={(e) => setNewReading({ ...newReading, reading_type: e.target.value })}>
                <option value="temperature">Temperature</option>
                <option value="vibration">Vibration</option>
                <option value="current">Current</option>
                <option value="load">Load</option>
              </select>
              <input type="number" step="any" required placeholder="value" value={newReading.value} onChange={(e) => setNewReading({ ...newReading, value: e.target.value })} />
              <input style={{ width: 70 }} value={newReading.unit} onChange={(e) => setNewReading({ ...newReading, unit: e.target.value })} />
              <button className="btn secondary" type="submit">Log</button>
            </form>
            <table>
              <thead><tr><th>Type</th><th>Value</th><th>Recorded</th></tr></thead>
              <tbody>
                {readings.slice(0, 8).map((r) => (
                  <tr key={r.id}><td>{r.reading_type}</td><td className="mono">{r.value} {r.unit}</td><td className="mono">{new Date(r.recorded_at).toLocaleString()}</td></tr>
                ))}
                {readings.length === 0 && <tr><td colSpan={3} className="empty-state">No readings logged yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Maintenance History</span></div>
          <table>
            <thead><tr><th>Type</th><th>Status</th><th>Scheduled</th></tr></thead>
            <tbody>
              {maintenance.map((r) => (
                <tr key={r.id}><td>{r.type}</td><td><StatusBadge status={r.status === 'completed' ? 'healthy' : r.status === 'overdue' ? 'critical' : 'warning'} /></td><td className="mono">{r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : '—'}</td></tr>
              ))}
              {maintenance.length === 0 && <tr><td colSpan={3} className="empty-state">No maintenance history yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>
      </div>
    </>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span className={mono ? 'mono' : ''}>{value || '—'}</span>
    </div>
  )
}
