import { useState, useEffect } from 'react'
import { Icon, Avatar, Pill, fmtDate, daysBetween } from '../components/ui'

const TODAY = new Date('2026-04-18')

const WINDOWS = [
  { key: '7',  label: 'Next 7 days' },
  { key: '14', label: 'Next 14 days' },
  { key: '30', label: 'Next 30 days' },
]

function urgencyKind(days) {
  if (days <= 3) return 'danger'
  if (days <= 7) return 'warn'
  return 'success'
}

function RefillRow({ e, days, onSchedule }) {
  return (
    <tr>
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
      <td>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDate(e.next_refill)}</div>
      </td>
      <td>
        <Pill kind={urgencyKind(days)}>in {days}d</Pill>
      </td>
      <td style={{ fontSize: 13 }}>{e.adherence}%</td>
      <td>
        <button className="btn btn--primary btn--sm" onClick={() => onSchedule(e)}>
          <Icon name="package" size={12} /> Schedule pack
        </button>
      </td>
    </tr>
  )
}

export default function RefillPlanner({ setToast }) {
  const [enrollees, setEnrollees] = useState([])
  const [window, setWindow]       = useState('14')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [scheduled, setScheduled] = useState(new Set())

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    Promise.all([
      fetch('/api/enrollees?region=lagos', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/enrollees?region=outside', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([l, o]) => {
      setEnrollees([...l, ...o])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const days = parseInt(window, 10)

  const upcoming = enrollees
    .map(e => ({ e, d: daysBetween(TODAY, e.next_refill) }))
    .filter(({ d }) => d >= 0 && d <= days)
    .filter(({ e }) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.plan_id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.d - b.d)

  const scheduleAll = () => {
    const ids = new Set([...scheduled, ...upcoming.map(x => x.e.id)])
    setScheduled(ids)
    setToast(`${upcoming.length} refills scheduled for packing`)
  }

  const scheduleOne = (e) => {
    setScheduled(s => new Set([...s, e.id]))
    setToast(`${e.name}'s refill scheduled`)
  }

  const byUrgency = {
    danger: upcoming.filter(x => x.d <= 3),
    warn:   upcoming.filter(x => x.d > 3 && x.d <= 7),
    ok:     upcoming.filter(x => x.d > 7),
  }

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Critical (≤ 3 days)', count: byUrgency.danger.length, color: 'var(--s-danger)', bg: 'var(--s-danger-bg)', icon: 'alert-triangle' },
          { label: 'Upcoming (4–7 days)', count: byUrgency.warn.length,   color: 'var(--s-warn)',   bg: 'var(--s-warn-bg)',   icon: 'clock' },
          { label: 'Planned (8+ days)',   count: byUrgency.ok.length,     color: 'var(--s-success)',bg: 'var(--s-success-bg)',icon: 'calendar-check' },
        ].map(t => (
          <div key={t.label} style={{ padding: 16, borderRadius: 14, background: t.bg, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={t.icon} size={20} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.count}</div>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search member or plan ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {WINDOWS.map(w => (
            <button key={w.key} className={`seg__btn${window === w.key ? ' is-active' : ''}`} onClick={() => setWindow(w.key)}>{w.label}</button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={scheduleAll} disabled={upcoming.length === 0}>
          <Icon name="package" size={14} /> Schedule all ({upcoming.length})
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Diagnosis</th>
              <th>State</th>
              <th>Refill Date</th>
              <th>Days Left</th>
              <th>Adherence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map(({ e, d }) => (
              scheduled.has(e.id)
                ? (
                  <tr key={e.id} style={{ opacity: 0.5 }}>
                    <td colSpan={6}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <Avatar name={e.name} size={24} />
                        <span style={{ fontWeight: 600, color: 'var(--lw-charcoal)' }}>{e.name}</span>
                        <Pill kind="success"><Icon name="check" size={11} /> Scheduled</Pill>
                      </div>
                    </td>
                    <td />
                  </tr>
                ) : (
                  <RefillRow key={e.id} e={e} days={d} onSchedule={scheduleOne} />
                )
            ))}
            {upcoming.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No refills due in the selected window.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
