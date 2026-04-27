import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, Pill, fmtDate } from '../components/ui'

const TYPE_ICON = {
  new_enrollment:    'user-round-plus',
  plan_upgrade:      'shield-plus',
  address_change:    'map-pin-plus',
  medication_change: 'pill',
}

const TYPE_LABEL = {
  new_enrollment:    'New Enrollment',
  plan_upgrade:      'Plan Upgrade',
  address_change:    'Address Change',
  medication_change: 'Medication Change',
}

const SUBTYPE_LABEL = {
  drug_stoppage:     'Drug Stoppage',
  new_medication:    'New Medication',
  dosage_change:     'Dosage Change',
  frequency_change:  'Frequency Change',
  brand_change:      'Brand Change',
}

export default function MemberRequests({ setToast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [note, setNote]         = useState('')
  const [deciding, setDeciding] = useState(false)
  const [filter, setFilter]     = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    fetch(API_BASE + '/api/member-requests', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setRequests(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const decide = async (decision) => {
    if (!note.trim() || note.trim().length < 5) {
      setToast('Decision note must be at least 5 characters', 'error')
      return
    }
    setDeciding(true)
    try {
      const res = await fetch(API_BASE + `/api/member-requests/${selected.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision, note }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRequests(prev => prev.map(r => r.id === selected.id ? data.request : r))
      setToast(`Request ${decision.toLowerCase()} — ${selected.enrollee_name}`)
      setSelected(null)
      setNote('')
    } catch {
      setToast('Action failed — try again', 'error')
    } finally {
      setDeciding(false)
    }
  }

  const types = ['all', ...Object.keys(TYPE_LABEL)]

  const filtered = requests.filter(r => {
    const matchF = filter === 'all' || r.status === filter
    const matchT = typeFilter === 'all' || r.request_type === typeFilter
    return matchF && matchT
  })

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="seg">
          {['all', 'Pending', 'Approved', 'Rejected'].map(s => (
            <button key={s} className={`seg__btn${filter === s ? ' is-active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'All' : s}
              {s === 'Pending' && (
                <span style={{ marginLeft: 4, background: 'var(--lw-red)', color: '#fff', borderRadius: '50%', fontSize: 10, padding: '1px 5px' }}>
                  {requests.filter(r => r.status === 'Pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
        <select className="input" style={{ width: 180 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} requests</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => {
          const typeLabel = TYPE_LABEL[r.request_type] || r.request_type
          const subtypeLabel = r.medication_subtype ? SUBTYPE_LABEL[r.medication_subtype] || r.medication_subtype : null
          return (
            <div key={r.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer',
                       opacity: r.status !== 'Pending' ? 0.7 : 1 }}
              onClick={() => { setSelected(r); setNote('') }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--lw-grey-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={TYPE_ICON[r.request_type] || 'file-text'} size={18} style={{ color: 'var(--lw-red)' }} />
              </div>
              <Avatar name={r.enrollee_name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--lw-charcoal)' }}>{r.enrollee_name}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--lw-muted)' }}>{r.policy_no}</span>
                  {r.region && <span style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{r.region}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }} className="truncate">
                  {r.member_note}
                </div>
                {subtypeLabel && (
                  <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginTop: 2 }}>
                    {subtypeLabel}{r.requested_drug ? `: ${r.requested_drug}` : ''}
                    {r.requested_dosage ? ` · ${r.requested_dosage}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                  <Pill kind="default" style={{ fontSize: 11 }}>{typeLabel}</Pill>
                  <Pill kind={r.urgency === 'High' ? 'danger' : r.urgency === 'Medium' ? 'warn' : 'success'}>{r.urgency}</Pill>
                </div>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{fmtDate(r.submitted_at)}</div>
                <Pill kind={r.status === 'Pending' ? 'warn' : r.status === 'Approved' ? 'success' : 'danger'} style={{ marginTop: 4 }}>
                  {r.status}
                </Pill>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--lw-muted)' }}>
            <Icon name="check-circle-2" size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>No requests match this filter.</div>
          </div>
        )}
      </div>

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Avatar name={selected.enrollee_name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)' }}>{selected.enrollee_name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>
                  {selected.policy_no} · {TYPE_LABEL[selected.request_type] || selected.request_type}
                </div>
              </div>
              <button className="top__icon-btn" onClick={() => setSelected(null)}><Icon name="x" size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Member note */}
              <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Member's note</div>
                <div style={{ fontSize: 13, color: 'var(--lw-charcoal)', lineHeight: 1.5 }}>{selected.member_note}</div>
              </div>

              {/* Medication change details */}
              {selected.medication_subtype && (
                <div style={{ padding: '12px 14px', background: '#F0F9FF', borderRadius: 10, border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 6 }}>Medication Change Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
                    <div><span style={{ color: 'var(--lw-muted)' }}>Subtype:</span> <strong>{SUBTYPE_LABEL[selected.medication_subtype] || selected.medication_subtype}</strong></div>
                    {selected.current_drug && <div><span style={{ color: 'var(--lw-muted)' }}>Current drug:</span> {selected.current_drug}</div>}
                    {selected.requested_drug && <div><span style={{ color: 'var(--lw-muted)' }}>Requested drug:</span> {selected.requested_drug}</div>}
                    {selected.current_dosage && <div><span style={{ color: 'var(--lw-muted)' }}>Current dosage:</span> {selected.current_dosage}</div>}
                    {selected.requested_dosage && <div><span style={{ color: 'var(--lw-muted)' }}>Requested dosage:</span> {selected.requested_dosage}</div>}
                    {selected.current_frequency && <div><span style={{ color: 'var(--lw-muted)' }}>Current freq:</span> {selected.current_frequency}</div>}
                    {selected.requested_frequency && <div><span style={{ color: 'var(--lw-muted)' }}>Requested freq:</span> {selected.requested_frequency}</div>}
                  </div>
                </div>
              )}

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Submitted', fmtDate(selected.submitted_at)],
                  ['Urgency', selected.urgency],
                  ['Status', selected.status],
                  ['Region', selected.region],
                  ['Type', TYPE_LABEL[selected.request_type] || selected.request_type],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '9px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Decision info if already decided */}
              {selected.status !== 'Pending' && selected.decided_by && (
                <div style={{ padding: '12px 14px', background: selected.status === 'Approved' ? 'var(--s-success-bg)' : 'var(--s-danger-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Decision by {selected.decided_by}</div>
                  <div style={{ fontSize: 13, color: 'var(--lw-charcoal)' }}>{selected.decision_note}</div>
                </div>
              )}

              {/* Decision note input — only if pending */}
              {selected.status === 'Pending' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', display: 'block', marginBottom: 6 }}>Decision note (required)</label>
                  <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Add reason or context (min 5 chars)…" style={{ resize: 'vertical' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelected(null)}>Close</button>
              {selected.status === 'Pending' && (
                <>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-danger)', borderColor: 'rgba(198,21,49,.3)' }}
                    onClick={() => decide('Rejected')} disabled={deciding}>
                    <Icon name="x-circle" size={14} /> Reject
                  </button>
                  <button className="btn btn--primary" onClick={() => decide('Approved')} disabled={deciding}>
                    {deciding ? <Icon name="loader-circle" size={14} /> : <Icon name="check-circle" size={14} />}
                    {deciding ? 'Saving…' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
