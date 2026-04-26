import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, Pill, fmtMoney } from '../components/ui'

const WEEKS = ['Week 15 (Apr 7–13)', 'Week 16 (Apr 14–18)']

export default function Payouts({ setToast }) {
  const [riders, setRiders]     = useState([])
  const [week, setWeek]         = useState(WEEKS[1])
  const [paying, setPaying]     = useState(new Set())
  const [paid, setPaid]         = useState(new Set())
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    fetch(API_BASE + '/api/riders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setRiders(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const payOne = async (id) => {
    setPaying(s => new Set([...s, id]))
    await new Promise(r => setTimeout(r, 900))
    setPaid(s => new Set([...s, id]))
    setPaying(s => { const n = new Set(s); n.delete(id); return n })
    const r = riders.find(x => x.id === id)
    setToast(`₦${(r?.deliveries * 1200).toLocaleString()} paid to ${r?.name}`)
  }

  const payAll = async () => {
    const unpaid = riders.filter(r => r.active && !paid.has(r.id))
    for (const r of unpaid) await payOne(r.id)
    setToast('All rider payouts processed')
  }

  const perDelivery = 1200
  const totalPayout = riders.filter(r => r.active).reduce((s, r) => s + r.deliveries * perDelivery, 0)
  const paidCount   = paid.size

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Payout', value: fmtMoney(totalPayout), color: 'var(--lw-charcoal)', icon: 'banknote' },
          { label: 'Riders',       value: riders.filter(r => r.active).length, color: '#2563EB', icon: 'bike' },
          { label: 'Paid Out',     value: paidCount, color: 'var(--s-success)', icon: 'check-circle-2' },
        ].map(t => (
          <div key={t.label} style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--lw-grey-line)', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name={t.icon} size={22} style={{ color: t.color }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <select className="input" style={{ width: 220 }} value={week} onChange={e => setWeek(e.target.value)}>
          {WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={payAll} disabled={paidCount === riders.filter(r => r.active).length}>
          <Icon name="banknote" size={14} /> Pay all riders
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Rider</th>
              <th>Zone</th>
              <th>Deliveries</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Success %</th>
              <th>Bank</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {riders.filter(r => r.active).map(r => {
              const amount = r.deliveries * perDelivery
              const isPaid = paid.has(r.id)
              const isPaying = paying.has(r.id)
              return (
                <tr key={r.id} style={{ opacity: isPaid ? 0.6 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={r.name} size={28} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{r.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{r.zone}</td>
                  <td style={{ fontWeight: 700, fontSize: 13 }}>{r.deliveries}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{fmtMoney(perDelivery)}/delivery</td>
                  <td style={{ fontWeight: 700, fontSize: 13 }}>{fmtMoney(amount)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="prog" style={{ width: 50 }}>
                        <div style={{ width: `${r.success}%`, background: r.success >= 90 ? 'var(--s-success)' : 'var(--s-warn)' }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{r.success}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{r.bank || 'GTB'} ···{r.account_no?.slice(-4) || '0000'}</td>
                  <td>
                    {isPaid ? (
                      <Pill kind="success"><Icon name="check" size={11} /> Paid</Pill>
                    ) : (
                      <button className="btn btn--primary btn--sm" onClick={() => payOne(r.id)} disabled={isPaying}>
                        {isPaying ? <Icon name="loader-circle" size={13} /> : <Icon name="banknote" size={13} />}
                        {isPaying ? 'Paying…' : 'Pay'}
                      </button>
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
