import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, StatusPill, Pill, fmtDate, fmtMoney, daysBetween } from '../components/ui'

const TODAY = new Date('2026-04-18')
const COHORT_OPTS = ['all', 'diabetes', 'hypertension', 'cardio', 'asthma', 'renal', 'thyroid', 'arthritis']

// ── Inline-editable medication row ────────────────────────────────────────────
function MedRow({ med, onUpdate, onPause, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ ...med })
  const total = (draft.qty || 0) * (draft.unit_price || 0)
  const f = k => e => setDraft(d => ({ ...d, [k]: e.target.value }))

  const save = () => { onUpdate(med.id, draft); setEditing(false) }
  const cancel = () => { setDraft({ ...med }); setEditing(false) }

  if (editing) {
    return (
      <div style={{ background: 'var(--lw-grey-bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lw-muted)', fontWeight: 700 }}>Drug (brand)</label>
            <input className="input" style={{ fontSize: 12 }} value={draft.name} onChange={f('name')} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lw-muted)', fontWeight: 700 }}>Dosage</label>
            <input className="input" style={{ fontSize: 12 }} value={draft.dosage} onChange={f('dosage')} placeholder="e.g. 500mg" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lw-muted)', fontWeight: 700 }}>Qty (units)</label>
            <input className="input" type="number" style={{ fontSize: 12 }} value={draft.qty} onChange={f('qty')} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lw-muted)', fontWeight: 700 }}>Unit price (₦)</label>
            <input className="input" type="number" style={{ fontSize: 12 }} value={draft.unit_price} onChange={f('unit_price')} />
          </div>
        </div>
        <div className="field" style={{ margin: '0 0 10px' }}>
          <label style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lw-muted)', fontWeight: 700 }}>Generic / frequency</label>
          <input className="input" style={{ fontSize: 12 }} value={draft.frequency} onChange={f('frequency')} placeholder="e.g. Twice daily" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: 'var(--lw-muted)', marginRight: 'auto' }}>
            Total: <strong style={{ color: 'var(--lw-charcoal)' }}>{fmtMoney((draft.qty || 0) * (draft.unit_price || 0))}</strong>
          </span>
          <button className="btn btn--ghost btn--sm" onClick={cancel}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={save}>Save</button>
        </div>
      </div>
    )
  }

  const rowTotal = (med.qty || 60) * (med.unit_price || 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 90px 80px 80px', alignItems: 'center', gap: 8, padding: '11px 0', borderBottom: '1px solid var(--lw-grey-line-2)', fontSize: 13 }}>
      {/* Drug */}
      <div>
        <div style={{ fontWeight: 700, color: 'var(--lw-charcoal)' }}>{med.name}</div>
        <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 1 }}>{med.frequency}</div>
      </div>
      {/* Qty */}
      <div style={{ fontSize: 12.5, color: 'var(--lw-ink)' }}>
        {med.qty || 60}<br />
        <span style={{ fontSize: 10.5, color: 'var(--lw-muted)' }}>{med.dosage}</span>
      </div>
      {/* Price */}
      <div style={{ fontSize: 12.5 }}>{fmtMoney(med.unit_price || 0)}</div>
      {/* Total */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lw-charcoal)' }}>{fmtMoney(rowTotal)}</div>
      {/* Status */}
      <div>
        <Pill kind={med.paused ? 'warn' : 'success'}>{med.paused ? 'Paused' : 'Active'}</Pill>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn--ghost btn--sm" style={{ padding: '4px 7px' }} title="Edit" onClick={() => setEditing(true)}>
          <Icon name="pencil" size={12} />
        </button>
        <button className="btn btn--ghost btn--sm" style={{ padding: '4px 7px' }} title={med.paused ? 'Resume' : 'Pause'} onClick={() => onPause(med.id)}>
          <Icon name={med.paused ? 'play' : 'pause'} size={12} />
        </button>
        <button className="btn btn--ghost btn--sm" style={{ padding: '4px 7px', color: 'var(--s-danger)' }} title="Remove" onClick={() => onDelete(med.id)}>
          <Icon name="trash-2" size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Enrollee drawer ────────────────────────────────────────────────────────────
