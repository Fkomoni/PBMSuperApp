import { useState } from 'react'
import { Icon, Pill, fmtDate, fmtMoney } from '../components/ui'

const BLANK_MEMBER = { name: '', member_id: '', phone: '', plan: '', diagnosis: '', company: '', address: '', on_prognosis: true }
const BLANK_ITEM   = { id: Date.now(), drug_name: '', drug_code: '', qty: 1, unit_price: 0 }

const SEED_BILLS = [
  {
    id: 'EXB-001', date: '2026-04-10', member: { name: 'Chidinma Ogu', member_id: 'LH-EX-091', phone: '08031112222', plan: 'Silver', diagnosis: 'Hypertension', company: 'Access Bank', on_prognosis: false },
    items: [{ id: 1, drug_name: 'Amlodipine 10mg', drug_code: 'AML10', qty: 60, unit_price: 750 }, { id: 2, drug_name: 'Lisinopril 20mg', drug_code: 'LSN20', qty: 30, unit_price: 890 }],
    note: 'Member undergoing HMO transition — not yet on Prognosis.', status: 'Invoiced',
  },
  {
    id: 'EXB-002', date: '2026-04-14', member: { name: 'Gbenga Adewale', member_id: 'LH-LG-0044', phone: '08055667788', plan: 'Gold Plus', diagnosis: 'Diabetes Type 2', company: 'Zenith Bank', on_prognosis: true },
    items: [{ id: 3, drug_name: 'Januvia 100mg', drug_code: 'SIT100', qty: 30, unit_price: 14500 }],
    note: 'Drug override — formulary exception approved by CMO.', status: 'Pending',
  },
]

function InvoicePrint({ bill, onClose }) {
  const subtotal = bill.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const vat      = Math.round(subtotal * 0.075)
  const total    = subtotal + vat

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 640, maxHeight: '90vh', overflowY: 'auto', padding: 36, boxShadow: 'var(--sh-lg)', margin: 'auto', marginTop: '5vh' }}
        onClick={e => e.stopPropagation()}>
        {/* Invoice header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--lw-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shield-check" size={18} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: '.06em', color: 'var(--lw-charcoal)' }}>LEADWAY HEALTH</div>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Pharmacy Benefit Management</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', lineHeight: 1.6 }}>
              Plot 1235, Bishop Aboyade Cole Street<br />Victoria Island, Lagos. RC 123456
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--lw-charcoal)', letterSpacing: '.04em' }}>EXCLUSION INVOICE</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--lw-red)', marginTop: 4 }}>{bill.id}</div>
            <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>Date: {fmtDate(bill.date)}</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--lw-grey-line)', marginBottom: 20 }} />

        {/* Bill to */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Bill To</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{bill.member.company || bill.member.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginTop: 2 }}>Exclusion Team — HMO Claims</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Member Details</div>
            <div style={{ fontSize: 12.5, color: 'var(--lw-charcoal)', lineHeight: 1.7 }}>
              <strong>{bill.member.name}</strong><br />
              {bill.member.member_id && <>{bill.member.member_id}<br /></>}
              {bill.member.plan && <>{bill.member.plan} · {bill.member.diagnosis}<br /></>}
              {bill.member.phone}
              {!bill.member.on_prognosis && <div style={{ marginTop: 4 }}><Pill kind="warn">Not on Prognosis</Pill></div>}
            </div>
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ background: 'var(--lw-grey-bg)' }}>
              {['Drug / Description', 'Code', 'Qty', 'Unit Price', 'Total'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Qty' || h === 'Unit Price' || h === 'Total' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--lw-grey-line-2)' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{item.drug_name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--lw-muted)' }}>{item.drug_code || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right' }}>{fmtMoney(item.unit_price)}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{fmtMoney(item.qty * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 240 }}>
            {[['Subtotal', fmtMoney(subtotal)], ['VAT (7.5%)', fmtMoney(vat)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: 'var(--lw-muted)' }}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 15, fontWeight: 800, color: 'var(--lw-charcoal)', borderTop: '1px solid var(--lw-charcoal)', marginTop: 4 }}>
              <span>Total Due</span><span>{fmtMoney(total)}</span>
            </div>
          </div>
        </div>

        {bill.note && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--s-warn-bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--lw-charcoal)' }}>
            <strong>Note:</strong> {bill.note}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--primary" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print / Download
          </button>
        </div>
      </div>
    </div>
  )
}

