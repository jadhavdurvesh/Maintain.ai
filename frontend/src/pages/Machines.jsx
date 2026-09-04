import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

const EMPTY_FORM = {
  machine_code: '', name: '', category: 'induction_motor', manufacturer: '',
  model_number: '', location: '', department: '', operating_hours: 0,
  criticality: 'medium', maintenance_interval_hours: 500,
}

export default function Machines() {
  const [machines, setMachines] = useState(null)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const navigate = useNavigate()

  usePageHeader('Machines & Assets', (
    <button className="btn" onClick={() => setShowForm((s) => !s)}>
      {showForm ? 'Cancel' : '+ Add Machine'}
    </button>
  ))

  const load = () => api.get('/api/machines').then(setMachines).catch((e) => setError(e.message))

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/machines', {
        ...form,
        operating_hours: Number(form.operating_hours),
        maintenance_interval_hours: Number(form.maintenance_interval_hours),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (error) return <ErrorState message={error} />
  if (!machines) return <Loading />

  return (
    <>
      {showForm && (
        <LiquidGlass lens variant="regular" className="section-gap">
          <div className="panel-header"><span className="panel-title">New Machine</span></div>
          <form className="panel-body" onSubmit={submit}>
            <div className="grid-3">
              <div className="field">
                <label>Machine code</label>
                <input required value={form.machine_code} onChange={(e) => setForm({ ...form, machine_code: e.target.value })} placeholder="M-005" />
              </div>
              <div className="field">
                <label>Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Induction Motor M-005" />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="induction_motor">Induction motor</option>
                  <option value="pump">Pump</option>
                  <option value="conveyor">Conveyor</option>
                  <option value="compressor">Compressor</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Manufacturer</label>
                <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="field">
                <label>Department</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="field">
                <label>Operating hours</label>
                <input type="number" value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} />
              </div>
              <div className="field">
                <label>Maintenance interval (hours)</label>
                <input type="number" value={form.maintenance_interval_hours} onChange={(e) => setForm({ ...form, maintenance_interval_hours: e.target.value })} />
              </div>
              <div className="field">
                <label>Criticality</label>
                <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <button className="btn" type="submit">Save Machine</button>
          </form>
        </LiquidGlass>
      )}

      <LiquidGlass lens variant="regular">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Location</th><th>Hours</th><th>Health</th><th>Status</th></tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="clickable" onClick={() => navigate(`/machines/${m.id}`)}>
                <td className="mono">{m.machine_code}</td>
                <td>{m.name}</td>
                <td>{m.location || '—'}</td>
                <td className="mono">{m.operating_hours}</td>
                <td className="mono">{m.health_score}/100</td>
                <td><StatusBadge status={m.status} /></td>
              </tr>
            ))}
            {machines.length === 0 && <tr><td colSpan={6} className="empty-state">No machines yet — add your first one above.</td></tr>}
          </tbody>
        </table>
      </LiquidGlass>
    </>
  )
}
