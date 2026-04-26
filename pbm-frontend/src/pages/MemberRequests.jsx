import { useState } from 'react'
import { Icon, Avatar, Pill, fmtDate } from '../components/ui'

const MOCK_REQUESTS = [
  { id: 'MR-001', name: 'Chiamaka Uzor',    plan_id: 'LH-OS-NEW',  type: 'New Enrollment',    submitted: '2026-04-18', note: 'Employer: MTN Group. Gold Plus plan requested.', urgency: 'Medium', status: 'Pending' },
  { id: 'MR-002', name: 'Babajide Ogunleye', plan_id: 'LH-LG-0092', type: 'Plan Upgrade',      submitted: '2026-04-18', note: 'Requesting upgrade from Silver to Gold. Insulin added to diagnosis.', urgency: 'Low', status: 'Pending' },
  { id: 'MR-003', name: 'Halima Musa',       plan_id: 'LH-KN-0055', type: 'Address Change',    submitted: '2026-04-17', note: 'Relocated from Kano to Abuja. New address: 14 Garki Estate.', urgency: 'Low', status: 'Pending' },
  { id: 'MR-004', name: 'Emeka Eze',         plan_id: 'LH-EN-NEW',  type: 'New Enrollment',    submitted: '2026-04-17', note: 'Individual plan. Hypertension. Requests Chronic Lagos delivery.', urgency: 'High', status: 'Pending' },
  { id: 'MR-005', name: 'Adeola Ogunyemi',   plan_id: 'LH-LG-0088', type: 'Medication Change', submitted: '2026-04-16', note: 'Dr Adewale prescribing Amlodipine 10mg instead of 5mg. Specialist letter attached.', urgency: 'Medium', status: 'Under Review' },
]

const TYPE_ICON = {
  'New Enrollment':    'user-round-plus',
  'Plan Upgrade':      'shield-plus',
  'Address Change':    'map-pin-plus',
  'Medication Change': 'pill',
}

export default function MemberRequests({ setToast }) {
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [selected, setSelected] = useState(null)
  const [note, setNote]         = useState('')
  const [filter, setFilter]     = useState('all')

  const act = (id, action) => {
    setRequests(prev => prev.filter(r => r.id !== id))
    setToast(`Request ${action === 'approve' ? 'approved' : 'rejected'} — ${selected?.name}`)
    setSelected(null)
    setNote('')
  }

  const review = (id) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Under Review' } : r))
    setToast('Marked as under review')
  }

  const types = ['all', ...new Set(MOCK_REQUESTS.map(r => r.type))]
  const filtered = requests.filter(r => filter === 'all' || r.type === filter)

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="seg">
          {types.map(t => (
            <button key={t} className={`seg__btn${filter === t ? ' is-active' : ''}`} onClick={() => setFilter(t)}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} pending</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }} onClick={() => { setSelected(r); setNote('') }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--lw-grey-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={TYPE_ICON[r.type] || 'file-text'} size={18} style={{ color: 'var(--lw-red)' }} />
            </div>
            <Avatar name={r.name} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--lw-charcoal)' }}>{r.name}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--lw-muted)' }}>{r.plan_id}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }} className="truncate">{r.note}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                <Pill kind="default" style={{ fontSize: 11 }}>{r.type}</Pill>
                <Pill kind={r.urgency === 'High' ? 'danger' : r.urgency === 'Medium' ? 'warn' : 'success'}>{r.urgency}</Pill>
              </div>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{fmtDate(r.submitted)}</div>
              <Pill kind={r.status === 'Under Review' ? 'warn' : 'default'} style={{ marginTop: 4 }}>{r.status}</Pill>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--lw-muted)' }}>
            <Icon name="check-circle-2" size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>All member requests processed.</div>
          </div>
        )}
      </div>

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Avatar name={selected.name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)' }}>{selected.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{selected.plan_id} · {selected.type}</div>
              </div>
              <button className="top__icon-btn" onClick={() => setSelected(null)}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Member's note</div>
                <div style={{ fontSize: 13, color: 'var(--lw-charcoal)', lineHeight: 1.5 }}>{selected.note}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Submitted', fmtDate(selected.submitted)], ['Urgency', selected.urgency], ['Status', selected.status], ['Type', selected.type]].map(([l, v]) => (
                  <div key={l} style={{ padding: '9px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', display: 'block', marginBottom: 6 }}>Decision note</label>
                <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Add context or reason…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
              {selected.status !== 'Under Review' && (
                <button className="btn btn--ghost btn--sm" onClick={() => { review(selected.id); setSelected(null) }}>
                  <Icon name="clock" size={13} /> Mark reviewing
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-danger)', borderColor: 'rgba(198,21,49,.3)' }} onClick={() => act(selected.id, 'reject')}>
                <Icon name="x-circle" size={14} /> Reject
              </button>
              <button className="btn btn--primary" onClick={() => act(selected.id, 'approve')}>
                <Icon name="check-circle" size={14} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
