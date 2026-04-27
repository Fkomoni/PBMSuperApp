import { useState, useEffect } from 'react'
import { Icon, Avatar, StatusPill, Pill } from '../components/ui'

const STAGES = ['Order Placed', 'Packed', 'Assigned', 'Out for Delivery', 'Delivered']

const MOCK_TRACKING = [
  { id: 'DEL-001', member: 'Amina Bello',       plan_id: 'LH-LG-0001', rider: 'Chidi Okafor',  zone: 'Ikeja',    stage: 3, last_update: '13:45', eta: '14:30', phone: '0801-234-5678' },
  { id: 'DEL-002', member: 'Emeka Nwosu',        plan_id: 'LH-LG-0005', rider: 'Musa Abdullahi',zone: 'Lekki',    stage: 3, last_update: '14:02', eta: '15:00', phone: '0802-345-6789' },
  { id: 'DEL-003', member: 'Ngozi Adeyemi',      plan_id: 'LH-LG-0009', rider: 'Emeka Obi',    zone: 'Surulere', stage: 4, last_update: '12:20', eta: 'Done',  phone: '0803-456-7890' },
  { id: 'DEL-004', member: 'Taiwo Ogundimu',     plan_id: 'LH-LG-0013', rider: 'Chidi Okafor',  zone: 'Ikeja',    stage: 2, last_update: '14:10', eta: '15:45', phone: '0804-567-8901' },
  { id: 'DEL-005', member: 'Fatima Al-Hassan',   plan_id: 'LH-AB-0034', rider: 'Yusuf Danjuma', zone: 'Abuja',    stage: 3, last_update: '13:55', eta: '15:15', phone: '0805-678-9012' },
  { id: 'DEL-006', member: 'Chukwuemeka Obi',    plan_id: 'LH-NW-0089', rider: 'Emeka Obi',    zone: 'Surulere', stage: 1, last_update: '14:15', eta: '16:00', phone: '0806-789-0123' },
]

function TrackCard({ item, onSelect, selected }) {
  const stage = STAGES[item.stage]
  const isOut = item.stage === 3
  const isDone = item.stage === 4

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', borderColor: selected ? 'var(--lw-red)' : undefined, boxShadow: selected ? 'var(--sh-md)' : undefined }}
      onClick={() => onSelect(item)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={item.member} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }} className="truncate">{item.member}</div>
          <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{item.plan_id}</div>
        </div>
        <Pill kind={isDone ? 'success' : isOut ? 'warn' : 'default'}>
          {isDone ? 'Delivered' : isOut ? 'In Transit' : stage}
        </Pill>
      </div>

      {/* Mini progress */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {STAGES.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= item.stage ? 'var(--lw-red)' : 'var(--lw-grey-line)' }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <Icon name="bike" size={13} style={{ color: 'var(--lw-muted)' }} />
        <span style={{ color: 'var(--lw-muted)', flex: 1 }}>{item.rider}</span>
        <span style={{ color: 'var(--lw-muted)' }}>ETA {item.eta}</span>
      </div>
    </div>
  )
}

export default function Tracking({ setToast }) {
  const [items] = useState(MOCK_TRACKING)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')

  const filtered = items.filter(i => {
    if (filter === 'in-transit') return i.stage === 3
    if (filter === 'delivered')  return i.stage === 4
    if (filter === 'packing')    return i.stage <= 2
    return true
  })

  const inTransit = items.filter(i => i.stage === 3).length
  const delivered = items.filter(i => i.stage === 4).length

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'In Transit', count: inTransit, color: 'var(--s-warn)', bg: 'var(--s-warn-bg)', icon: 'truck' },
          { label: 'Delivered',  count: delivered, color: 'var(--s-success)', bg: 'var(--s-success-bg)', icon: 'check-circle-2' },
          { label: 'Total',      count: items.length, color: '#2563EB', bg: '#E6EEFE', icon: 'package' },
        ].map(t => (
          <div key={t.label} style={{ padding: '12px 16px', borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name={t.icon} size={20} style={{ color: t.color }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.count}</div>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="seg">
          {[['all', 'All'], ['in-transit', 'In Transit'], ['packing', 'Packing'], ['delivered', 'Delivered']].map(([k, l]) => (
            <button key={k} className={`seg__btn${filter === k ? ' is-active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map(item => (
            <TrackCard key={item.id} item={item} onSelect={setSelected} selected={selected?.id === item.id} />
          ))}
        </div>

        {selected && (
          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)' }}>Delivery Detail</div>
              <button className="top__icon-btn" onClick={() => setSelected(null)}><Icon name="x" size={16} /></button>
            </div>

            {/* Stage tracker */}
            <div style={{ marginBottom: 20 }}>
              {STAGES.map((s, i) => (
                <div key={s} style={{ display: 'flex', gap: 12, paddingBottom: i < STAGES.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: i <= selected.stage ? 'var(--lw-red)' : 'var(--lw-grey-line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {i < selected.stage && <Icon name="check" size={11} style={{ color: '#fff' }} />}
                      {i === selected.stage && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    {i < STAGES.length - 1 && <div style={{ width: 2, flex: 1, background: i < selected.stage ? 'var(--lw-red)' : 'var(--lw-grey-line)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: i === selected.stage ? 700 : 400, color: i <= selected.stage ? 'var(--lw-charcoal)' : 'var(--lw-muted)' }}>{s}</div>
                    {i === selected.stage && <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>Last update: {selected.last_update}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['Delivery ID', selected.id], ['Rider', selected.rider], ['Zone', selected.zone], ['ETA', selected.eta]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 10px', background: 'var(--lw-grey-bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lw-muted)' }}>{l}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v}</div>
                </div>
              ))}
            </div>

            <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setToast(`SMS sent to ${selected.member}`); }}>
              <Icon name="message-circle" size={14} /> Send SMS update
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
