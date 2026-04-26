import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Pill, Modal } from '../components/ui'

const BLANK_RULE = { generic: '', brand: '', rule: 'substitution-required', note: '', active: true }
const RULE_TYPES = [
  { value: 'substitution-required', label: 'Substitution Required' },
  { value: 'prior-auth',            label: 'Prior Authorisation' },
  { value: 'quantity-limit',        label: 'Quantity Limit' },
  { value: 'step-therapy',          label: 'Step Therapy' },
  { value: 'not-covered',           label: 'Not Covered' },
]

export default function BrandWarnings({ setToast, role }) {
  const [rules, setRules]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(BLANK_RULE)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch(API_BASE + '/api/scheme-rules', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setRules(d); setLoading(false) }).catch(() => { setRules(MOCK_RULES); setLoading(false) })
  }, [])

  const save = () => {
    if (!form.generic) return
    const newRule = { id: Date.now(), ...form }
    setRules(prev => [...prev, newRule])
    setToast('Brand warning rule added')
    setModal(false)
    setForm(BLANK_RULE)
  }

  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
    const r = rules.find(x => x.id === id)
    setToast(`Rule ${r?.active ? 'deactivated' : 'activated'}`)
  }

  const deleteRule = (id) => {
    setRules(prev => prev.filter(r => r.id !== id))
    setToast('Rule deleted')
  }

  const filtered = rules.filter(r => !search || r.generic.toLowerCase().includes(search.toLowerCase()) || (r.brand || '').toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div className="banner banner--warn" style={{ marginBottom: 16 }}>
        <Icon name="shield" size={18} />
        <div>Brand warning rules are enforced at point of dispensing. Changes take effect immediately for all pharmacists.</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search generic or brand…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn--primary" onClick={() => { setModal(true); setForm(BLANK_RULE) }}>
          <Icon name="plus" size={14} /> Add Rule
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Generic Name</th>
              <th>Brand Name</th>
              <th>Rule Type</th>
              <th>Note</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{r.generic}</td>
                <td style={{ fontSize: 12.5 }}>{r.brand || '—'}</td>
                <td>
                  <Pill kind={r.rule === 'not-covered' ? 'danger' : r.rule === 'prior-auth' ? 'warn' : 'default'}>
                    {RULE_TYPES.find(t => t.value === r.rule)?.label || r.rule}
                  </Pill>
                </td>
                <td style={{ fontSize: 12, color: 'var(--lw-muted)', maxWidth: 240 }} className="truncate">{r.note || '—'}</td>
                <td><Pill kind={r.active ? 'success' : 'default'}>{r.active ? 'Active' : 'Inactive'}</Pill></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => toggleRule(r.id)}>
                      <Icon name={r.active ? 'pause' : 'play'} size={13} />
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-danger)' }} onClick={() => deleteRule(r.id)}>
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No rules found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title="Add Brand Warning Rule" onClose={() => { setModal(false); setForm(BLANK_RULE) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>Generic drug name *</label>
              <input className="input" value={form.generic} onChange={e => setForm(f => ({ ...f, generic: e.target.value }))} placeholder="e.g. Atorvastatin" />
            </div>
            <div className="field">
              <label>Brand name (optional)</label>
              <input className="input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Lipitor" />
            </div>
            <div className="field">
              <label>Rule type *</label>
              <select className="input" value={form.rule} onChange={e => setForm(f => ({ ...f, rule: e.target.value }))}>
                {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Note / reason</label>
              <textarea className="input" rows={3} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Clinical or scheme reason…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => { setModal(false); setForm(BLANK_RULE) }}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={!form.generic}>Add Rule</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const MOCK_RULES = [
  { id: 1, generic: 'Metformin',     brand: 'Glucophage',  rule: 'substitution-required', note: 'Generic preferred per scheme formulary', active: true },
  { id: 2, generic: 'Atorvastatin',  brand: 'Lipitor',     rule: 'substitution-required', note: 'Generic bioequivalent approved by NAFDAC', active: true },
  { id: 3, generic: 'Sitagliptin',   brand: 'Januvia',     rule: 'prior-auth',            note: 'Requires specialist justification and PA from HMO', active: true },
  { id: 4, generic: 'Insulin Glargine', brand: 'Lantus',   rule: 'quantity-limit',        note: 'Max 2 vials/month per benefit schedule', active: true },
  { id: 5, generic: 'Sildenafil',    brand: 'Viagra',      rule: 'not-covered',           note: 'Excluded from all standard plans', active: true },
  { id: 6, generic: 'Rosuvastatin',  brand: null,          rule: 'step-therapy',          note: 'Must fail Atorvastatin 40mg first', active: false },
]
