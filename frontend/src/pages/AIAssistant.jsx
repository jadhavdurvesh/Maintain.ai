import { useEffect, useState } from 'react'
import api from '../api/client.js'
import { Bot, ShieldAlert } from 'lucide-react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function AIAssistant() {
  usePageHeader('AI Maintenance Assistant')
  const [machines, setMachines] = useState([])
  const [machineId, setMachineId] = useState('')
  const [useOnline, setUseOnline] = useState(false)
  const [problem, setProblem] = useState('')
  const [answers, setAnswers] = useState([])
  const [pendingQuestions, setPendingQuestions] = useState([])
  const [answerDraft, setAnswerDraft] = useState('')
  const [result, setResult] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [outcomeSaved, setOutcomeSaved] = useState(false)

  useEffect(() => { api.get('/api/machines').then(setMachines).catch(() => {}) }, [])

  const reset = () => {
    setProblem(''); setAnswers([]); setPendingQuestions([]); setAnswerDraft('')
    setResult(null); setSessionId(null); setOutcome(''); setOutcomeSaved(false)
  }

  const runDiagnosis = async (allAnswers) => {
    setLoading(true)
    try {
      const res = await api.post('/api/ai/diagnose', {
        machine_id: machineId ? Number(machineId) : null,
        problem_description: problem,
        answers: allAnswers,
        use_online_ai: useOnline,
      })
      setResult(res)
      setSessionId(res.session_id)
      setPendingQuestions(res.needs_more_info ? res.clarifying_questions : [])
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const submitProblem = (e) => {
    e.preventDefault()
    if (!problem.trim()) return
    runDiagnosis([])
  }

  const submitAnswer = (e) => {
    e.preventDefault()
    if (!answerDraft.trim()) return
    const next = [...answers, answerDraft.trim()]
    setAnswers(next)
    setAnswerDraft('')
    runDiagnosis(next)
  }

  const saveOutcome = async () => {
    if (!sessionId || !outcome.trim()) return
    await api.post(`/api/ai/sessions/${sessionId}/outcome?final_technician_result=${encodeURIComponent(outcome)}`)
    setOutcomeSaved(true)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <LiquidGlass lens variant="regular" className="section-gap">
        <div className="panel-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label>Machine (optional)</label>
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)} disabled={!!result}>
              <option value="">General / unspecified</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={useOnline} onChange={(e) => setUseOnline(e.target.checked)} disabled={!!result} />
            Use Gemini (falls back to offline automatically if unavailable)
          </label>
        </div>
      </LiquidGlass>

        {!result && (
          <LiquidGlass macro lens variant="regular" className="section-gap" contentClassName="glass-panel-content">
            <form onSubmit={submitProblem}>
              <div className="panel-header"><span className="panel-title">Describe the problem</span></div>
              <div className="panel-body">
                <textarea
                  required
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="e.g. My motor is overheating and making noise."
                />
                <button className="btn" type="submit" disabled={loading} style={{ marginTop: 10 }}>
                  {loading ? 'Analyzing…' : 'Diagnose'}
                </button>
              </div>
            </form>
          </LiquidGlass>
        )}

        {result && (
          <LiquidGlass macro lens variant="regular" contentClassName="glass-panel-content">
            <div className="panel-header">
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bot size={14} /> Diagnosis</span>
              <span className="badge neutral">{result.source === 'gemini' ? 'Gemini' : 'Offline engine'}</span>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--warning-dim)', borderRadius: 3, marginBottom: 16, color: 'var(--warning)' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13 }}>{result.safety_notice}</span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 6 }}>PROBLEM</div>
                <div>{problem}</div>
              </div>

              {answers.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 6 }}>ANSWERS SO FAR</div>
                  {answers.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 2 }}>• {a}</div>)}
                </div>
              )}

              {pendingQuestions.length > 0 ? (
                <form onSubmit={submitAnswer}>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 6 }}>NEXT QUESTION</div>
                  <div style={{ marginBottom: 10 }}>{pendingQuestions[0]}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={answerDraft} onChange={(e) => setAnswerDraft(e.target.value)} placeholder="Your answer…" autoFocus />
                    <button className="btn" type="submit" disabled={loading}>{loading ? '…' : 'Answer'}</button>
                  </div>
                </form>
              ) : (
                <>
                  {result.possible_causes.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 8 }}>POSSIBLE CAUSES</div>
                      {result.possible_causes.map((c) => (
                        <div key={c.cause} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span>{c.cause} <span className="badge neutral" style={{ marginLeft: 6 }}>{c.certainty}</span></span>
                            <span className="mono">{c.confidence}%</span>
                          </div>
                          <div className="cause-bar-track"><div className="cause-bar-fill" style={{ width: `${c.confidence}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.recommended_procedure.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 8 }}>RECOMMENDED INSPECTION PROCEDURE</div>
                      <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)' }}>
                        {result.recommended_procedure.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                      </ol>
                    </div>
                  )}

                  <div className="field">
                    <label>What did the technician actually find? (optional — improves future accuracy tracking)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Confirmed worn bearing, replaced" disabled={outcomeSaved} />
                      <button className="btn secondary" onClick={saveOutcome} disabled={outcomeSaved}>{outcomeSaved ? 'Saved' : 'Save'}</button>
                    </div>
                  </div>

                  <button className="btn secondary" onClick={reset} style={{ marginTop: 8 }}>Start New Diagnosis</button>
                </>
              )}
            </div>
          </LiquidGlass>
        )}
    </div>
  )
}
