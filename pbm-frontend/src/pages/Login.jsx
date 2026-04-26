import { useState } from 'react'
import { API_BASE } from '../lib/api'
import { Icon } from '../components/ui'

const ROLES = [
  { id: 'pharmacist',  label: 'Pharmacist' },
  { id: 'pharm_ops',   label: 'Pharmacy Ops' },
  { id: 'logistics',   label: 'Logistics' },
  { id: 'contact',     label: 'Contact Centre' },
  { id: 'admin',       label: 'PBM Admin' },
  { id: 'rider',       label: 'Rider' },
]

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.toLowerCase().endsWith('@leadway.com')) {
      setError('Only @leadway.com accounts can access the PBM portal.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Invalid credentials.')
      } else {
        onLogin(data.user)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--f-sans)' }}>
      {/* Left panel */}
      <div style={{
        flex: 1, background: 'linear-gradient(135deg, #263626 0%, #3A4F3A 100%)',
        display: 'flex', flexDirection: 'column', padding: 48, position: 'relative', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield-check" size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '.06em', color: '#fff' }}>LEADWAY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>Health · PBM Portal</div>
          </div>
        </div>

        {/* Hero quote */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.1, maxWidth: 420 }}>
            Prescriptions managed.<br />Members sorted.
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.6)', marginTop: 18, maxWidth: 380, lineHeight: 1.55 }}>
            The internal operations platform for Leadway Health's Pharmacy Benefit Management team.
          </div>

          {/* Role cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 36, maxWidth: 400 }}>
            {ROLES.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
          Leadway Health HMO · PBM Portal v1.0
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13.5, color: 'var(--lw-muted)', marginBottom: 32 }}>
            Sign in with your Leadway staff email to access the PBM operations portal.
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div className="field">
              <label>Work email</label>
              <input
                className="input"
                type="email"
                placeholder="yourname@leadway.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="field">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lw-muted)' }}
                >
                  <Icon name={showPw ? 'eye-off' : 'eye'} size={17} />
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--lw-red)', cursor: 'pointer', fontWeight: 600 }}>Forgot password?</span>
            </div>

            {error && (
              <div style={{ background: 'var(--s-danger-bg)', border: '1px solid rgba(198,21,49,.2)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--s-danger)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="alert-circle" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
              style={{ justifyContent: 'center', padding: '13px', fontSize: 14, fontWeight: 700, marginTop: 4 }}
            >
              {loading ? <><Icon name="loader-circle" size={16} /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 24, textAlign: 'center' }}>
            Only @leadway.com staff accounts are permitted. Contact IT for access.
          </p>
        </div>
      </div>
    </div>
  )
}
