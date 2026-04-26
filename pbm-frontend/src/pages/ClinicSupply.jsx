import { useState } from 'react'
import { Icon, Pill, fmtDate, fmtMoney } from '../components/ui'

const SEED_RECORDS = [
  {
    id: 'CS-001', status: 'Finalized', clinic: 'Lagos Island General Hospital', contact: 'Dr. Adewale Bello', date: '2026-04-08', notes: 'Monthly chronic medication supply for clinic pharmacy.',
    items: [
      { id: 1, drug: 'Metformin 500mg', qty: 500, unit_cost: 420, unit: 'tablets' },
      { id: 2, drug: 'Amlodipine 5mg',  qty: 300, unit_cost: 620, unit: 'tablets' },
      { id: 3, drug: 'Lisinopril 10mg', qty: 200, unit_cost: 480, unit: 'tablets' },
    ],
  },
  {
    id: 'CS-002', status: 'Draft', clinic: 'Reddington Hospital Lekki', contact: 'Pharm. Chioma Nwosu', date: '2026-04-16', notes: 'Partial supply — awaiting stock replenishment for insulin.',
    items: [
      { id: 4, drug: 'Atorvastatin 20mg',   qty: 150, unit_cost: 1100, unit: 'tablets' },
      { id: 5, drug: 'Glibenclamide 5mg',   qty: 200, unit_cost: 340,  unit: 'tablets' },
    ],
  },
]

