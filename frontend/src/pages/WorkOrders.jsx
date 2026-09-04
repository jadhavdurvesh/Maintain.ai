import { useEffect, useState } from 'react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

const COLUMNS = [
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

export default function WorkOrders() {
  const [orders, setOrders] = useState(null)
  const [machines, setMachines] = useState([])
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ machine_id: '', problem: '', priority: 'medium', recommended_actions: '', assigned_to: '' })

  usePageHeader('Work Orders', (
    <button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New Work Order'}</button>
  ))

  const load = () => {
    Promise.all([api.get('/api/work-orders'), api.get('/api/machines')])
      .then(([o, m]) => { setOrders(o); setMachines(m) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!form.machine_id) return alert('Choose a machine')
    await api.post('/api/work-orders', { ...form, machine_id: Number(form.machine_id) })
    setForm({ machine_id: '', problem: '', priority: 'medium', recommended_actions: '', assigned_to: '' })
    setShowForm(false)
    load()
  }

  const advance = async (id, status) => {
    await api.patch(`/api/work-orders/${id}`, { status })
    load()
  }

  if (error) return <ErrorState message={error} />
  if (!orders) return <Loading />

  const machineName = (id) => machines.find((m) => m.id === id)?.name || `#${id}`

  return (
    <>
      {showForm && (
        <LiquidGlass lens variant="regular" className="section-gap">
          <form className="panel-body grid-3" onSubmit={create} style={{ alignItems: 'end' }}>
            <div className="field">
              <label>Machine</label>
              <select required value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">Select…</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div className="field">
              <label>Assigned to</label>
              <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Technician name" />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Problem</label>
              <input required value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="High temperature" />
            </div>
            <div className="field">
              <label>Recommended actions</label>
              <input value={form.recommended_actions} onChange={(e) => setForm({ ...form, recommended_actions: e.target.value })} placeholder="Inspect cooling, check load" />
            </div>
            <button className="btn" type="submit" style={{ gridColumn: 'span 3' }}>Create Work Order</button>
          </form>
        </LiquidGlass>
      )}

      <div className="grid-3">
        {COLUMNS.map((col) => (
          <LiquidGlass lens variant="regular" key={col.key}>
            <div className="panel-header"><span className="panel-title">{col.label} ({orders.filter(o => o.status === col.key).length})</span></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.filter((o) => o.status === col.key).map((o) => (
                <div key={o.id} className="panel" style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>WORK ORDER #{o.id} · {machineName(o.machine_id)}</div>
                  <div style={{ marginBottom: 8 }}>{o.problem}</div>
                  <div className="chip-row">
                    {col.key === 'pending' && <button className="btn secondary" onClick={() => advance(o.id, 'in_progress')}>Start</button>}
                    {col.key === 'in_progress' && <button className="btn secondary" onClick={() => advance(o.id, 'completed')}>Complete</button>}
                  </div>
                </div>
              ))}
              {orders.filter((o) => o.status === col.key).length === 0 && <div className="empty-state">None</div>}
            </div>
          </LiquidGlass>
        ))}
      </div>
    </>
  )
}
