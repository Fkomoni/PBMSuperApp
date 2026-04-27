import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Pill, fmtMoney, EmptyState } from '../components/ui'

const CATEGORIES = ['all', 'antidiabetic', 'antihypertensive', 'cardiovascular', 'antibiotic', 'analgesic', 'other']

export default function Pharmacy({ setToast }) {
  const [drugs, setDrugs]     = useState([])
  const [search, setSearch]   = useState('')
  const [cat, setCat]         = useState('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState({})

  useEffect(() => {
    fetch(API_BASE + '/api/drugs', { credentials: 'include' })
      .then(r => r.json()).then(d => { setDrugs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const startEdit = (d) => { setEditing(d.id); setForm({ ...d }) }
  const saveEdit  = () => {
    setDrugs(prev => prev.map(d => d.id === editing ? { ...d, ...form } : d))
    setEditing(null)
    setToast('Drug record updated')
  }

  const filtered = drugs.filter(d => {
    const q = search.toLowerCase()
    const matchQ = !q || d.name.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q)
    const matchC = cat === 'all' || d.category === cat
    return matchQ && matchC
  })

  const lowStock = drugs.filter(d => d.quantity <= d.reorder_level)

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {lowStock.length > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 16 }}>
          <Icon name="alert-triangle" size={18} />
          <div><strong>{lowStock.length} drug{lowStock.length !== 1 ? 's' : ''}</strong> below reorder level: {lowStock.map(d => d.name).join(', ')}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search drug name or generic…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 180 }} value={cat} onChange={e => setCat(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} drugs</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Brand Name</th>
              <th>Generic</th>
              <th>Category</th>
              <th>Strength</th>
              <th>Unit Price</th>
              <th>Stock</th>
              <th>Reorder Lvl</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              editing === d.id ? (
                <tr key={d.id} style={{ background: 'var(--lw-grey-bg)' }}>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.generic} onChange={e => setForm(f => ({ ...f, generic: e.target.value }))} /></td>
                  <td>
                    <select className="input" style={{ fontSize: 12 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} /></td>
                  <td><input className="input" type="number" style={{ fontSize: 12, width: 90 }} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: +e.target.value }))} /></td>
                  <td><input className="input" type="number" style={{ fontSize: 12, width: 80 }} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} /></td>
                  <td><input className="input" type="number" style={{ fontSize: 12, width: 80 }} value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: +e.target.value }))} /></td>
                  <td />
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--primary btn--sm" onClick={saveEdit}>Save</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{d.name}</td>
                  <td style={{ color: 'var(--lw-muted)', fontSize: 12.5 }}>{d.generic}</td>
                  <td style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{d.category}</td>
                  <td style={{ fontSize: 12.5 }}>{d.strength}</td>
                  <td style={{ fontSize: 13 }}>{fmtMoney(d.unit_price)}</td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 13, color: d.quantity <= d.reorder_level ? 'var(--s-danger)' : 'var(--lw-charcoal)' }}>
                      {d.quantity}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{d.reorder_level}</td>
                  <td>
                    <Pill kind={d.quantity <= d.reorder_level ? 'danger' : d.quantity <= d.reorder_level * 2 ? 'warn' : 'success'}>
                      {d.quantity <= d.reorder_level ? 'Low stock' : d.quantity <= d.reorder_level * 2 ? 'Watch' : 'OK'}
                    </Pill>
                  </td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => startEdit(d)}>
                      <Icon name="pencil" size={13} />
                    </button>
                  </td>
                </tr>
              )
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No drugs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
