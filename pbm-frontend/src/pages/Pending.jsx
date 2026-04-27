import { useState, useEffect } from 'react'
import { Icon, Avatar, Pill, fmtDate, fmtMoney } from '../components/ui'

const MOCK_PENDING = [
  { id: 'PA001', type: 'New Enrollment', name: 'Chukwuemeka Obi',    plan_id: 'LH-NW-0089', amount: null,        submitted: '2026-04-17', note: 'Employer group — Zenith Bank staff', urgency: 'Medium' },
  { id: 'PA002', type: 'Drug Override',  name: 'Fatima Al-Hassan',   plan_id: 'LH-AB-0034', amount: 48500,       submitted: '2026-04-17', note: 'Requesting Januvia — formulary has Metformin', urgency: 'High' },
  { id: 'PA003', type: 'Benefit Extend', name: 'Adaeze Nwosu',       plan_id: 'LH-LG-0012', amount: 1200000,     submitted: '2026-04-16', note: 'Insulin cap exceeded — specialist request attached', urgency: 'High' },
  { id: 'PA004', type: 'Copay Waiver',   name: 'Babatunde Adeyemi',  plan_id: 'LH-LG-0021', amount: 15000,       submitted: '2026-04-16', note: 'Financial hardship declaration submitted', urgency: 'Low' },
  { id: 'PA005', type: 'New Enrollment', name: 'Ngozi Eze',           plan_id: 'LH-PH-0076', amount: null,        submitted: '2026-04-15', note: 'Individual plan — self-pay', urgency: 'Low' },
  { id: 'PA006', type: 'Drug Override',  name: 'Emeka Nwachukwu',    plan_id: 'LH-AK-0053', amount: 62000,       submitted: '2026-04-15', note: 'Branded Losartan instead of generic', urgency: 'Medium' },
  { id: 'PA007', type: 'Address Change', name: 'Yetunde Balogun',    plan_id: 'LH-LG-0044', amount: null,        submitted: '2026-04-14', note: 'Moved from Ikeja to Lekki — delivery reroute needed', urgency: 'Low' },
  { id: 'PA008', type: 'Benefit Extend', name: 'Ifeoma Okafor',      plan_id: 'LH-EN-0031', amount: 890000,      submitted: '2026-04-14', note: 'Cardiac event hospitalisation — urgent extension', urgency: 'High' },
  { id: 'PA009', type: 'Copay Waiver',   name: 'Seun Adeleke',       plan_id: 'LH-LG-0067', amount: 8500,        submitted: '2026-04-13', note: 'Pensioner scheme — standard waiver', urgency: 'Low' },
  { id: 'PA010', type: 'New Enrollment', name: 'Chiamaka Uzor',      plan_id: 'LH-OS-0022', amount: null,        submitted: '2026-04-13', note: 'NHIA reimbursement plan', urgency: 'Medium' },
  { id: 'PA011', type: 'Drug Override',  name: 'Mohammed Garba',     plan_id: 'LH-KN-0041', amount: 37000,       submitted: '2026-04-12', note: 'Atorvastatin 80mg — higher dose than formulary limit', urgency: 'Medium' },
  { id: 'PA012', type: 'Address Change', name: 'Adeola Ogunyemi',    plan_id: 'LH-LG-0088', amount: null,        submitted: '2026-04-12', note: 'Abuja relocation — rider reassignment required', urgency: 'Low' },
]

const TYPE_COLOR = {
  'New Enrollment': '#2563EB',
  'Drug Override':  'var(--s-warn)',
  'Benefit Extend': 'var(--s-danger)',
  'Copay Waiver':   '#7C3AED',
  'Address Change': '#0E9488',
}

export default function Pending({ setToast }) {
  const [items, setItems]     = useState(MOCK_PENDING)
  const [filter, setFilter]   = useState('all')
  const [selected, setSelected] = useState(null)
  const [note, setNote]       = useState('')

  const act = (id, action) => {
    setItems(prev => prev.filter(p => p.id !== id))
    setToast(`${action === 'approve' ? 'Approved' : 'Rejected'} — ${selected?.name}`)
    setSelected(null)
    setNote('')
  }

  const types = ['all', ...new Set(MOCK_PENDING.map(p => p.type))]
  const filtered = items.filter(p => filter === 'all' || p.type === filter)
  const highCount = items.filter(p => p.urgency === 'High').length

  return (
    <div className="page">
      {highCount > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 16 }}>
          <Icon name="alert-triangle" size={18} />
          <div><strong>{highCount} high-urgency</strong> approval{highCount !== 1 ? 's' : ''} pending — immediate review required.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="seg">
          {types.map(t => (
            <button key={t} className={`seg__btn${filter === t ? ' is-active' : ''}`} onClick={() => setFilter(t)}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} pending</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 16px' }} onClick={() => { setSelected(p); setNote('') }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${TYPE_COLOR[p.type]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={p.type === 'New Enrollment' ? 'user-round-plus' : p.type === 'Drug Override' ? 'pill' : p.type === 'Benefit Extend' ? 'shield-plus' : p.type === 'Copay Waiver' ? 'coins' : 'map-pin-plus'} size={17} style={{ color: TYPE_COLOR[p.type] }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--lw-charcoal)' }}>{p.name}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--lw-muted)' }}>{p.plan_id}</span>
                <Pill kind={p.urgency === 'High' ? 'danger' : p.urgency === 'Medium' ? 'warn' : 'success'}>{p.urgency}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }} className="truncate">{p.note}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Pill kind="default" style={{ fontSize: 11, marginBottom: 4 }}>{p.type}</Pill>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{fmtDate(p.submitted)}</div>
              {p.amount && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{fmtMoney(p.amount)}</div>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--lw-muted)' }}>
            <Icon name="check-circle-2" size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>All approvals have been processed.</div>
          </div>
        )}
      </div>

      {/* Review drawer */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)' }}>{selected.type}</div>
                <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{selected.name} · {selected.plan_id}</div>
              </div>
              <Pill kind={selected.urgency === 'High' ? 'danger' : selected.urgency === 'Medium' ? 'warn' : 'success'}>{selected.urgency}</Pill>
              <button className="top__icon-btn" onClick={() => setSelected(null)}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Request note</div>
                <div style={{ fontSize: 13, color: 'var(--lw-charcoal)' }}>{selected.note}</div>
              </div>
              {selected.amount && (
                <div style={{ padding: '12px 14px', background: 'var(--s-warn-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>Financial impact</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--s-warn)' }}>{fmtMoney(selected.amount)}</div>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', display: 'block', marginBottom: 6 }}>Decision note (optional)</label>
                <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for approval or rejection…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelected(null)}>Cancel</button>
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
