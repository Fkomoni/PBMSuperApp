import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Pill, fmtMoney } from '../components/ui'

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

  const categories = ['all', ...new Set(drugs.map(d => d.category).filter(Boolean))]

  const startEdit = (d) => { setEditing(d.id); setForm({ ...d }) }
  const saveEdit  = () => {
    setDrugs(prev => prev.map(d => d.id === editing ? { ...d, ...form } : d))
    setEditing(null)
    setToast('Drug record updated')
  }

  const filtered = drugs.filter(d => {
    const q = search.toLowerCase()
    const matchQ = !q
      || d.name.toLowerCase().includes(q)
      || (d.generic_name || '').toLowerCase().includes(q)
      || (d.brand_name || '').toLowerCase().includes(q)
    const matchC = cat === 'all' || d.category === cat
    return matchQ && matchC
  })

  const stock  = d => d.stock_level ?? d.quantity ?? 0
  const price  = d => d.price_ngn ?? d.unit_price ?? 0
  const lowStock = drugs.filter(d => stock(d) <= d.reorder_level)

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {lowStock.length > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 16 }}>
          <Icon name="alert-triangle" size={18} />
          <div><strong>{lowStock.length} drug{lowStock.length !== 1 ? 's' : ''}</strong> below reorder level: {lowStock.slice(0, 5).map(d => d.name).join(', ')}{lowStock.length > 5 ? '…' : ''}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search drug name, generic, brand…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 200 }} value={cat} onChange={e => setCat(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} drugs</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Generic</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Form / Strength</th>
              <th>Unit Price</th>
              <th>Stock</th>
              <th>Formulary</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              editing === d.id ? (
                <tr key={d.id} style={{ background: 'var(--lw-grey-bg)' }}>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.generic_name || ''} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.brand_name || ''} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12 }} value={form.strength || ''} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} /></td>
                  <td><input className="input" type="number" style={{ fontSize: 12, width: 100 }} value={form.price_ngn ?? form.unit_price ?? ''} onChange={e => setForm(f => ({ ...f, price_ngn: +e.target.value }))} /></td>
                  <td><input className="input" type="number" style={{ fontSize: 12, width: 80 }} value={form.stock_level ?? form.quantity ?? ''} onChange={e => setForm(f => ({ ...f, stock_level: +e.target.value }))} /></td>
                  <td><input className="input" style={{ fontSize: 12, width: 60 }} value={form.formulary || ''} onChange={e => setForm(f => ({ ...f, formulary: e.target.value }))} /></td>
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
                  <td style={{ color: 'var(--lw-muted)', fontSize: 12.5 }}>{d.generic_name || '—'}</td>
                  <td style={{ fontSize: 12.5 }}>{d.brand_name || <span style={{ color: 'var(--lw-muted)' }}>Generic</span>}</td>
                  <td style={{ fontSize: 12 }}>{d.category}</td>
                  <td style={{ fontSize: 12 }}>{d.form}{d.strength ? ` · ${d.strength}` : ''}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(price(d))}</td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 13, color: stock(d) <= d.reorder_level ? 'var(--s-danger)' : 'var(--lw-charcoal)' }}>
                      {stock(d)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--lw-muted)', marginLeft: 4 }}>{d.unit}</span>
                  </td>
                  <td>
                    <Pill kind={d.formulary === 'A' ? 'success' : d.formulary === 'B' ? 'warn' : 'default'}>
                      {d.formulary || '—'}
                    </Pill>
                  </td>
                  <td>
                    <Pill kind={stock(d) <= d.reorder_level ? 'danger' : stock(d) <= d.reorder_level * 2 ? 'warn' : 'success'}>
                      {stock(d) <= d.reorder_level ? 'Low' : stock(d) <= d.reorder_level * 2 ? 'Watch' : 'OK'}
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
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No drugs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
