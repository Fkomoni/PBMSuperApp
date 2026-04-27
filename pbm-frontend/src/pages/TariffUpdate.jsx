import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Pill, fmtMoney } from '../components/ui'

export default function TariffUpdate({ setToast, role }) {
  const [drugs, setDrugs]     = useState([])
  const [changes, setChanges] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [pctInput, setPctInput] = useState('')

  useEffect(() => {
    fetch(API_BASE + '/api/drugs', { credentials: 'include' })
      .then(r => r.json()).then(d => { setDrugs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const setPrice = (id, val) => {
    const num = parseFloat(val)
    setChanges(c => ({ ...c, [id]: isNaN(num) ? undefined : num }))
  }

  const applyPct = () => {
    const pct = parseFloat(pctInput)
    if (isNaN(pct)) return
    const next = {}
    filtered.forEach(d => { next[d.id] = Math.round(((d.price_ngn ?? d.unit_price ?? 0) * (1 + pct / 100)) / 5) * 5 })
    setChanges(c => ({ ...c, ...next }))
    setPctInput('')
  }

  const saveAll = async () => {
    const payload = Object.entries(changes).filter(([, v]) => v !== undefined).map(([id, price]) => ({ id, price_ngn: price }))
    if (payload.length === 0) { setToast('No changes to save', 'warn'); return }
    setSaving(true)
    try {
      await fetch(API_BASE + '/api/drugs/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      setDrugs(prev => prev.map(d => changes[d.id] !== undefined ? { ...d, price_ngn: changes[d.id] } : d))
      setChanges({})
      setToast(`${payload.length} tariff${payload.length !== 1 ? 's' : ''} updated`)
    } catch {
      setToast('Failed to save — please retry', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = drugs.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.generic_name || '').toLowerCase().includes(search.toLowerCase()))
  const changedCount = Object.values(changes).filter(v => v !== undefined).length

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div className="banner banner--warn" style={{ marginBottom: 16 }}>
        <Icon name="shield" size={18} />
        <div>Tariff changes are <strong>audit-logged</strong> and require admin access. All updates are effective immediately.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search drug…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="input" type="number" placeholder="% change" value={pctInput} onChange={e => setPctInput(e.target.value)} style={{ width: 110 }} />
          <button className="btn btn--ghost btn--sm" onClick={applyPct} disabled={!pctInput}>Apply %</button>
        </div>
        <button className="btn btn--primary" onClick={saveAll} disabled={saving || changedCount === 0}>
          {saving ? <Icon name="loader-circle" size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving…' : `Save ${changedCount > 0 ? `(${changedCount})` : 'changes'}`}
        </button>
        {changedCount > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setChanges({})}>Reset all</button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Drug</th>
              <th>Generic</th>
              <th>Strength</th>
              <th>Current Price</th>
              <th>New Price</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const newPrice = changes[d.id]
              const curPrice = d.price_ngn ?? d.unit_price ?? 0
              const diff     = newPrice !== undefined ? newPrice - curPrice : 0
              const pct      = curPrice > 0 ? (diff / curPrice) * 100 : 0
              return (
                <tr key={d.id} style={{ background: newPrice !== undefined ? 'rgba(246,165,36,.05)' : 'transparent' }}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{d.name}</div>
                    {d.brand_name && <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Brand: {d.brand_name}</div>}
                  </td>
                  <td style={{ color: 'var(--lw-muted)', fontSize: 12.5 }}>{d.generic_name || '—'}</td>
                  <td style={{ fontSize: 12.5 }}>{d.form}{d.strength ? ` · ${d.strength}` : ''}</td>
                  <td style={{ fontSize: 13 }}>{fmtMoney(curPrice)}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      style={{ width: 110, fontSize: 12, border: newPrice !== undefined ? '1px solid var(--s-warn)' : undefined }}
                      value={newPrice !== undefined ? newPrice : ''}
                      placeholder={String(curPrice)}
                      onChange={e => setPrice(d.id, e.target.value)}
                    />
                  </td>
                  <td>
                    {newPrice !== undefined && (
                      <Pill kind={diff > 0 ? 'danger' : diff < 0 ? 'success' : 'default'}>
                        {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
                      </Pill>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
