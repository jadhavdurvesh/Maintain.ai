import { useEffect, useState } from 'react'
import { LiquidGlass } from '@sohumsuthar/liquid-glass'
import api from '../api/client.js'
import { Loading, ErrorState } from './Dashboard.jsx'
import { usePageHeader } from '../PageHeaderContext.jsx'

export default function SettingsPage() {
  usePageHeader('Settings')
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ username: '', full_name: '', role: 'technician' })

  const [keyStatus, setKeyStatus] = useState(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  const load = () => api.get('/api/users').then(setUsers).catch((e) => setError(e.message))
  const loadKeyStatus = () => api.get('/api/settings/gemini-key').then(setKeyStatus).catch(() => {})

  useEffect(() => { load(); loadKeyStatus() }, [])

  const create = async (e) => {
    e.preventDefault()
    await api.post('/api/users', form)
    setForm({ username: '', full_name: '', role: 'technician' })
    load()
  }

  const saveKey = async (e) => {
    e.preventDefault()
    if (!keyDraft.trim()) return
    setKeySaving(true)
    try {
      await api.post('/api/settings/gemini-key', { api_key: keyDraft.trim() })
      setKeyDraft('')
      await loadKeyStatus()
    } finally {
      setKeySaving(false)
    }
  }

  const clearKey = async () => {
    await api.del('/api/settings/gemini-key')
    await loadKeyStatus()
  }

  if (error) return <ErrorState message={error} />
  if (!users) return <Loading />

  return (
    <>
      <LiquidGlass lens variant="regular" className="section-gap">
        <div className="panel-header"><span className="panel-title">AI Assistant — Gemini API Key</span></div>
        <div className="panel-body">
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
            Stored locally in this app's own database — never in a source file, never shipped
            in an installer. The offline diagnostic engine works with no key at all; this only
            enables the "Use Gemini" option in the AI Assistant.
          </p>
          {keyStatus?.configured ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="badge healthy">Configured · •••• {keyStatus.last4}</span>
              <button className="btn secondary" onClick={clearKey}>Remove Key</button>
            </div>
          ) : (
            <form onSubmit={saveKey} style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste your Gemini API key"
              />
              <button className="btn" type="submit" disabled={keySaving}>{keySaving ? 'Saving…' : 'Save Key'}</button>
            </form>
          )}
          <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 10 }}>
            Don't have one? Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              aistudio.google.com/apikey
            </a>.
          </p>
        </div>
      </LiquidGlass>

      <div className="grid-2">
        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Add User</span></div>
          <form className="panel-body" onSubmit={create}>
            <div className="field"><label>Username</label><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div className="field"><label>Full name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Administrator — full control</option>
                <option value="technician">Technician — tasks &amp; AI assistant</option>
                <option value="viewer">Viewer — dashboard &amp; reports only</option>
              </select>
            </div>
            <button className="btn" type="submit">Add User</button>
          </form>
        </LiquidGlass>

        <LiquidGlass lens variant="regular">
          <div className="panel-header"><span className="panel-title">Users</span></div>
          <table>
            <thead><tr><th>Username</th><th>Name</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td className="mono">{u.username}</td><td>{u.full_name || '—'}</td><td>{u.role}</td></tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="empty-state">No users yet.</td></tr>}
            </tbody>
          </table>
        </LiquidGlass>
      </div>

      <LiquidGlass lens variant="regular" className="section-gap">
        <div className="panel-header">
          <span className="panel-title">About MAINTAIN AI</span>
        </div>
        <div
          className="panel-body"
          style={{
            textAlign: 'center',
            padding: '28px 20px',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            MAINTAIN AI
          </div>

          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              margin: '0 auto 24px',
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            AI-powered predictive maintenance and intelligent maintenance management system.
          </p>

          <div
            style={{
              color: 'var(--text-faint)',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 10,
            }}
          >
            Developed by
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.9,
            }}
          >
            <div style={{ fontWeight: 600 }}>Durvesh M. Jadhav</div>
            <div>Shrikant K. Katkar</div>
            <div>Viraj V. Patil</div>
          </div>

          <div
            style={{
              marginTop: 20,
              color: 'var(--text-faint)',
              fontSize: 12,
            }}
          >
            Group Project • 2026&nbsp;&nbsp;·&nbsp;&nbsp;Version 0.1.0
          </div>
        </div>
      </LiquidGlass>

      <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 16 }}>
        Note: there's no login/auth flow yet — roles are stored but not enforced. Worth adding
        before this touches a real shop floor with more than one trusted user.
      </p>
    </>
  )
}
