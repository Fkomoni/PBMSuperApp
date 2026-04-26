import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Pill, fmtMoney, fmtDate } from '../components/ui'

const MOCK_MOVEMENTS = [
  { id: 1, drug: 'Metformin 500mg',    type: 'Receipt',    qty: 500,  batch: 'MFR-2025-041', expiry: '2027-06-30', by: 'Amaka Obi',    at: '2026-04-15 09:12' },
  { id: 2, drug: 'Lisinopril 10mg',    type: 'Dispensed',  qty: -12,  batch: 'LSN-2025-033', expiry: '2026-12-31', by: 'Olu Adeyemi',   at: '2026-04-15 10:40' },
  { id: 3, drug: 'Amlodipine 5mg',     type: 'Receipt',    qty: 300,  batch: 'AML-2026-001', expiry: '2028-03-15', by: 'Amaka Obi',    at: '2026-04-16 08:30' },
  { id: 4, drug: 'Atorvastatin 20mg',  type: 'Dispensed',  qty: -8,   batch: 'ATV-2025-022', expiry: '2027-09-30', by: 'Olu Adeyemi',   at: '2026-04-16 11:05' },
  { id: 5, drug: 'Glibenclamide 5mg',  type: 'Adjustment', qty: -4,   batch: 'GLB-2025-018', expiry: '2026-08-31', by: 'Pharmacy Lead', at: '2026-04-17 14:22' },
  { id: 6, drug: 'Metformin 500mg',    type: 'Dispensed',  qty: -24,  batch: 'MFR-2025-041', expiry: '2027-06-30', by: 'Olu Adeyemi',   at: '2026-04-17 15:30' },
  { id: 7, drug: 'Losartan 50mg',      type: 'Receipt',    qty: 200,  batch: 'LST-2026-005', expiry: '2028-01-15', by: 'Amaka Obi',    at: '2026-04-18 09:00' },
  { id: 8, drug: 'Lisinopril 10mg',    type: 'Dispensed',  qty: -6,   batch: 'LSN-2025-033', expiry: '2026-12-31', by: 'Olu Adeyemi',   at: '2026-04-18 10:15' },
]

export default function Stock({ setToast }) {
  const [drugs, setDrugs]       = useState([])
  const [tab, setTab]           = useState('inventory')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [reordering, setReordering] = useState(null)
  const [reorderQty, setReorderQty] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch(API_BASE + '/api/drugs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setDrugs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const submitReorder = (drug) => {
    const qty = parseInt(reorderQty, 10)
    if (!qty || qty <= 0) return
    setDrugs(prev => prev.map(d => d.id === drug.id ? { ...d, quantity: d.quantity + qty } : d))
    setToast(`Reorder of ${qty} × ${drug.name} submitted`)
    setReordering(null)
    setReorderQty('')
  }

  const filtered = drugs.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()))
  const expiringSoon = drugs.filter(d => {
    if (!d.expiry) return false
    const days = Math.ceil((new Date(d.expiry) - new Date('2026-04-18')) / 86400000)
    return days > 0 && days <= 90
  })
  const lowStock = drugs.filter(d => d.quantity <= d.reorder_level)

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {lowStock.length > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 12 }}>
          <Icon name="alert-triangle" size={18} />
          <div><strong>{lowStock.length} item{lowStock.length !== 1 ? 's' : ''}</strong> below reorder level. Immediate procurement required.</div>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="banner banner--warn" style={{ marginBottom: 16 }}>
          <Icon name="clock" size={18} />
          <div><strong>{expiringSoon.length} batch{expiringSoon.length !== 1 ? 'es' : ''}</strong> expiring within 90 days. Apply FEFO dispensing.</div>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 16 }}>
        {[['inventory', 'Inventory'], ['movements', 'Stock Movements']].map(([k, l]) => (
          <button key={k} className={`tab-btn${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div className="search-box" style={{ flex: 1 }}>
              <Icon name="search" size={14} />
              <input placeholder="Search drug…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Strength</th>
                  <th>Quantity</th>
                  <th>Reorder Lvl</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const isLow = d.quantity <= d.reorder_level
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{d.generic}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{d.strength}</td>
                      <td>
                        {reordering === d.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input className="input" type="number" value={reorderQty} onChange={e => setReorderQty(e.target.value)}
                              placeholder="Qty" style={{ width: 80, fontSize: 12 }} onKeyDown={k => k.key === 'Enter' && submitReorder(d)} />
                            <button className="btn btn--primary btn--sm" onClick={() => submitReorder(d)}>Submit</button>
                            <button className="btn btn--ghost btn--sm" onClick={() => { setReordering(null); setReorderQty('') }}>✕</button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700, color: isLow ? 'var(--s-danger)' : 'var(--lw-charcoal)', fontSize: 15 }}>{d.quantity}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{d.reorder_level}</td>
                      <td style={{ fontSize: 13 }}>{fmtMoney(d.unit_price)}</td>
                      <td>
                        <Pill kind={isLow ? 'danger' : d.quantity <= d.reorder_level * 2 ? 'warn' : 'success'}>
                          {isLow ? 'Low' : d.quantity <= d.reorder_level * 2 ? 'Watch' : 'OK'}
                        </Pill>
                      </td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => { setReordering(d.id); setReorderQty('') }}>
                          <Icon name="package-plus" size={13} /> Reorder
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Drug</th>
                <th>Type</th>
                <th>Qty Change</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>By</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_MOVEMENTS.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{m.drug}</td>
                  <td>
                    <Pill kind={m.type === 'Receipt' ? 'success' : m.type === 'Adjustment' ? 'warn' : 'default'}>{m.type}</Pill>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 13, color: m.qty > 0 ? 'var(--s-success)' : 'var(--s-danger)' }}>
                    {m.qty > 0 ? '+' : ''}{m.qty}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.batch}</td>
                  <td style={{ fontSize: 12.5 }}>{fmtDate(m.expiry)}</td>
                  <td style={{ fontSize: 12.5 }}>{m.by}</td>
                  <td style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{m.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
