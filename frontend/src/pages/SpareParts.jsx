import { useEffect, useState } from 'react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function SpareParts() {
  const [parts, setParts] = useState(null)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', part_number: '', quantity: 0, minimum_stock: 1, compatible_machine_categories: '' })

  usePageHeader('Spare Parts', (
    <button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ Add Part'}</button>
  ))

  const load = () => api.get('/api/spare-parts').then(setParts).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    await api.post('/api/spare-parts', { ...form, quantity: Number(form.quantity), minimum_stock: Number(form.minimum_stock) })
    setForm({ name: '', part_number: '', quantity: 0, minimum_stock: 1, compatible_machine_categories: '' })
    setShowForm(false)
    load()
  }

  const setQty = async (id, quantity) => {
    await api.patch(`/api/spare-parts/${id}?quantity=${quantity}`)
    load()
  }

  if (error) return <ErrorState message={error} />
  if (!parts) return <Loading />

  return (
    <>
      {showForm && (
        <LiquidGlass lens variant="regular" className="section-gap">
          <form className="panel-body grid-3" onSubmit={create}>
            <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Part number</label><input required value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} /></div>
            <div className="field"><label>Compatible category</label><input value={form.compatible_machine_categories} onChange={(e) => setForm({ ...form, compatible_machine_categories: e.target.value })} placeholder="induction_motor" /></div>
            <div className="field"><label>Quantity</label><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="field"><label>Minimum stock</label><input type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} /></div>
            <button className="btn" type="submit" style={{ alignSelf: 'end' }}>Save</button>
          </form>
        </LiquidGlass>
      )}
      <LiquidGlass lens variant="regular">
        <table>
          <thead><tr><th>Part</th><th>Part #</th><th>Qty</th><th>Min</th><th>Status</th></tr></thead>
          <tbody>
            {parts.map((p) => {
              const low = p.quantity <= p.minimum_stock
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.part_number}</td>
                  <td className="mono">
                    <input type="number" style={{ width: 70 }} defaultValue={p.quantity}
                      onBlur={(e) => Number(e.target.value) !== p.quantity && setQty(p.id, e.target.value)} />
                  </td>
                  <td className="mono">{p.minimum_stock}</td>
                  <td>{low ? <span className="badge critical">Low stock</span> : <span className="badge healthy">OK</span>}</td>
                </tr>
              )
            })}
            {parts.length === 0 && <tr><td colSpan={5} className="empty-state">No spare parts tracked yet.</td></tr>}
          </tbody>
        </table>
      </LiquidGlass>
    </>
  )
}
