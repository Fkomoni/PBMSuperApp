import { useState, useEffect } from 'react'
import { Icon, Avatar, StatusPill, Pill, fmtDate } from '../components/ui'

export default function CreateDeliveries({ setToast }) {
  const [enrollees, setEnrollees] = useState([])
  const [selected, setSelected]  = useState(new Set())
  const [search, setSearch]      = useState('')
  const [creating, setCreating]  = useState(false)
  const [loading, setLoading]    = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    Promise.all([
      fetch('/api/enrollees?region=lagos',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/enrollees?region=outside', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([l, o]) => {
      const packable = [...l, ...o].filter(e => e.status === 'Packed')
      setEnrollees(packable)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(e => e.id)))
  }

  const createDeliveries = async () => {
    if (selected.size === 0) return
    setCreating(true)
    await new Promise(r => setTimeout(r, 800))
    setEnrollees(prev => prev.filter(e => !selected.has(e.id)))
    setToast(`${selected.size} deliver${selected.size !== 1 ? 'ies' : 'y'} created and queued for rider assignment`)
    setSelected(new Set())
    setCreating(false)
  }

  const filtered = enrollees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.plan_id.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <Icon name="truck" size={18} />
        <div>Only <strong>Packed</strong> orders are shown. Select members to create delivery records and move them to the assignment queue.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search member or plan ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <button className="btn btn--primary" onClick={createDeliveries} disabled={creating}>
            {creating ? <Icon name="loader-circle" size={14} /> : <Icon name="truck" size={14} />}
            {creating ? 'Creating…' : `Create ${selected.size} deliver${selected.size !== 1 ? 'ies' : 'y'}`}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} style={{ cursor: 'pointer' }} />
              </th>
              <th>Member</th>
              <th>Plan ID</th>
              <th>Diagnosis</th>
              <th>State</th>
              <th>Next Refill</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ cursor: 'pointer', background: selected.has(e.id) ? 'rgba(37,99,235,.04)' : 'transparent' }}
                onClick={() => toggle(e.id)}>
                <td onClick={ev => ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} style={{ cursor: 'pointer' }} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={e.name} size={28} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{e.phone}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.plan_id}</td>
                <td style={{ textTransform: 'capitalize', fontSize: 12.5 }}>{e.diagnosis}</td>
                <td style={{ fontSize: 12.5 }}>{e.state}</td>
                <td style={{ fontSize: 12.5 }}>{fmtDate(e.next_refill)}</td>
                <td><StatusPill status={e.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>
                  No packed orders available for delivery creation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
