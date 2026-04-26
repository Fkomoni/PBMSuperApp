import { useState, useEffect } from 'react'
import { Icon, Avatar, Pill, Modal } from '../components/ui'

const BLANK = { name: '', phone: '', zone: '', vehicle: 'Motorcycle', bank: '', account_no: '' }
const ZONES  = ['Ikeja', 'Lekki', 'Surulere', 'VI', 'Ikorodu', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano']
const VEHICLES = ['Motorcycle', 'Bicycle', 'Van', 'Car']

export default function Riders({ setToast }) {
  const [riders, setRiders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(BLANK)
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch('/api/riders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setRiders(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!form.name || !form.phone || !form.zone) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    const newRider = { id: Date.now(), ...form, active: true, deliveries: 0, rating: 5.0, success: 100 }
    setRiders(prev => [...prev, newRider])
    setToast(`Rider ${form.name} added`)
    setModal(false)
    setForm(BLANK)
    setSaving(false)
  }

  const toggleActive = (id) => {
    setRiders(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
    const r = riders.find(x => x.id === id)
    setToast(`${r?.name} ${r?.active ? 'deactivated' : 'activated'}`)
  }

  const filtered = riders.filter(r => filter === 'all' || (filter === 'active' ? r.active : !r.active))

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div className="seg">
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} className={`seg__btn${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={() => setModal(true)}>
          <Icon name="plus" size={14} /> Add Rider
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map(r => (
          <div key={r.id} className="card" style={{ opacity: r.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name={r.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{r.phone}</div>
              </div>
              <Pill kind={r.active ? 'success' : 'default'}>{r.active ? 'Active' : 'Inactive'}</Pill>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[['Zone', r.zone], ['Vehicle', r.vehicle || 'Motorcycle'], ['Deliveries', r.deliveries], ['Rating', `${r.rating}★`]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 10px', background: 'var(--lw-grey-bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lw-muted)' }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div className="prog" style={{ flex: 1 }}>
                <div style={{ width: `${r.success}%`, background: r.success >= 90 ? 'var(--s-success)' : 'var(--s-warn)' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--lw-muted)', whiteSpace: 'nowrap' }}>{r.success}% success</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn--ghost btn--sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => toggleActive(r.id)}>
                <Icon name={r.active ? 'pause' : 'play'} size={13} /> {r.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Add New Rider" onClose={() => { setModal(false); setForm(BLANK) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['name', 'Full name', 'text'], ['phone', 'Phone number', 'tel']].map(([k, l, t]) => (
              <div key={k} className="field">
                <label>{l}</label>
                <input className="input" type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="field">
              <label>Zone</label>
              <select className="input" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                <option value="">Select zone</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Vehicle type</label>
              <select className="input" value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}>
                {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {[['bank', 'Bank name'], ['account_no', 'Account number']].map(([k, l]) => (
              <div key={k} className="field">
                <label>{l}</label>
                <input className="input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn--ghost" onClick={() => { setModal(false); setForm(BLANK) }}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={saving || !form.name || !form.zone}>
                {saving ? <Icon name="loader-circle" size={14} /> : null}
                {saving ? 'Adding…' : 'Add Rider'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
