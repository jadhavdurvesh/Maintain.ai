import { useEffect, useState } from 'react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function Maintenance() {
  usePageHeader('Maintenance')
  const [upcoming, setUpcoming] = useState(null)
  const [records, setRecords] = useState([])
  const [machines, setMachines] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ machine_id: '', type: 'preventive', description: '', scheduled_date: '' })

  const load = () => {
    Promise.all([
      api.get('/api/maintenance/due/upcoming'),
      api.get('/api/maintenance'),
      api.get('/api/machines'),
    ]).then(([u, r, m]) => { setUpcoming(u); setRecords(r); setMachines(m) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  const schedule = async (e) => {
    e.preventDefault()
    if (!form.machine_id) return alert('Choose a machine')
    await api.post(`/api/maintenance/${form.machine_id}`, {
      type: form.type,
      description: form.description,
      scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
    })
    setForm({ machine_id: '', type: 'preventive', description: '', scheduled_date: '' })
    load()
  }

  const complete = async (id) => {
    await api.post(`/api/maintenance/${id}/complete`)
    load()
  }

  if (error) return <ErrorState message={error} />
  if (!upcoming) return <Loading />

  return (
    <>
      <LiquidGlass lens variant="regular" className="section-gap">
        <div className="panel-header"><span className="panel-title">Smart Scheduler — Operating-Hours Based</span></div>
        <table>
          <thead><tr><th>Machine</th><th>Hours / Interval</th><th>Remaining</th><th>Status</th></tr></thead>
          <tbody>
            {upcoming.map((u) => (
              <tr key={u.machine_id}>
                <td>{u.name}</td>
                <td className="mono">{u.operating_hours} / {u.interval_hours}</td>
                <td className="mono">{u.hours_remaining}h</td>
                <td>{u.overdue ? <StatusBadge status="critical" /> : u.due_soon ? <StatusBadge status="warning" /> : <StatusBadge status="healthy" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LiquidGlass>

      <div className="grid-2">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Schedule Maintenance</span></div>
          <form className="panel-body" onSubmit={schedule}>
            <div className="field">
              <label>Machine</label>
              <select required value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select…</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
                <option value="breakdown">Breakdown</option>
                <option value="predictive">Predictive</option>
              </select>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Inspect motor bearings" />
            </div>
            <div className="field">
              <label>Scheduled date</label>
              <input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <button className="btn" type="submit">Schedule</button>
          </form>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Maintenance Records</span></div>
          <table>
            <thead><tr><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.description || r.type}</td>
                  <td><StatusBadge status={r.status === 'completed' ? 'healthy' : 'warning'} /></td>
                  <td>{r.status !== 'completed' && <button className="btn secondary" onClick={() => complete(r.id)}>Mark done</button>}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={3} className="empty-state">Nothing scheduled yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>
      </div>
    </>
  )
}
