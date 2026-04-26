import { useState, useEffect } from 'react'
import { Icon, Avatar, StatusPill, Pill, Modal, fmtDate, fmtMoney, daysBetween } from '../components/ui'

const TODAY = new Date('2026-04-18')

const STATUS_ORDER = ['Awaiting Pack', 'Packing', 'Packed', 'Assigned', 'Out for Delivery', 'Delivered', 'Incomplete']
const COHORT_OPTS  = ['all', 'diabetes', 'hypertension', 'cardio', 'asthma', 'renal', 'thyroid', 'arthritis']

function MedRow({ med, onPause, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--lw-grey-line-2)', fontSize: 13 }}>
      <div style={{ flex: 2, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{med.name}</div>
      <div style={{ flex: 1, color: 'var(--lw-muted)' }}>{med.dosage}</div>
      <div style={{ flex: 1, color: 'var(--lw-muted)' }}>{med.frequency}</div>
      <div style={{ flex: 1 }}>
        <Pill kind={med.paused ? 'warn' : 'success'}>{med.paused ? 'Paused' : 'Active'}</Pill>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => onPause(med.id)}>
          <Icon name={med.paused ? 'play' : 'pause'} size={13} />
        </button>
        <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-danger)' }} onClick={() => onDelete(med.id)}>
          <Icon name="trash-2" size={13} />
        </button>
      </div>
    </div>
  )
}

function EnrolleeDrawer({ enrollee, onClose, setToast }) {
  const [tab, setTab]     = useState('overview')
  const [meds, setMeds]   = useState(enrollee.medications || [])
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(enrollee.comments || [])

  const days = daysBetween(TODAY, enrollee.next_refill)

  const pauseMed  = (id) => setMeds(m => m.map(x => x.id === id ? { ...x, paused: !x.paused } : x))
  const deleteMed = (id) => { if (confirm('Remove this medication from the plan?')) setMeds(m => m.filter(x => x.id !== id)) }

  const addComment = () => {
    if (!comment.trim()) return
    setComments(c => [...c, { id: Date.now(), text: comment, by: 'You', at: 'just now' }])
    setComment('')
    setToast('Comment added')
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          <Avatar name={enrollee.name} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lw-charcoal)' }}>{enrollee.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{enrollee.plan_id} · {enrollee.diagnosis} · {enrollee.state}</div>
          </div>
          <StatusPill status={enrollee.status} />
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          {['overview', 'medications', 'comments', 'audit'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Phone', enrollee.phone],
                  ['Email', enrollee.email],
                  ['Plan', enrollee.plan],
                  ['Scheme', enrollee.scheme],
                  ['DOB', fmtDate(enrollee.dob)],
                  ['Gender', enrollee.gender],
                  ['Address', enrollee.address],
                  ['State', enrollee.state],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 14px', background: days <= 3 ? 'var(--s-danger-bg)' : days <= 7 ? 'var(--s-warn-bg)' : 'var(--s-success-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Next refill</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: days <= 3 ? 'var(--s-danger)' : days <= 7 ? 'var(--s-warn)' : 'var(--s-success)' }}>
                  {fmtDate(enrollee.next_refill)} · in {days} days
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[['Adherence', `${enrollee.adherence}%`], ['Copay', fmtMoney(enrollee.copay)], ['Benefit Cap', fmtMoney(enrollee.benefit_cap)]].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', border: '1px solid var(--lw-grey-line)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lw-charcoal)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'medications' && (
            <div>
              <div style={{ display: 'flex', fontSize: 11.5, color: 'var(--lw-muted)', fontWeight: 700, padding: '0 0 8px', gap: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span style={{ flex: 2 }}>Drug</span>
                <span style={{ flex: 1 }}>Dosage</span>
                <span style={{ flex: 1 }}>Frequency</span>
                <span style={{ flex: 1 }}>Status</span>
                <span style={{ width: 70 }}></span>
              </div>
              {meds.map(m => (
                <MedRow key={m.id} med={m} onPause={pauseMed} onDelete={deleteMed} />
              ))}
              {meds.length === 0 && <div style={{ color: 'var(--lw-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No medications on file.</div>}
            </div>
          )}

          {tab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comments.map(c => (
                <div key={c.id} style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--lw-charcoal)' }}>{c.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 4 }}>{c.by} · {c.at}</div>
                </div>
              ))}
              {comments.length === 0 && <div style={{ color: 'var(--lw-muted)', fontSize: 13 }}>No comments yet.</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="input" style={{ flex: 1 }} value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Add a note…" onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button className="btn btn--primary btn--sm" onClick={addComment}>Post</button>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(enrollee.audit_log || []).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, paddingLeft: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lw-red)', marginTop: 4 }} />
                    {i < (enrollee.audit_log.length - 1) && <div style={{ width: 1, flex: 1, background: 'var(--lw-grey-line)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{ev.action}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{ev.by} · {ev.at}</div>
                  </div>
                </div>
              ))}
              {(!enrollee.audit_log || enrollee.audit_log.length === 0) && (
                <div style={{ color: 'var(--lw-muted)', fontSize: 13 }}>No audit events.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Enrollees({ region, setToast }) {
  const [data, setData]       = useState([])
  const [search, setSearch]   = useState('')
  const [cohort, setCohort]   = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch(`/api/enrollees?region=${region}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [region])

  const filtered = data.filter(e => {
    const q = search.toLowerCase()
    const matchQ = !q || e.name.toLowerCase().includes(q) || e.plan_id.toLowerCase().includes(q) || e.diagnosis.toLowerCase().includes(q)
    const matchC = cohort === 'all' || e.cohort === cohort
    const matchS = statusF === 'all' || e.status === statusF
    return matchQ && matchC && matchS
  })

  const uniqueStatuses = ['all', ...new Set(data.map(e => e.status))]

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search name, plan ID, diagnosis…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={cohort} onChange={e => setCohort(e.target.value)}>
          {COHORT_OPTS.map(c => <option key={c} value={c}>{c === 'all' ? 'All cohorts' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select className="input" style={{ width: 180 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} members</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan ID</th>
              <th>Diagnosis</th>
              <th>State</th>
              <th>Next Refill</th>
              <th>Adherence</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const days = daysBetween(TODAY, e.next_refill)
              return (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
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
                  <td style={{ textTransform: 'capitalize' }}>{e.diagnosis}</td>
                  <td>{e.state}</td>
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: days <= 3 ? 'var(--s-danger)' : days <= 7 ? 'var(--s-warn)' : 'var(--lw-ink)' }}>
                      {fmtDate(e.next_refill)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>in {days}d</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="prog" style={{ width: 60 }}>
                        <div style={{ width: `${e.adherence}%`, background: e.adherence >= 85 ? 'var(--s-success)' : e.adherence >= 70 ? 'var(--s-warn)' : 'var(--s-danger)' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{e.adherence}%</span>
                    </div>
                  </td>
                  <td><StatusPill status={e.status} /></td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={ev => { ev.stopPropagation(); setSelected(e) }}>
                      <Icon name="chevron-right" size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No enrollees match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <EnrolleeDrawer enrollee={selected} onClose={() => setSelected(null)} setToast={msg => setToast(msg)} />}
    </div>
  )
}