function ItemRow({ item, editable, onChange, onDelete }) {
  const total = (item.qty || 0) * (item.unit_cost || 0)
  if (!editable) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 70px 90px 90px', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--lw-grey-line-2)', fontSize: 13, alignItems: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)' }}>{item.drug}</div>
        <div style={{ color: 'var(--lw-muted)' }}>{item.qty} {item.unit}</div>
        <div style={{ color: 'var(--lw-muted)' }}>{item.unit}</div>
        <div>{fmtMoney(item.unit_cost)}</div>
        <div style={{ fontWeight: 700 }}>{fmtMoney(total)}</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 90px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
      <input className="input" style={{ fontSize: 12 }} placeholder="Drug / item name (free text)" value={item.drug}
        onChange={e => onChange(item.id, 'drug', e.target.value)} />
      <input className="input" type="number" style={{ fontSize: 12 }} placeholder="Qty" value={item.qty || ''}
        onChange={e => onChange(item.id, 'qty', +e.target.value)} min={0} />
      <input className="input" style={{ fontSize: 12 }} placeholder="Unit (e.g. tabs)" value={item.unit || ''}
        onChange={e => onChange(item.id, 'unit', e.target.value)} />
      <input className="input" type="number" style={{ fontSize: 12 }} placeholder="Unit cost ₦" value={item.unit_cost || ''}
        onChange={e => onChange(item.id, 'unit_cost', +e.target.value)} min={0} />
      <button style={{ background: 'none', border: 'none', color: 'var(--s-danger)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        onClick={() => onDelete(item.id)}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

function RecordForm({ initial, onSave, onDiscard }) {
  const isNew = !initial?.id
  const [form, setForm] = useState(initial || { clinic: '', contact: '', date: new Date().toISOString().slice(0, 10), notes: '', items: [{ id: Date.now(), drug: '', qty: 1, unit_cost: 0, unit: 'tablets' }] })
  const [saving, setSaving] = useState(false)

  const ff = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), drug: '', qty: 1, unit_cost: 0, unit: 'tablets' }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))

  const subtotal = form.items.reduce((s, i) => s + (i.qty || 0) * (i.unit_cost || 0), 0)

  const save = async (status) => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 500))
    onSave({ ...form, status })
    setSaving(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--lw-charcoal)' }}>
          {isNew ? 'New Supply Record' : `Editing — ${initial.id}`}
        </div>
        {!isNew && <Pill kind="warn">Draft</Pill>}
        <button className="btn btn--ghost btn--sm" onClick={onDiscard}>Discard</button>
      </div>

      {/* Clinic details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, gridColumn: '1 / 3' }}>
          <label>Clinic / facility name *</label>
          <input className="input" value={form.clinic} onChange={ff('clinic')} placeholder="e.g. Lagos Island General Hospital" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Supply date</label>
          <input className="input" type="date" value={form.date} onChange={ff('date')} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <label>Contact person</label>
          <input className="input" value={form.contact} onChange={ff('contact')} placeholder="e.g. Dr. Adewale Bello / Pharm. Chioma Nwosu" />
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10 }}>
          Medications / items
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--lw-muted)', marginLeft: 8 }}>— free text, enter anything</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 90px 28px', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8, padding: '0 2px' }}>
          <span>Drug / item</span><span>Qty</span><span>Unit</span><span>Unit cost ₦</span><span></span>
        </div>
        {form.items.map(item => (
          <ItemRow key={item.id} item={item} editable onDelete={removeItem} onChange={updateItem} />
        ))}
        <button className="btn btn--ghost btn--sm" onClick={addItem} style={{ marginTop: 6 }}>
          <Icon name="plus" size={13} /> Add item
        </button>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <div style={{ width: 220, padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginBottom: 4 }}>Grand total</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lw-charcoal)' }}>{fmtMoney(subtotal)}</div>
            <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 2 }}>{form.items.length} line item{form.items.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="field" style={{ margin: '0 0 20px' }}>
        <label>Notes / instructions</label>
        <textarea className="input" rows={3} value={form.notes} onChange={ff('notes')}
          placeholder="Any additional context, delivery instructions, special requirements…" style={{ resize: 'vertical' }} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--lw-grey-line)' }}>
        <button className="btn btn--ghost" onClick={() => save('Draft')} disabled={!form.clinic || saving}>
          <Icon name="save" size={13} /> Save as draft
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={() => save('Finalized')} disabled={!form.clinic || form.items.every(i => !i.drug) || saving}>
          {saving ? <Icon name="loader-circle" size={14} /> : <Icon name="check-circle" size={14} />}
          {saving ? 'Saving…' : 'Finalise record'}
        </button>
      </div>
    </div>
  )
}

function RecordDetail({ record, onEdit, onClose }) {
  const subtotal = record.items.reduce((s, i) => s + i.qty * i.unit_cost, 0)

  const print = () => {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Clinic Supply ${record.id}</title><style>
      body{font-family:sans-serif;padding:32px;color:#1a1a1a}
      h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:12px;text-transform:uppercase}
      td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}
      .total{font-size:16px;font-weight:800;margin-top:16px;text-align:right}
    </style></head><body>
      <h2>Clinic Supply — ${record.id}</h2>
      <p style="color:#666;margin:0">${record.clinic} · ${record.contact || ''} · ${fmtDate(record.date)}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit cost</th><th>Total</th></tr></thead><tbody>
      ${record.items.map(i => `<tr><td>${i.drug}</td><td>${i.qty}</td><td>${i.unit || ''}</td><td>₦${(i.unit_cost || 0).toLocaleString()}</td><td>₦${((i.qty || 0) * (i.unit_cost || 0)).toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      ${record.notes ? `<p style="margin-top:16px;font-size:13px;color:#555"><strong>Notes:</strong> ${record.notes}</p>` : ''}
      <div class="total">Grand total: ₦${subtotal.toLocaleString()}</div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--lw-grey-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)' }}>{record.clinic}</div>
            <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{record.id} · {fmtDate(record.date)}</div>
          </div>
          <Pill kind={record.status === 'Finalized' ? 'success' : 'warn'}>{record.status}</Pill>
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          {record.contact && (
            <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="user" size={13} /> {record.contact}
            </div>
          )}

          <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--lw-charcoal)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Items</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 70px 90px 90px', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            <span>Drug</span><span>Qty</span><span>Unit</span><span>Unit cost</span><span>Total</span>
          </div>
          {record.items.map(item => (
            <ItemRow key={item.id} item={item} editable={false} />
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10, textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>Grand total</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lw-charcoal)' }}>{fmtMoney(subtotal)}</div>
            </div>
          </div>

          {record.notes && (
            <div style={{ padding: '10px 14px', background: 'var(--lw-grey-bg)', borderRadius: 10, fontSize: 13, color: 'var(--lw-charcoal)', lineHeight: 1.5 }}>
              <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 4 }}>Notes</div>
              {record.notes}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
          {record.status === 'Draft' && (
            <button className="btn btn--ghost btn--sm" onClick={() => { onClose(); onEdit(record) }}>
              <Icon name="pencil" size={13} /> Continue editing
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm" onClick={print}>
            <Icon name="printer" size={13} /> Print
          </button>
          <button className="btn btn--primary btn--sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function ClinicSupply({ setToast }) {
  const [records, setRecords]   = useState(SEED_RECORDS)
  const [mode, setMode]         = useState('list')   // 'list' | 'new' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')

  const nextId = () => `CS-${String(records.length + 1).padStart(3, '0')}`

  const saveRecord = (data) => {
    if (editTarget) {
      setRecords(prev => prev.map(r => r.id === editTarget.id ? { ...r, ...data } : r))
      setToast(`Supply record ${editTarget.id} ${data.status === 'Finalized' ? 'finalised' : 'saved as draft'}`)
    } else {
      const newRec = { id: nextId(), ...data }
      setRecords(prev => [newRec, ...prev])
      setToast(`Supply record ${newRec.id} ${data.status === 'Finalized' ? 'finalised' : 'saved as draft'}`)
    }
    setMode('list')
    setEditTarget(null)
  }

  const startEdit = (rec) => { setEditTarget(rec); setMode('edit') }

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.clinic.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    const matchF = filter === 'all' || r.status === filter
    return matchQ && matchF
  })

  const totalFinalised = records.filter(r => r.status === 'Finalized').reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.qty * i.unit_cost, 0), 0)
  const draftCount = records.filter(r => r.status === 'Draft').length

  if (mode === 'new' || mode === 'edit') {
    return (
      <div className="page">
        <RecordForm initial={editTarget} onSave={saveRecord} onDiscard={() => { setMode('list'); setEditTarget(null) }} />
      </div>
    )
  }

  return (
    <div className="page">
      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total records',     value: records.length,    icon: 'file-text',    color: '#2563EB' },
          { label: 'Finalised value',   value: fmtMoney(totalFinalised), icon: 'check-circle-2', color: 'var(--s-success)' },
          { label: 'Drafts in progress',value: draftCount,        icon: 'clock',        color: 'var(--s-warn)' },
        ].map(t => (
          <div key={t.label} style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--lw-grey-line)', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name={t.icon} size={22} style={{ color: t.color }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      {draftCount > 0 && (
        <div className="banner banner--warn" style={{ marginBottom: 16 }}>
          <Icon name="clock" size={18} />
          <div><strong>{draftCount} draft{draftCount !== 1 ? 's' : ''}</strong> saved — click to continue editing and finalise.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search clinic or record ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {[['all','All'], ['Draft','Drafts'], ['Finalized','Finalised']].map(([k, l]) => (
            <button key={k} className={`seg__btn${filter === k ? ' is-active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => { setEditTarget(null); setMode('new') }}>
          <Icon name="plus" size={14} /> New supply record
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => {
          const total = r.items.reduce((s, i) => s + i.qty * i.unit_cost, 0)
          return (
            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setViewTarget(r)}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: r.status === 'Finalized' ? 'var(--s-success-bg)' : 'var(--s-warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={r.status === 'Finalized' ? 'check-circle-2' : 'clock'} size={20} style={{ color: r.status === 'Finalized' ? 'var(--s-success)' : 'var(--s-warn)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{r.clinic}</div>
                <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 2 }}>
                  {r.id} · {fmtDate(r.date)} · {r.contact || 'No contact'} · {r.items.length} item{r.items.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--lw-charcoal)' }}>{fmtMoney(total)}</div>
                <Pill kind={r.status === 'Finalized' ? 'success' : 'warn'} style={{ marginTop: 4 }}>{r.status}</Pill>
              </div>
              {r.status === 'Draft' && (
                <button className="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); startEdit(r) }}>
                  <Icon name="pencil" size={13} /> Edit
                </button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--lw-muted)' }}>
            <Icon name="stethoscope" size={36} style={{ opacity: 0.25, marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>No supply records yet.</div>
          </div>
        )}
      </div>

      {viewTarget && <RecordDetail record={viewTarget} onClose={() => setViewTarget(null)} onEdit={startEdit} />}
    </div>
  )
}