function EnrolleeDrawer({ enrollee, onClose, setToast }) {
  const [tab, setTab]           = useState('overview')
  const [meds, setMeds]         = useState(
    (enrollee.medications || []).map((m, i) => ({
      qty: 60, unit_price: 2400 + i * 800, ...m,
    }))
  )
  const [chronicLimit, setChronicLimit] = useState(enrollee.benefit_cap || 500000)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitDraft, setLimitDraft]     = useState(chronicLimit)
  const [comment, setComment]   = useState('')
  const [comments, setComments] = useState(enrollee.comments || [])

  const days = daysBetween(TODAY, enrollee.next_refill)

  const activeMeds  = meds.filter(m => !m.paused)
  const medTotal    = meds.reduce((s, m) => s + (m.qty || 0) * (m.unit_price || 0), 0)
  const activeMedTotal = activeMeds.reduce((s, m) => s + (m.qty || 0) * (m.unit_price || 0), 0)
  const limitPct    = Math.min(100, Math.round((activeMedTotal / chronicLimit) * 100))
  const overLimit   = activeMedTotal > chronicLimit

  const updateMed = (id, data) => setMeds(prev => prev.map(m => m.id === id ? { ...m, ...data, qty: +data.qty, unit_price: +data.unit_price } : m))
  const pauseMed  = (id) => setMeds(m => m.map(x => x.id === id ? { ...x, paused: !x.paused } : x))
  const deleteMed = (id) => { if (confirm('Remove this medication from the plan?')) setMeds(m => m.filter(x => x.id !== id)) }

  const addComment = () => {
    if (!comment.trim()) return
    setComments(c => [...c, { id: Date.now(), text: comment, by: 'You', at: 'just now' }])
    setComment('')
    setToast('Comment added')
  }

  const saveLimit = () => {
    setChronicLimit(+limitDraft)
    setEditingLimit(false)
    setToast('Chronic limit updated')
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 580 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          <Avatar name={enrollee.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lw-charcoal)' }}>{enrollee.name}</div>
            <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 1 }}>
              {enrollee.plan_id} · {enrollee.diagnosis} · {enrollee.phone}
            </div>
          </div>
          <StatusPill status={enrollee.status} />
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          {['overview', 'medications', 'comments', 'audit'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>

          {/* ── Overview ─── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Phone', enrollee.phone], ['Email', enrollee.email],
                  ['Plan', enrollee.plan], ['Scheme', enrollee.scheme],
                  ['DOB', fmtDate(enrollee.dob)], ['Gender', enrollee.gender],
                  ['Address', enrollee.address], ['State', enrollee.state],
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

          {/* ── Medications ─── */}
          {tab === 'medications' && (
            <div>
              {/* Chronic limit widget */}
              <div style={{ padding: '12px 14px', background: overLimit ? 'var(--s-danger-bg)' : 'var(--lw-grey-bg)', borderRadius: 12, marginBottom: 14, border: `1px solid ${overLimit ? 'rgba(198,21,49,.25)' : 'var(--lw-grey-line)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Chronic limit</div>
                    {editingLimit ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <input className="input" type="number" value={limitDraft} onChange={e => setLimitDraft(e.target.value)}
                          style={{ width: 140, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && saveLimit()} />
                        <button className="btn btn--primary btn--sm" onClick={saveLimit}>Set</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingLimit(false)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: overLimit ? 'var(--s-danger)' : 'var(--lw-charcoal)' }}>{fmtMoney(chronicLimit)}</span>
                        <button className="btn btn--ghost btn--sm" style={{ padding: '2px 6px' }} onClick={() => { setLimitDraft(chronicLimit); setEditingLimit(true) }}>
                          <Icon name="pencil" size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Meds total (active)</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: overLimit ? 'var(--s-danger)' : 'var(--s-success)' }}>{fmtMoney(activeMedTotal)}</div>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: 'var(--lw-grey-line)' }}>
                  <div style={{ width: `${limitPct}%`, height: '100%', borderRadius: 6, background: overLimit ? 'var(--s-danger)' : limitPct > 80 ? 'var(--s-warn)' : 'var(--s-success)', transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--lw-muted)', marginTop: 4 }}>
                  <span>{limitPct}% of limit used</span>
                  {overLimit && <span style={{ color: 'var(--s-danger)', fontWeight: 700 }}>⚠ Exceeds limit by {fmtMoney(activeMedTotal - chronicLimit)}</span>}
                </div>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 90px 80px 80px', gap: 8, padding: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Drug</span><span>Qty</span><span>Price</span><span>Total</span><span>Status</span><span></span>
              </div>

              {meds.map(m => (
                <MedRow key={m.id} med={m} onUpdate={updateMed} onPause={pauseMed} onDelete={deleteMed} />
              ))}

              {meds.length === 0 && (
                <div style={{ color: 'var(--lw-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No medications on file.</div>
              )}

              {/* Grand total footer */}
              {meds.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>
                    {meds.length} drug{meds.length !== 1 ? 's' : ''} · {activeMeds.length} active
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Grand total (all meds)</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--lw-charcoal)' }}>{fmtMoney(medTotal)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Comments ─── */}
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

          {/* ── Audit ─── */}
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

        {/* Footer actions */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm"><Icon name="send" size={13} /> Message</button>
          <button className="btn btn--ghost btn--sm"><Icon name="calendar-clock" size={13} /> Build refill</button>
          <button className="btn btn--primary btn--sm"><Icon name="package" size={13} /> Start pack</button>
        </div>
      </div>
    </div>
  )
}

// ── Main list ──────────────────────────────────────────────────────────────────
export default function Enrollees({ region, setToast }) {
  const [data, setData]         = useState([])
  const [search, setSearch]     = useState('')
  const [cohort, setCohort]     = useState('all')
  const [statusF, setStatusF]   = useState('all')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch(API_BASE + `/api/enrollees?region=${region}`, { credentials: 'include' })
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
