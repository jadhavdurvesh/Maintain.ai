import { useEffect, useState } from 'react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import { GenericBarChart } from '../components/Charts.jsx'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Reports() {
  const [reliability, setReliability] = useState(null)
  const [failures, setFailures] = useState(null)
  const [error, setError] = useState(null)

  usePageHeader('Reports & Analytics', (
    <div className="chip-row">
      <a className="btn secondary" href={`${API_BASE}/api/reports/export/csv`}>CSV</a>
      <a className="btn secondary" href={`${API_BASE}/api/reports/export/excel`}>Excel</a>
      <a className="btn" href={`${API_BASE}/api/reports/export/pdf`}>PDF Report</a>
    </div>
  ))

  useEffect(() => {
    Promise.all([api.get('/api/reports/reliability'), api.get('/api/reports/failure-analysis')])
      .then(([r, f]) => { setReliability(r); setFailures(f) })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!reliability) return <Loading />

  const faultChartData = reliability.map((r) => ({ name: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name, faults: r.fault_count }))
  const completionChartData = reliability
    .filter((r) => r.completion_rate != null)
    .map((r) => ({ name: r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name, rate: r.completion_rate }))
  const causeChartData = failures.most_common_causes.map(([cause, count]) => ({ name: cause.length > 14 ? cause.slice(0, 13) + '…' : cause, count }))

  return (
    <>
      <div className="grid-2 section-gap">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Faults by Machine</span></div>
          <div className="panel-body"><GenericBarChart data={faultChartData} xKey="name" yKey="faults" tone="critical" /></div>
        </LiquidGlass>
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Maintenance Completion Rate</span></div>
          <div className="panel-body"><GenericBarChart data={completionChartData} xKey="name" yKey="rate" tone="healthy" /></div>
        </LiquidGlass>
      </div>

      <LiquidGlass lens variant="regular" className="section-gap">
        <div className="panel-header"><span className="panel-title">Machine Reliability</span></div>
        <table>
          <thead><tr><th>Machine</th><th>Faults</th><th>Maintenance Total</th><th>Completed</th><th>Completion Rate</th><th>Health</th></tr></thead>
          <tbody>
            {reliability.map((r) => (
              <tr key={r.machine_id}>
                <td>{r.name}</td>
                <td className="mono">{r.fault_count}</td>
                <td className="mono">{r.maintenance_total}</td>
                <td className="mono">{r.maintenance_completed}</td>
                <td className="mono">{r.completion_rate != null ? `${r.completion_rate}%` : '—'}</td>
                <td className="mono">{r.health_score}/100</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LiquidGlass>

      <div className="grid-2">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Failure Analysis</span></div>
          <div className="panel-body">
            {causeChartData.length > 0
              ? <GenericBarChart data={causeChartData} xKey="name" yKey="count" tone="accent" height={180} />
              : <div className="empty-state">No fault causes logged yet.</div>}
          </div>
        </LiquidGlass>
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Failure Causes (table)</span></div>
          <table>
            <thead><tr><th>Cause</th><th>Occurrences</th></tr></thead>
            <tbody>
              {failures.most_common_causes.map(([cause, count]) => (
                <tr key={cause}><td>{cause}</td><td className="mono">{count}</td></tr>
              ))}
              {failures.most_common_causes.length === 0 && <tr><td colSpan={2} className="empty-state">No fault causes logged yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>
      </div>
    </>
  )
}
