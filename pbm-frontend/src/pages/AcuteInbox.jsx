import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, StatusPill, Pill, fmtDate, fmtMoney } from '../components/ui'

const ROUTING = {
  lagos:   { label: 'Lagos',         icon: 'map-pin',  color: 'var(--lw-red)' },
  outside: { label: 'Outside Lagos', icon: 'send',     color: '#7C3AED' },
}

function AcuteDrawer({ order, region, onClose, onUpdated, setToast }) {
  const [riderId, setRiderId]   = useState('')
  const [riders, setRiders]     = useState([])
  const [partnerId, setPartnerId] = useState('')
  const [amount, setAmount]     = useState('')
  const [busy, setBusy]         = useState(false)

  useEffect(() => {
    fetch(API_BASE + '/api/riders', { credentials: 'include' })
      .then(r => r.json()).then(setRiders).catch(() => {})
  }, [])

  const canAssign = order.bucket === 'Pending' || order.bucket === 'Processing'
  const canUnpack = order.bucket === 'Awaiting Claim'
  const canSubmit = order.bucket === 'Awaiting Claim'

  const doAssign = async () => {
    if (!riderId) { setToast('Select a rider first', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(API_BASE + `/api/acute-orders/${order.id}/assign-rider`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rider_id: riderId }),
      })
      const data = await res.json()
      if (!res.ok) { setToast(data.detail || 'Failed to assign rider', 'error'); return }
      onUpdated(data)
      setToast(`Rider assigned → Awaiting Claim`)
      onClose()
    } catch { setToast('Error assigning rider', 'error') }
    finally { setBusy(false) }
  }

  const doUnpack = async () => {
    setBusy(true)
    try {
      const res = await fetch(API_BASE + `/api/acute-orders/${order.id}/unpack`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { setToast(data.detail || 'Failed to unpack', 'error'); return }
      onUpdated(data)
      setToast('Order returned to Pending — rider released')
      onClose()
    } catch { setToast('Error unpacking', 'error') }
    finally { setBusy(false) }
  }

  const doSubmitClaim = async () => {
    if (!partnerId.trim()) { setToast('Enter a partner ID', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(API_BASE + `/api/acute-orders/${order.id}/submit-claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ partner_id: partnerId, amount_ngn: amount ? +amount : null }),
      })
      const data = await res.json()
      if (!res.ok) { setToast(data.detail || 'Failed to submit claim', 'error'); return }
      onUpdated(data.order)
      setToast(`Claim ${data.claim.id} submitted — ₦${data.claim.amount_ngn?.toLocaleString()}`)
      onClose()
    } catch { setToast('Error submitting claim', 'error') }
    finally { setBusy(false) }
  }

  const availableRiders = riders.filter(r => r.status !== 'Off Duty')

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Avatar name={order.enrollee_name} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--lw-charcoal)' }}>{order.enrollee_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>
              {order.enrollee_id} · {ROUTING[region]?.label || region}
            </div>
          </div>
          <StatusPill status={order.bucket} />
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Order details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Order ID', order.id],
              ['Drug', order.drug],
              ['Quantity', order.quantity],
              ['Region', order.region],
              ['Date', fmtDate(order.created_at)],
              ['Status', order.bucket],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '9px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Rider info if assigned */}
          {order.rider_name && (
            <div style={{ padding: '12px 14px', background: 'var(--s-success-bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Assigned Rider</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-success)' }}>{order.rider_name}</div>
              {order.assigned_at && <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 2 }}>Assigned: {fmtDate(order.assigned_at)}</div>}
            </div>
          )}

          {/* Claim info if submitted */}
          {order.claim_id && (
            <div style={{ padding: '12px 14px', background: 'var(--s-success-bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Claim Submitted</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--s-success)' }}>{order.claim_id} · {fmtMoney(order.amount_ngn)}</div>
            </div>
          )}

          {/* Assign rider */}
          {canAssign && (
            <div style={{ padding: '14px', background: 'var(--lw-grey-bg)', borderRadius: 12, border: '1px solid var(--lw-grey-line)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Assign Rider</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="input" style={{ flex: 1 }} value={riderId} onChange={e => setRiderId(e.target.value)}>
                  <option value="">Select rider…</option>
                  {availableRiders.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.status}) · {r.region}</option>
                  ))}
                </select>
                <button className="btn btn--primary btn--sm" onClick={doAssign} disabled={busy || !riderId}>
                  {busy ? <Icon name="loader-circle" size={14} /> : <Icon name="bike" size={14} />} Assign
                </button>
              </div>
            </div>
          )}

          {/* Unpack */}
          {canUnpack && (
            <div style={{ padding: '14px', background: 'var(--s-warn-bg)', borderRadius: 12, border: '1px solid rgba(217,119,6,.2)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Return to Pending</div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginBottom: 10 }}>Unpack this order — rider will be released back to Available.</div>
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-warn)', borderColor: 'rgba(217,119,6,.3)' }}
                onClick={doUnpack} disabled={busy}>
                <Icon name="package-open" size={14} /> Unpack
              </button>
            </div>
          )}

          {/* Submit claim */}
          {canSubmit && (
            <div style={{ padding: '14px', background: '#F0F9FF', borderRadius: 12, border: '1px solid #BAE6FD' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Submit Claim</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Partner ID (e.g. p01)" value={partnerId}
                  onChange={e => setPartnerId(e.target.value)} />
                <input className="input" style={{ width: 140 }} placeholder="Amount ₦ (optional)" type="number" value={amount}
                  onChange={e => setAmount(e.target.value)} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginBottom: 8 }}>Leave amount blank to auto-price from tariff.</div>
              <button className="btn btn--primary btn--sm" onClick={doSubmitClaim} disabled={busy || !partnerId}>
                {busy ? <Icon name="loader-circle" size={14} /> : <Icon name="file-check" size={14} />} Submit Claim
              </button>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13 }}>{order.notes}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function AcuteInbox({ bucket, setToast }) {
  const [orders, setOrders]     = useState([])
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch(API_BASE + `/api/acute-orders?region=${bucket}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setOrders(d); setLoading(false) }).catch(() => setLoading(false))
  }, [bucket])

  const onUpdated = (updated) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchQ = !q || o.enrollee_name.toLowerCase().includes(q)
      || o.enrollee_id.toLowerCase().includes(q)
      || o.drug.toLowerCase().includes(q)
    const matchS = statusFilter === 'all' || o.bucket === statusFilter
    return matchQ && matchS
  })

  const pending = orders.filter(o => o.bucket === 'Pending').length
  const awaitingClaim = orders.filter(o => o.bucket === 'Awaiting Claim').length

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {awaitingClaim > 0 && (
        <div className="banner banner--warn" style={{ marginBottom: 16 }}>
          <Icon name="clock" size={18} />
          <div><strong>{awaitingClaim} order{awaitingClaim !== 1 ? 's' : ''}</strong> awaiting claim submission.</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search member, policy, drug…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {['all', 'Pending', 'Processing', 'Awaiting Claim', 'Delivered', 'Cancelled'].map(f => (
            <button key={f} className={`seg__btn${statusFilter === f ? ' is-active' : ''}`} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>
          {filtered.length} orders · {pending} pending
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Policy No</th>
              <th>Drug</th>
              <th>Qty</th>
              <th>Region</th>
              <th>Date</th>
              <th>Rider</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(o)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={o.enrollee_name} size={28} />
                    <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{o.enrollee_name}</div>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.enrollee_id}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{o.drug}</td>
                <td style={{ fontSize: 13 }}>{o.quantity}</td>
                <td style={{ fontSize: 12.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name={ROUTING[o.region?.toLowerCase() === 'lagos' ? 'lagos' : 'outside']?.icon || 'map-pin'} size={12}
                      style={{ color: o.region?.toLowerCase() === 'lagos' ? 'var(--lw-red)' : '#7C3AED' }} />
                    {o.region}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{fmtDate(o.created_at)}</td>
                <td style={{ fontSize: 12.5 }}>
                  {o.rider_name
                    ? <span style={{ color: 'var(--s-success)', fontWeight: 600 }}>{o.rider_name}</span>
                    : <span style={{ color: 'var(--lw-muted)' }}>—</span>}
                </td>
                <td><StatusPill status={o.bucket} /></td>
                <td>
                  <button className="btn btn--ghost btn--sm" onClick={ev => { ev.stopPropagation(); setSelected(o) }}>
                    <Icon name="chevron-right" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AcuteDrawer
          order={selected}
          region={bucket}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
          setToast={setToast}
        />
      )}
    </div>
  )
}
