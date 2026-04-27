import { useState } from 'react'
import { API_BASE } from '../lib/api'
import { Icon } from '../components/ui'

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

      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: 'radial-gradient(ellipse at 30% 60%, #2D0A0A 0%, #0D0505 55%, #080808 100%)',
        display: 'flex', flexDirection: 'column', padding: 48,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle vignette ring */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,.55) 100%)',
        }} />

        {/* PBM badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'var(--lw-red)', borderRadius: 999,
            padding: '6px 14px',
          }}>
            <Icon name="shield-check" size={14} style={{ color: '#fff' }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#fff' }}>PBM</span>
          </div>
        </div>

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1.1, maxWidth: 460 }}>
            Run the programme.<br />
            <span style={{ color: 'var(--lw-red)' }}>All of it.</span>
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', marginTop: 20, maxWidth: 400, lineHeight: 1.6 }}>
            Full PBM operations console — chronic, acute, packing, logistics, tariff, compliance, reports.
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', position: 'relative' }}>
          Leadway Health HMO · RxHub v1.0
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────── */}
      <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 52 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--lw-ink)', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13.5, color: 'var(--lw-muted)', marginBottom: 32, lineHeight: 1.55 }}>
            Sign in with your Leadway staff email to access the PBM operations portal.
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              {loading ? <><Icon name="loader-circle" size={16} /> Signing in…</> : 'Sign in →'}
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