function BillForm({ onSave, onCancel }) {
  const [member, setMember] = useState({ ...BLANK_MEMBER })
  const [items, setItems]   = useState([{ ...BLANK_ITEM, id: 1 }])
  const [note, setNote]     = useState('')

  const mf = k => e => setMember(m => ({ ...m, [k]: e.target.value }))
  const addItem = () => setItems(prev => [...prev, { id: Date.now(), drug_name: '', drug_code: '', qty: 1, unit_price: 0 }])
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const updateItem = (id, k, v) => setItems(prev => prev.map(i => i.id === id ? { ...i, [k]: k === 'qty' || k === 'unit_price' ? +v : v } : i))

  const subtotal = items.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0)
  const vat = Math.round(subtotal * 0.075)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Member section */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          Member details
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 400, color: 'var(--lw-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!member.on_prognosis}
              onChange={e => setMember(m => ({ ...m, on_prognosis: !e.target.checked }))} />
            Member not on Prognosis
          </label>
        </div>
        {!member.on_prognosis && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--s-warn-bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--s-warn)' }}>
            <Icon name="alert-triangle" size={13} style={{ marginRight: 6 }} />
            This member is not registered on Prognosis. Fill in details manually — the invoice can still be processed and shared with the exclusion team.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['name','Full name *'], ['phone','Phone'], ['plan','Plan code'], ['diagnosis','Diagnosis'], ['company','Company / Employer'], ['address','Address']].map(([k, l]) => (
            <div key={k} className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 11.5 }}>{l}</label>
              <input className="input" style={{ fontSize: 12 }} value={member[k]} onChange={mf(k)} />
            </div>
          ))}
          {!member.on_prognosis ? null : (
            <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11.5 }}>Prognosis Member ID</label>
              <input className="input" style={{ fontSize: 12 }} value={member.member_id} onChange={mf('member_id')} placeholder="e.g. LH-LG-0044" />
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Prescription items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 110px 100px 28px', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, padding: '0 4px' }}>
          <span>Drug name</span><span>Code</span><span>Unit price (₦)</span><span>Qty</span><span></span>
        </div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 110px 100px 28px', gap: 6, marginBottom: 6 }}>
            <input className="input" style={{ fontSize: 12 }} placeholder="e.g. Januvia 100mg" value={item.drug_name} onChange={e => updateItem(item.id, 'drug_name', e.target.value)} />
            <input className="input" style={{ fontSize: 12 }} placeholder="Code" value={item.drug_code} onChange={e => updateItem(item.id, 'drug_code', e.target.value)} />
            <input className="input" type="number" style={{ fontSize: 12 }} placeholder="0" value={item.unit_price || ''} onChange={e => updateItem(item.id, 'unit_price', e.target.value)} />
            <input className="input" type="number" style={{ fontSize: 12 }} placeholder="1" value={item.qty || ''} onChange={e => updateItem(item.id, 'qty', e.target.value)} min={1} />
            <button style={{ background: 'none', border: 'none', color: 'var(--s-danger)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} onClick={() => removeItem(item.id)} disabled={items.length === 1}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={addItem} style={{ marginTop: 4 }}>
          <Icon name="plus" size={13} /> Add drug
        </button>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <div style={{ width: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--lw-muted)', padding: '4px 0' }}>
              <span>Subtotal</span><span>{fmtMoney(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--lw-muted)', padding: '4px 0' }}>
              <span>VAT 7.5%</span><span>{fmtMoney(vat)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: 'var(--lw-charcoal)', padding: '8px 0', borderTop: '1px solid var(--lw-grey-line)', marginTop: 4 }}>
              <span>Total</span><span>{fmtMoney(subtotal + vat)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="field" style={{ margin: 0 }}>
        <label style={{ fontSize: 11.5 }}>Clinical / billing note</label>
        <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for exclusion bill, approval reference…" style={{ resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave({ member, items, note })} disabled={!member.name || items.every(i => !i.drug_name)}>
          <Icon name="file-plus" size={14} /> Create & generate invoice
        </button>
      </div>
    </div>
  )
}

export default function ExclusionBills({ setToast }) {
  const [bills, setBills]       = useState(SEED_BILLS)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview]   = useState(null)
  const [search, setSearch]     = useState('')

  const nextId = () => `EXB-${String(bills.length + 1).padStart(3, '0')}`

  const saveBill = ({ member, items, note }) => {
    const bill = {
      id: nextId(),
      date: new Date().toISOString().slice(0, 10),
      member, items, note, status: 'Pending',
    }
    setBills(prev => [bill, ...prev])
    setCreating(false)
    setPreview(bill)
    setToast('Exclusion bill created — invoice ready')
  }

  const filtered = bills.filter(b => !search || b.member.name.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page">
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <Icon name="file-minus-2" size={18} />
        <div>Exclusion bills can be raised for <strong>any member</strong> — including those not yet on Prognosis. Each bill generates a printable invoice for the exclusion team.</div>
      </div>

      {creating ? (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 16 }}>New Exclusion Bill</div>
          <BillForm onSave={saveBill} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <div className="search-box" style={{ flex: 1 }}>
              <Icon name="search" size={14} />
              <input placeholder="Search member or bill ID…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} /> New exclusion bill
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr><th>Bill ID</th><th>Date</th><th>Member</th><th>Company</th><th>Items</th><th>Total</th><th>Prognosis</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const subtotal = b.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
                  const total = subtotal + Math.round(subtotal * 0.075)
                  return (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                      <td style={{ fontSize: 12.5 }}>{fmtDate(b.date)}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{b.member.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{b.member.diagnosis}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{b.member.company || '—'}</td>
                      <td style={{ fontSize: 12.5 }}>{b.items.length} drug{b.items.length !== 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{fmtMoney(total)}</td>
                      <td>
                        <Pill kind={b.member.on_prognosis ? 'success' : 'warn'}>
                          {b.member.on_prognosis ? 'On Prognosis' : 'Off-scheme'}
                        </Pill>
                      </td>
                      <td><Pill kind={b.status === 'Invoiced' ? 'default' : 'warn'}>{b.status}</Pill></td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPreview(b)}>
                          <Icon name="file-text" size={13} /> Invoice
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No exclusion bills yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {preview && <InvoicePrint bill={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
