import { useState, useEffect } from 'react'
import { Icon, Pill } from '../components/ui'

const ACTION_KIND = {
  'Login':            'default',
  'Claim Submitted':  'success',
  'Drug Updated':     'warn',
  'Order Approved':   'success',
  'Order Rejected':   'danger',
  'Tariff Updated':   'warn',
  'Rider Added':      'default',
  'Stock Receipt':    'success',
  'OTP Verified':     'success',
  'Payout Processed': 'success',
  'Enrollment':       'default',
  'Flag Raised':      'danger',
}

export default function AuditTrail({ setToast }) {
  const [events, setEvents]   = useState([])
  const [search, setSearch]   = useState('')
  const [roleF, setRoleF]     = useState('all')
  const [typeF, setTypeF]     = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch('/api/audit', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setEvents(d); setLoading(false) }).catch(() => { setEvents(MOCK_AUDIT); setLoading(false) })
  }, [])

  const roles = ['all', ...new Set(events.map(e => e.role).filter(Boolean))]
  const types = ['all', ...new Set(events.map(e => e.action).filter(Boolean))]

  const filtered = events.filter(ev => {
    const q = search.toLowerCase()
    const matchQ = !q || ev.user.toLowerCase().includes(q) || ev.action.toLowerCase().includes(q) || (ev.detail || '').toLowerCase().includes(q)
    const matchR = roleF === 'all' || ev.role === roleF
    const matchT = typeF === 'all' || ev.action === typeF
    return matchQ && matchR && matchT
  })

  const exportCSV = () => {
    const rows = [['Timestamp', 'User', 'Role', 'Action', 'Detail', 'IP']]
    filtered.forEach(e => rows.push([e.timestamp, e.user, e.role, e.action, e.detail || '', e.ip || '']))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'audit_trail.csv'; a.click()
    setToast('Audit log exported')
  }

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search user, action, detail…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 160 }} value={roleF} onChange={e => setRoleF(e.target.value)}>
          {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'All roles' : r}</option>)}
        </select>
        <select className="input" style={{ width: 180 }} value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="all">All event types</option>
          {types.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn--ghost btn--sm" onClick={exportCSV}>
          <Icon name="download" size={13} /> Export CSV
        </button>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} events</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Role</th>
              <th>Event</th>
              <th>Detail</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--lw-muted)', whiteSpace: 'nowrap' }}>{ev.timestamp}</td>
                <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{ev.user}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{ev.role}</td>
                <td><Pill kind={ACTION_KIND[ev.action] || 'default'}>{ev.action}</Pill></td>
                <td style={{ fontSize: 12.5, color: 'var(--lw-muted)', maxWidth: 280 }} className="truncate">{ev.detail || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--lw-muted)' }}>{ev.ip || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No audit events match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const MOCK_AUDIT = [
  { timestamp: '2026-04-18 08:01:22', user: 'Amaka Obi',         role: 'pharmacist',  action: 'Login',            detail: 'Successful login',                      ip: '105.112.3.44' },
  { timestamp: '2026-04-18 08:14:05', user: 'Amaka Obi',         role: 'pharmacist',  action: 'Order Approved',   detail: 'Acute order AO-007 for Taiwo Ogundimu', ip: '105.112.3.44' },
  { timestamp: '2026-04-18 09:00:10', user: 'Olu Adeyemi',       role: 'pharm_ops',   action: 'Login',            detail: 'Successful login',                      ip: '197.210.55.8' },
  { timestamp: '2026-04-18 09:12:44', user: 'Olu Adeyemi',       role: 'pharm_ops',   action: 'Stock Receipt',    detail: 'Metformin 500mg: +500 units (MFR-2025-041)', ip: '197.210.55.8' },
  { timestamp: '2026-04-18 09:30:00', user: 'Chidi Emeka',       role: 'logistics',   action: 'Login',            detail: 'Successful login',                      ip: '41.58.107.20' },
  { timestamp: '2026-04-18 10:02:13', user: 'Chidi Emeka',       role: 'logistics',   action: 'OTP Verified',     detail: 'DEL-003 Ngozi Adeyemi — OTP match',     ip: '41.58.107.20' },
  { timestamp: '2026-04-18 10:15:29', user: 'Admin User',        role: 'admin',       action: 'Tariff Updated',   detail: 'Lisinopril 10mg: ₦420 → ₦480',          ip: '105.112.0.1'  },
  { timestamp: '2026-04-18 10:44:00', user: 'Amaka Obi',         role: 'pharmacist',  action: 'Drug Updated',     detail: 'Metformin 500mg — paused for Emeka Nwosu', ip: '105.112.3.44' },
  { timestamp: '2026-04-18 11:05:12', user: 'Olu Adeyemi',       role: 'pharm_ops',   action: 'Claim Submitted',  detail: 'CLM-2026-003 Ngozi Adeyemi ₦156,000',  ip: '197.210.55.8' },
  { timestamp: '2026-04-18 11:30:00', user: 'Fatima Sule',       role: 'contact',     action: 'Enrollment',       detail: 'New member: Chiamaka Uzor LH-OS-0022',  ip: '102.89.45.11' },
  { timestamp: '2026-04-18 12:05:44', user: 'Admin User',        role: 'admin',       action: 'Rider Added',      detail: 'New rider: Emeka Obi (Surulere zone)',   ip: '105.112.0.1'  },
  { timestamp: '2026-04-18 13:20:00', user: 'Olu Adeyemi',       role: 'pharm_ops',   action: 'Payout Processed', detail: 'Week 16 — 6 riders — ₦216,000 total',   ip: '197.210.55.8' },
]
