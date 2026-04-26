import { useState, useEffect } from 'react'
import { Icon, Avatar, StatusPill, Pill, fmtDate } from '../components/ui'

const TODAY_STR = '2026-04-18'

// Simulated past assignments so the date filter has something to filter against
const PAST_ASSIGNMENTS = [
  { id: 9901, name: 'Halima Musa',       plan_id: 'LH-KN-0055', diagnosis: 'thyroid',       state: 'Kano',          status: 'Assigned', next_refill: '2026-04-25', assigned_date: '2026-04-11', rider: 'Yusuf Danjuma' },
  { id: 9902, name: 'Seun Adeleke',      plan_id: 'LH-LG-0067', diagnosis: 'hypertension',  state: 'Lagos',         status: 'Assigned', next_refill: '2026-04-27', assigned_date: '2026-04-12', rider: 'Musa Abdullahi' },
  { id: 9903, name: 'Emeka Eze',         plan_id: 'LH-EN-NEW',  diagnosis: 'cardio',        state: 'Enugu',         status: 'Assigned', next_refill: '2026-04-20', assigned_date: '2026-04-14', rider: 'Chidi Okafor' },
  { id: 9904, name: 'Adeola Ogunyemi',   plan_id: 'LH-LG-0088', diagnosis: 'diabetes',      state: 'Lagos',         status: 'Assigned', next_refill: '2026-04-22', assigned_date: '2026-04-15', rider: 'Emeka Obi' },
  { id: 9905, name: 'Mohammed Garba',    plan_id: 'LH-KN-0041', diagnosis: 'hypertension',  state: 'Kano',          status: 'Assigned', next_refill: '2026-04-30', assigned_date: '2026-04-16', rider: 'Yusuf Danjuma' },
]

const DATE_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This week' },
  { key: 'all',     label: 'All dates' },
  { key: 'custom',  label: 'Custom date' },
]

function inWindow(dateStr, key, customDate) {
  if (key === 'all') return true
  if (key === 'custom') return dateStr === customDate
  const d = new Date(dateStr)
  const today = new Date(TODAY_STR)
  if (key === 'today') return dateStr === TODAY_STR
  if (key === 'week') {
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6)
    return d >= weekAgo && d <= today
  }
  return true
}

export default function Logistics({ setToast }) {
  const [enrollees, setEnrollees]     = useState([])
  const [riders, setRiders]           = useState([])
  const [assignments, setAssignments] = useState({})
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(null)
  const [dateFilter, setDateFilter]   = useState('today')
  const [customDate, setCustomDate]   = useState(TODAY_STR)
  const [showHistory, setShowHistory] = useState(false)
  const [historyDate, setHistoryDate] = useState('all')
  const [historyCustom, setHistoryCustom] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    Promise.all([
      fetch('/api/enrollees?region=lagos',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/enrollees?region=outside', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/riders',                   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([l, o, rd]) => {
      const assignable = [...l, ...o]
        .filter(e => e.status === 'Packed' || e.status === 'Assigned')
        .map(e => ({ ...e, assigned_date: TODAY_STR }))
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
    setEnrollees(prev => prev.map(e => e.id === enrolleeId ? { ...e, status: 'Assigned', assigned_rider: rider?.name } : e))
    setToast(`Order assigned to ${rider?.name}`)
    setSaving(null)
  }

  const pendingList = enrollees.filter(e => e.status === 'Packed')
  const assignedToday = enrollees.filter(e => e.status === 'Assigned' && e.assigned_date === TODAY_STR)

  const historyItems = PAST_ASSIGNMENTS.filter(a =>
    historyDate === 'all' || (historyDate === 'custom' ? a.assigned_date === historyCustom : inWindow(a.assigned_date, historyDate, historyCustom))
  )

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">

      {/* ── Pending assignments ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--lw-charcoal)' }}>Pending Assignment</h3>
          <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>{pendingList.length} packed order{pendingList.length !== 1 ? 's' : ''} awaiting a rider</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {pendingList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--lw-muted)' }}>
            <Icon name="route" size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No packed orders awaiting assignment.</div>
          </div>
        ) : (
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
              {pendingList.map(e => (
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
                    <select className="input" style={{ fontSize: 12, width: 185 }}
                      value={assignments[e.id] || ''}
                      onChange={ev => setAssignments(a => ({ ...a, [e.id]: ev.target.value }))}>
                      <option value="">— select rider —</option>
                      {riders.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.zone})</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn--primary btn--sm"
                      disabled={!assignments[e.id] || saving === e.id}
                      onClick={() => assign(e.id)}>
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

      {/* ── Assigned today ──────────────────────────────────── */}
      {assignedToday.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 8 }}>
            Assigned today ({assignedToday.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 10 }}>
            {assignedToday.map(e => (
              <div key={e.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Avatar name={e.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }} className="truncate">{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{e.plan_id}</div>
                  </div>
                  <Pill kind="success">Assigned</Pill>
                </div>
                <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>
                  <Icon name="bike" size={11} style={{ marginRight: 4 }} />
                  {e.assigned_rider || assignments[e.id] ? riders.find(r => r.id === parseInt(assignments[e.id]))?.name || e.assigned_rider || '—' : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assignment history with date filter ─────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--lw-charcoal)' }}>Assignment History</h3>
            <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>Past rider assignments — filter by date</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowHistory(v => !v)}>
            <Icon name={showHistory ? 'chevron-up' : 'chevron-down'} size={13} />
            {showHistory ? 'Hide' : 'Show history'}
          </button>
        </div>

        {showHistory && (
          <>
            {/* Date filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="seg">
                {DATE_FILTERS.map(df => (
                  <button key={df.key} className={`seg__btn${historyDate === df.key ? ' is-active' : ''}`}
                    onClick={() => setHistoryDate(df.key)}>{df.label}</button>
                ))}
              </div>
              {historyDate === 'custom' && (
                <input type="date" className="input" style={{ width: 160, fontSize: 12 }}
                  value={historyCustom} onChange={e => setHistoryCustom(e.target.value)} />
              )}
              <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{historyItems.length} record{historyItems.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Plan ID</th>
                    <th>Diagnosis</th>
                    <th>State</th>
                    <th>Assigned Date</th>
                    <th>Rider</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={a.name} size={26} />
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{a.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.plan_id}</td>
                      <td style={{ textTransform: 'capitalize', fontSize: 12.5 }}>{a.diagnosis}</td>
                      <td style={{ fontSize: 12.5 }}>{a.state}</td>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDate(a.assigned_date)}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>
                          {a.assigned_date === TODAY_STR ? 'Today' : a.assigned_date === '2026-04-17' ? 'Yesterday' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="bike" size={12} style={{ color: 'var(--lw-muted)' }} />
                          {a.rider}
                        </div>
                      </td>
                      <td><StatusPill status={a.status} /></td>
                    </tr>
                  ))}
                  {historyItems.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 28 }}>
                        No assignments found for the selected date filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Active rider summary ─────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Active Riders</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {riders.map(r => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Avatar name={r.name} size={28} />
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
