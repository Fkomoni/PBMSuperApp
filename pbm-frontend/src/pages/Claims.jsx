import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, Pill, fmtMoney, fmtDate } from '../components/ui'

const STATUS_KIND = { Paid: 'success', Pending: 'warn', Rejected: 'danger', Submitted: 'default' }

export default function Claims({ setToast }) {
  const [claims, setClaims]     = useState([])
  const [tab, setTab]           = useState('all')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(new Set())

  useEffect(() => {
    fetch(API_BASE + '/api/claims', { credentials: 'include' })
      .then(r => r.json()).then(d => { setClaims(d); setLoading(false) }).catch(() => {
        // fallback mock
        setClaims(MOCK_CLAIMS)
        setLoading(false)
      })
  }, [])

  const submitClaim = async (id) => {
    setSubmitting(s => new Set([...s, id]))
    await new Promise(r => setTimeout(r, 800))
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: 'Submitted' } : c))
    setSubmitting(s => { const n = new Set(s); n.delete(id); return n })
    setToast('Claim submitted to HMO API')
  }

  const filtered = claims.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.member_name.toLowerCase().includes(q) || c.plan_id.toLowerCase().includes(q)
    const matchT = tab === 'all' || c.status === tab
    return matchQ && matchT
  })

  const totalValue = claims.reduce((s, c) => s + (c.amount || 0), 0)
  const paidValue  = claims.filter(c => c.status === 'Paid').reduce((s, c) => s + (c.amount || 0), 0)

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Claims',  value: claims.length,                                   color: '#2563EB' },
          { label: 'Total Value',   value: fmtMoney(totalValue),                            color: 'var(--lw-charcoal)' },
          { label: 'Paid',          value: fmtMoney(paidValue),                             color: 'var(--s-success)' },
          { label: 'Pending / Sub', value: claims.filter(c => ['Pending','Submitted'].includes(c.status)).length, color: 'var(--s-warn)' },
        ].map(t => (
          <div key={t.label} style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--lw-grey-line)', background: '#fff' }}>
            <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{t.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search member or plan ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {['all', 'Pending', 'Submitted', 'Paid', 'Rejected'].map(s => (
            <button key={s} className={`seg__btn${tab === s ? ' is-active' : ''}`} onClick={() => setTab(s)}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Member</th>
              <th>Plan ID</th>
              <th>Service Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={c.member_name} size={26} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{c.member_name}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.plan_id}</td>
                <td style={{ fontSize: 12.5 }}>{fmtDate(c.service_date)}</td>
                <td style={{ fontSize: 12.5 }}>{c.type}</td>
                <td style={{ fontWeight: 700, fontSize: 13 }}>{fmtMoney(c.amount)}</td>
                <td><Pill kind={STATUS_KIND[c.status] || 'default'}>{c.status}</Pill></td>
                <td>
                  {c.status === 'Pending' && (
                    <button className="btn btn--primary btn--sm" onClick={() => submitClaim(c.id)} disabled={submitting.has(c.id)}>
                      {submitting.has(c.id) ? <Icon name="loader-circle" size={13} /> : <Icon name="send" size={13} />}
                      {submitting.has(c.id) ? 'Sending…' : 'Submit'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No claims found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const MOCK_CLAIMS = [
  { id: 'CLM-2026-001', member_name: 'Amina Bello',       plan_id: 'LH-LG-0001', service_date: '2026-04-01', type: 'Chronic Refill',  amount: 42500,  status: 'Paid' },
  { id: 'CLM-2026-002', member_name: 'Emeka Nwosu',        plan_id: 'LH-LG-0005', service_date: '2026-04-02', type: 'Chronic Refill',  amount: 38200,  status: 'Paid' },
  { id: 'CLM-2026-003', member_name: 'Ngozi Adeyemi',      plan_id: 'LH-LG-0009', service_date: '2026-04-03', type: 'Acute Episode',   amount: 156000, status: 'Submitted' },
  { id: 'CLM-2026-004', member_name: 'Taiwo Ogundimu',     plan_id: 'LH-LG-0013', service_date: '2026-04-05', type: 'Chronic Refill',  amount: 52700,  status: 'Pending' },
  { id: 'CLM-2026-005', member_name: 'Fatima Al-Hassan',   plan_id: 'LH-AB-0034', service_date: '2026-04-06', type: 'Specialist Rx',   amount: 89400,  status: 'Paid' },
  { id: 'CLM-2026-006', member_name: 'Chukwuemeka Obi',    plan_id: 'LH-NW-0089', service_date: '2026-04-07', type: 'Chronic Refill',  amount: 34800,  status: 'Rejected' },
  { id: 'CLM-2026-007', member_name: 'Adaeze Nwosu',       plan_id: 'LH-LG-0012', service_date: '2026-04-08', type: 'Chronic Refill',  amount: 61200,  status: 'Pending' },
  { id: 'CLM-2026-008', member_name: 'Babatunde Adeyemi',  plan_id: 'LH-LG-0021', service_date: '2026-04-10', type: 'Acute Episode',   amount: 245000, status: 'Submitted' },
  { id: 'CLM-2026-009', member_name: 'Ngozi Eze',           plan_id: 'LH-PH-0076', service_date: '2026-04-11', type: 'Chronic Refill',  amount: 28600,  status: 'Paid' },
  { id: 'CLM-2026-010', member_name: 'Mohammed Garba',     plan_id: 'LH-KN-0041', service_date: '2026-04-12', type: 'Chronic Refill',  amount: 44100,  status: 'Pending' },
]
