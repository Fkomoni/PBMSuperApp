import { useState, useEffect } from 'react'
import { Icon, Avatar, Pill, Modal, fmtMoney } from '../components/ui'

const BLANK    = { name: '', phone: '', zone: '', vehicle: 'Motorcycle', bank: '', account_no: '', rider_id: '' }
const ZONES    = ['Ikeja', 'Lekki', 'Surulere', 'VI', 'Ikorodu', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano']
const VEHICLES = ['Motorcycle', 'Bicycle', 'Van', 'Car']

const PER_DELIVERY = 1200

export default function Riders({ setToast }) {
  const [riders, setRiders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [addModal, setAddModal]     = useState(false)
  const [editModal, setEditModal]   = useState(null)   // rider object being edited
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm]             = useState(BLANK)
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch('/api/riders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        // enrich seed data with on_time + rider_id if absent
        setRiders(d.map((r, i) => ({
          on_time: 90 + Math.floor(Math.random() * 9),
          rider_id: `RD-${String(i + 1).padStart(3, '0')}`,
          ...r,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── KPI summary ────────────────────────────────────────────────
  const active    = riders.filter(r => r.active)
  const avgSuccess = active.length ? Math.round(active.reduce((s, r) => s + r.success, 0) / active.length * 10) / 10 : 0
  const avgOnTime  = active.length ? Math.round(active.reduce((s, r) => s + (r.on_time || 92), 0) / active.length * 10) / 10 : 0
  const payoutDue  = active.reduce((s, r) => s + r.deliveries * PER_DELIVERY, 0)

  // ── Mutations ──────────────────────────────────────────────────
  const saveNew = async () => {
    if (!form.name || !form.phone || !form.zone) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    const newRider = {
      id: Date.now(), ...form, active: true, deliveries: 0,
      rating: 5.0, success: 100, on_time: 100,
      rider_id: `RD-${String(riders.length + 1).padStart(3, '0')}`,
    }
    setRiders(prev => [...prev, newRider])
    setToast(`Rider ${form.name} added`)
    setAddModal(false)
    setForm(BLANK)
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!form.name || !form.zone) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 500))
    setRiders(prev => prev.map(r => r.id === editModal.id ? { ...r, ...form } : r))
    setToast('Rider record updated')
    setEditModal(null)
    setSaving(false)
  }

  const openEdit = (r) => { setForm({ name: r.name, phone: r.phone, zone: r.zone, vehicle: r.vehicle || 'Motorcycle', bank: r.bank || '', account_no: r.account_no || '', rider_id: r.rider_id || '' }); setEditModal(r) }

  const toggleActive = (id) => {
    setRiders(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
    const r = riders.find(x => x.id === id)
    setToast(`${r?.name} ${r?.active ? 'deactivated' : 'reactivated'}`)
  }

  const confirmDelete = () => {
    setRiders(prev => prev.filter(r => r.id !== deleteTarget.id))
    setToast(`${deleteTarget.name} removed from fleet`)
    setDeleteTarget(null)
  }

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = riders.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.name.toLowerCase().includes(q) || (r.zone || '').toLowerCase().includes(q) || (r.rider_id || '').toLowerCase().includes(q)
    const matchF = filter === 'all' || (filter === 'active' ? r.active : !r.active)
    return matchQ && matchF
  })

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active riders',    value: active.length,           icon: 'bike',           color: '#2563EB', bg: '#E6EEFE' },
          { label: 'Avg success rate', value: `${avgSuccess}%`,        icon: 'check-circle-2', color: 'var(--s-success)', bg: 'var(--s-success-bg)', delta: '+1.2pts' },
          { label: 'Avg on-time',      value: `${avgOnTime}%`,         icon: 'clock',          color: 'var(--s-warn)', bg: 'var(--s-warn-bg)', delta: 'steady' },
          { label: 'Payouts due',      value: fmtMoney(payoutDue),     icon: 'wallet',         color: '#7C3AED', bg: '#EEE6F8', delta: 'this week' },
        ].map(t => (
          <div key={t.label} style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid var(--lw-grey-line)', background: '#fff' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon name={t.icon} size={20} style={{ color: t.color }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginBottom: 2 }}>{t.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lw-charcoal)', lineHeight: 1 }}>{t.value}</div>
            {t.delta && (
              <div style={{ fontSize: 11, color: t.color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-up" size={11} /> {t.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search rider, zone or ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg">
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} className={`seg__btn${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => { setForm(BLANK); setAddModal(true) }}>
          <Icon name="plus" size={14} /> Add rider
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Rider</th>
              <th>Zone</th>
              <th>Phone</th>
              <th>Bank / Acct</th>
              <th>Deliveries</th>
              <th>Success</th>
              <th>On-time</th>
              <th>Rating</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar name={r.name} size={32} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{r.rider_id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12.5 }}>{r.zone}</td>
                <td style={{ fontSize: 12.5 }}>{r.phone || '—'}</td>
                <td style={{ fontSize: 12 }}>
                  {r.bank ? <><span style={{ fontWeight: 600 }}>{r.bank}</span><br /><span style={{ color: 'var(--lw-muted)', fontFamily: 'monospace' }}>{r.account_no}</span></> : '—'}
                </td>
                <td style={{ fontWeight: 700, fontSize: 13 }}>{r.deliveries}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Pill kind={r.success >= 95 ? 'success' : r.success >= 88 ? 'warn' : 'danger'}>{r.success}%</Pill>
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>{r.on_time || 92}%</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
                    <Icon name="star" size={12} style={{ color: 'var(--lw-orange)' }} />
                    {r.rating}
                  </div>
                </td>
                <td>
                  <Pill kind={r.active ? 'success' : 'default'}>{r.active ? 'Active' : 'Inactive'}</Pill>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button className="btn btn--ghost btn--sm" title="Edit" onClick={() => openEdit(r)}>
                      <Icon name="pencil" size={13} />
                    </button>
                    <button className="btn btn--ghost btn--sm" title={r.active ? 'Deactivate' : 'Reactivate'} onClick={() => toggleActive(r.id)}>
                      <Icon name={r.active ? 'pause' : 'play'} size={13} />
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ color: 'var(--s-danger)' }} title="Delete rider" onClick={() => setDeleteTarget(r)}>
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 40 }}>
                  No riders match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {addModal && (
        <Modal title="Add New Rider" onClose={() => setAddModal(false)}>
          <RiderForm form={form} setForm={setForm} saving={saving} onSave={saveNew}
            onCancel={() => setAddModal(false)} label="Add Rider" />
        </Modal>
      )}

      {/* Edit Modal */}
      {editModal && (
        <Modal title={`Edit — ${editModal.name}`} onClose={() => setEditModal(null)}>
          <RiderForm form={form} setForm={setForm} saving={saving} onSave={saveEdit}
            onCancel={() => setEditModal(null)} label="Save changes" />
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="drawer-overlay" onClick={() => setDeleteTarget(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, maxWidth: 400, width: '90%', margin: 'auto', marginTop: '25vh', boxShadow: 'var(--sh-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--s-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="trash-2" size={24} style={{ color: 'var(--s-danger)' }} />
            </div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Remove {deleteTarget.name}?</div>
              <div style={{ fontSize: 13, color: 'var(--lw-muted)', lineHeight: 1.5 }}>
                This will permanently remove the rider from the fleet. Their past delivery records will be preserved in the audit log.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--s-danger)', color: '#fff', border: 'none' }} onClick={confirmDelete}>
                <Icon name="trash-2" size={14} /> Delete rider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RiderForm({ form, setForm, saving, onSave, onCancel, label }) {
  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>Full name *</label>
          <input className="input" value={form.name} onChange={f('name')} placeholder="e.g. Chidi Okafor" />
        </div>
        <div className="field">
          <label>Rider ID</label>
          <input className="input" value={form.rider_id} onChange={f('rider_id')} placeholder="Auto-assigned" />
        </div>
        <div className="field">
          <label>Phone number *</label>
          <input className="input" type="tel" value={form.phone} onChange={f('phone')} placeholder="+234…" />
        </div>
        <div className="field">
          <label>Zone *</label>
          <select className="input" value={form.zone} onChange={f('zone')}>
            <option value="">Select zone</option>
            {['Ikeja', 'Lekki', 'Surulere', 'VI', 'Ikorodu', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano'].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Vehicle type</label>
          <select className="input" value={form.vehicle} onChange={f('vehicle')}>
            {['Motorcycle', 'Bicycle', 'Van', 'Car'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Bank name</label>
          <input className="input" value={form.bank} onChange={f('bank')} placeholder="e.g. GTBank" />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Account number</label>
          <input className="input" value={form.account_no} onChange={f('account_no')} placeholder="10-digit NUBAN" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={onSave} disabled={saving || !form.name || !form.zone}>
          {saving && <Icon name="loader-circle" size={14} />}
          {saving ? 'Saving…' : label}
        </button>
      </div>
    </div>
  )
}
