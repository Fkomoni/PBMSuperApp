import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, StatusPill, Pill, fmtDate, fmtMoney } from '../components/ui'

const ROUTING = {
  lagos:   { label: 'Lagos',         icon: 'map-pin',  color: 'var(--lw-red)' },
  outside: { label: 'Outside Lagos', icon: 'send',     color: '#7C3AED' },
}

const URGENCY_COLOR = { High: 'var(--s-danger)', Medium: 'var(--s-warn)', Low: 'var(--s-success)' }

function PartnerTracker({ order }) {
  const steps = ['Received', 'Verified', 'Dispensed', 'Dispatched', 'Delivered']
  const idx   = steps.indexOf(order.partner_status) ?? 0
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
        Partner Fulfilment Tracker
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && (
              <div style={{ position: 'absolute', top: 9, right: '50%', width: '100%', height: 2, background: i <= idx ? 'var(--lw-red)' : 'var(--lw-grey-line)' }} />
            )}
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: i <= idx ? 'var(--lw-red)' : 'var(--lw-grey-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
              {i < idx && <Icon name="check" size={11} style={{ color: '#fff' }} />}
              {i === idx && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <div style={{ fontSize: 10.5, color: i <= idx ? 'var(--lw-charcoal)' : 'var(--lw-muted)', marginTop: 4, textAlign: 'center', fontWeight: i === idx ? 700 : 400 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AcuteDrawer({ order, bucket, onClose, setToast }) {
  const [approving, setApproving] = useState(false)
  const [note, setNote] = useState('')

  const approve = async () => {
    setApproving(true)
    const token = localStorage.getItem('pbm_token')
    try {
      await fetch(API_BASE + `/api/acute-orders/${order.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      setToast('Order approved and queued for fulfilment')
      onClose()
    } catch {
      setToast('Failed to approve — try again')
    } finally {
      setApproving(false)
    }
  }

  const flag = () => {
    setToast('Order flagged for pharmacist review')
    onClose()
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 540 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Avatar name={order.patient_name} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--lw-charcoal)' }}>{order.patient_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{order.plan_id} · {order.diagnosis} · {order.hospital}</div>
          </div>
          <Pill kind={order.urgency === 'High' ? 'danger' : order.urgency === 'Medium' ? 'warn' : 'success'}>{order.urgency}</Pill>
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Order details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Order ID', order.id],
              ['Received', fmtDate(order.created_at)],
              ['Hospital', order.hospital],
              ['Prescriber', order.prescriber],
              ['Route', ROUTING[bucket]?.label],
              ['HMO Copay', fmtMoney(order.copay)],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '9px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Prescription items */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 8 }}>Prescribed Drugs</div>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--lw-grey-line-2)', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lw-red)', flexShrink: 0 }} />
                <div style={{ flex: 2, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{item.name}</div>
                <div style={{ flex: 1, color: 'var(--lw-muted)' }}>{item.dosage}</div>
                <div style={{ flex: 1, color: 'var(--lw-muted)' }}>{item.quantity} units</div>
                <div style={{ flex: 1 }}>{fmtMoney(item.unit_price)}/unit</div>
              </div>
            ))}
          </div>

          {/* Partner tracker for outside-lagos */}
          {bucket === 'outside' && <PartnerTracker order={order} />}

          {/* Prescription image */}
          {order.prescription_url && (
            <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginBottom: 6 }}>Uploaded prescription</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--lw-red)', cursor: 'pointer' }}>
                <Icon name="file-image" size={15} /> {order.prescription_url}
              </div>
            </div>
          )}

          {/* Clinical note */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', display: 'block', marginBottom: 6 }}>Pharmacist note (optional)</label>
            <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add clinical note before approval…" style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-warn)' }} onClick={flag}>
            <Icon name="flag" size={14} /> Flag for review
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={approve} disabled={approving}>
            {approving ? <Icon name="loader-circle" size={15} /> : <Icon name="check-circle" size={15} />}
            {approving ? 'Approving…' : 'Approve & Queue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AcuteInbox({ bucket, setToast }) {
  const [orders, setOrders]   = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch(API_BASE + `/api/acute-orders?bucket=${bucket}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setOrders(d); setLoading(false) }).catch(() => setLoading(false))
  }, [bucket])

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchQ = !q || o.patient_name.toLowerCase().includes(q) || o.plan_id.toLowerCase().includes(q) || o.hospital.toLowerCase().includes(q)
    const matchF = filter === 'all' || o.urgency === filter || o.status === filter
    return matchQ && matchF
  })

  const high   = orders.filter(o => o.urgency === 'High').length
  const pending = orders.filter(o => o.status === 'Pending').length

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {high > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 16 }}>
          <Icon name="siren" size={18} />
          <div><strong>{high} high-urgency</strong> orders require immediate pharmacist review.</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search patient, plan ID, hospital…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {['all', 'High', 'Medium', 'Low', 'Pending', 'Approved'].map(f => (
            <button key={f} className={`seg__btn${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} orders · {pending} pending</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Plan ID</th>
              <th>Hospital</th>
              <th>Prescriber</th>
              <th>Urgency</th>
              <th>Items</th>
              <th>Copay</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(o)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={o.patient_name} size={28} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{o.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{o.diagnosis}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.plan_id}</td>
                <td style={{ fontSize: 12.5 }}>{o.hospital}</td>
                <td style={{ fontSize: 12.5 }}>{o.prescriber}</td>
                <td>
                  <Pill kind={o.urgency === 'High' ? 'danger' : o.urgency === 'Medium' ? 'warn' : 'success'}>
                    {o.urgency}
                  </Pill>
                </td>
                <td style={{ fontSize: 13 }}>{(o.items || []).length} drug{(o.items || []).length !== 1 ? 's' : ''}</td>
                <td style={{ fontSize: 13 }}>{fmtMoney(o.copay)}</td>
                <td><StatusPill status={o.status} /></td>
                <td>
                  <button className="btn btn--ghost btn--sm" onClick={ev => { ev.stopPropagation(); setSelected(o) }}>
                    <Icon name="chevron-right" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No acute orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AcuteDrawer order={selected} bucket={bucket} onClose={() => setSelected(null)} setToast={setToast} />
      )}
    </div>
  )
}
