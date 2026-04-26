import { useState, useEffect } from 'react'
import { Icon, Avatar, StatusPill, Pill, fmtDate } from '../components/ui'

export default function Logistics({ setToast }) {
  const [enrollees, setEnrollees] = useState([])
  const [riders, setRiders]       = useState([])
  const [assignments, setAssignments] = useState({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    Promise.all([
      fetch('/api/enrollees?region=lagos',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/enrollees?region=outside', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/riders',                   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([l, o, rd]) => {
      const assignable = [...l, ...o].filter(e => e.status === 'Packed' || e.status === 'Assigned')
      setEnrollees(assignable)
      setRiders(rd.filter(r => r.active))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const assign = async (enrolleeId) => {
    const riderId = assignments[enrolleeId]
    if (!riderId) return
    setSaving(enrolleeId)
    await new Promise(r => setTimeout(r, 600))
    const rider = riders.find(r => r.id === parseInt(riderId, 10))
    setEnrollees(prev => prev.filter(e => e.id !== enrolleeId))
    setToast(`Order assigned to ${rider?.name}`)
    setSaving(null)
  }

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--lw-muted)' }}>
        {enrollees.length} packed order{enrollees.length !== 1 ? 's' : ''} awaiting rider assignment
      </div>

      {enrollees.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--lw-muted)' }}>
          <Icon name="route" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 15 }}>No orders awaiting assignment.</div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {enrollees.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Diagnosis</th>
                <th>State</th>
                <th>Refill Date</th>
                <th>Status</th>
                <th>Assign Rider</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrollees.map(e => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={e.name} size={28} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{e.plan_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', fontSize: 12.5 }}>{e.diagnosis}</td>
                  <td style={{ fontSize: 12.5 }}>{e.state}</td>
                  <td style={{ fontSize: 12.5 }}>{fmtDate(e.next_refill)}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td>
                    <select
                      className="input"
                      style={{ fontSize: 12, width: 180 }}
                      value={assignments[e.id] || ''}
                      onChange={ev => setAssignments(a => ({ ...a, [e.id]: ev.target.value }))}
                    >
                      <option value="">— select rider —</option>
                      {riders.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.zone})</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={!assignments[e.id] || saving === e.id}
                      onClick={() => assign(e.id)}
                    >
                      {saving === e.id ? <Icon name="loader-circle" size={13} /> : <Icon name="user-check" size={13} />}
                      {saving === e.id ? 'Assigning…' : 'Assign'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Active rider summary */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 12 }}>Active Riders Today</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {riders.map(r => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Avatar name={r.name} size={30} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{r.zone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <Pill kind="success">{r.deliveries} deliveries</Pill>
                <Pill kind="default">{r.rating}★</Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
