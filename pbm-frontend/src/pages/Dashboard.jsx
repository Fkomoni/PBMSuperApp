import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { KpiTile, BarChart, Donut, Sparkline, Pill, Icon, Avatar, StatusPill, fmtDate, fmtMoney, daysBetween } from '../components/ui'

const TODAY = new Date('2026-04-18')
const COHORT_COLORS = { diabetes: '#2563EB', hypertension: '#C8102E', cardio: '#F47A1F', asthma: '#7C3AED', renal: '#0E9488', thyroid: '#F6A524', arthritis: '#6B7280' }

export default function Dashboard({ onNavigate, setToast }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(API_BASE + '/api/dashboard', { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading dashboard…</div>

  const { enrollees = [], riders = [], acute_orders = [] } = data
  const active    = enrollees.length
  const packed    = enrollees.filter(e => e.status === 'Packed' || e.status === 'Assigned').length
  const delivered = enrollees.filter(e => e.status === 'Delivered').length
  const ood       = enrollees.filter(e => e.status === 'Out for Delivery').length
  const awaiting  = enrollees.filter(e => e.status === 'Awaiting Pack' || e.status === 'Packing').length
  const incomplete= enrollees.filter(e => e.status === 'Incomplete').length
  const adhHi     = enrollees.filter(e => e.adherence >= 85).length
  const adhMid    = enrollees.filter(e => e.adherence >= 70 && e.adherence < 85).length
  const adhLow    = enrollees.filter(e => e.adherence < 70).length

  const upcoming = enrollees
    .map(e => ({ e, days: daysBetween(TODAY, e.next_refill) }))
    .filter(x => x.days >= 0 && x.days <= 14)
    .sort((a, b) => a.days - b.days).slice(0, 6)

  const cohortCount = {}
  enrollees.forEach(e => { cohortCount[e.cohort] = (cohortCount[e.cohort] || 0) + 1 })
  const cohortList = Object.entries(cohortCount).sort((a, b) => b[1] - a[1])

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, color: 'var(--lw-muted)', marginBottom: 2 }}>Saturday, 18 April 2026 · Abuja</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--lw-charcoal)' }}>Welcome back.</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--lw-muted)', fontSize: 14 }}>
          <strong style={{ color: 'var(--lw-charcoal)' }}>{upcoming.length}</strong> refills in next 14 days ·{' '}
          <strong style={{ color: 'var(--s-warn)' }}>{awaiting}</strong> awaiting pack ·{' '}
          <strong style={{ color: 'var(--s-danger)' }}>{incomplete}</strong> incomplete
        </p>
      </div>

      <div className="kpis">
        <KpiTile kind="blue"   icon="users-round"   label="Active Enrollees"   value={active}    delta="+12 this week"          deltaKind="up" spark={[18,22,20,26,28,30,32,34,38,42,44,46]} />
        <KpiTile kind="amber"  icon="package"        label="Awaiting Pack"      value={awaiting}  delta="3 overdue"               deltaKind="dn" spark={[4,6,8,10,9,11,14,12,10,8,9,11]} />
        <KpiTile kind="green"  icon="truck"          label="Out for Delivery"   value={ood}       delta={`${delivered} delivered`} deltaKind="up" spark={[2,3,5,6,4,7,8,10,9,11,12,14]} />
        <KpiTile kind="purple" icon="receipt-text"   label="Claims This Month"  value="₦48.2M"   delta="+18.4% MoM"              deltaKind="up" spark={[12,14,18,20,22,26,24,28,32,34,38,42]} />
      </div>

      {/* Alert banners */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="banner banner--warn" style={{ margin: 0 }}>
          <Icon name="alert-triangle" size={18} />
          <div><strong>3 cold-chain shipments</strong> need courier pickup before 14:00 today.</div>
        </div>
        <div className="banner banner--danger" style={{ margin: 0 }}>
          <Icon name="pill" size={18} />
          <div><strong>Lisinopril 10mg</strong> below reorder level (34 units).</div>
        </div>
        <div className="banner banner--info" style={{ margin: 0 }}>
          <Icon name="sparkles" size={18} />
          <div><strong>2 possible duplicate claims</strong> detected by AI review.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card__head">
            <div><h3>Delivery Performance</h3><div className="sub">Last 12 weeks</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[['var(--lw-red)','Delivered','1,284'],['var(--lw-orange)','Out','86'],['#D1D5DB','Packed','142']].map(([c,l,v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                  <span style={{ color: 'var(--lw-muted)', flex: 1 }}>{l}</span>
                  <span style={{ fontWeight: 700, color: 'var(--lw-charcoal)' }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--lw-muted)' }}>Success rate</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--lw-charcoal)' }}>96.4%</div>
              <Pill kind="success" icon="trending-up">+2.1 pts</Pill>
            </div>
            <BarChart data={[82,95,110,88,124,132,118,140,156,148,162,178]} labels={['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12']} />
          </div>
        </div>

        <div className="card">
          <div className="card__head"><div><h3>Chronic Cohorts</h3><div className="sub">By diagnosis</div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Donut size={130} thickness={16}
              segments={cohortList.map(([k, v]) => ({ v, c: COHORT_COLORS[k] || '#999' }))}
              centerLabel={{ v: active, l: 'Enrollees' }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {cohortList.slice(0, 5).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: COHORT_COLORS[k] }} />
                  <span style={{ flex: 1, textTransform: 'capitalize', color: 'var(--lw-ink)' }}>{k}</span>
                  <span style={{ color: 'var(--lw-muted)' }}>{v}</span>
                </div>
              ))}
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => onNavigate('enrollees-lagos')}>
                View all <Icon name="arrow-right" size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Adherence */}
        <div className="card">
          <div className="card__head">
            <div><h3>Adherence Scoring</h3><div className="sub">Based on refill pickup history</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[['On track', adhHi, 'var(--s-success)', '≥ 85%'],['At risk', adhMid, 'var(--s-warn)', '70–84%'],['Critical', adhLow, 'var(--s-danger)', '< 70%']].map(([l, v, c, s]) => (
              <div key={l} style={{ padding: 14, border: '1px solid var(--lw-grey-line)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--lw-muted)', fontWeight: 600 }}>{l}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 6 }}>{s}</div>
                <div className="prog prog--thin"><div style={{ width: Math.round((v / Math.max(1, active)) * 100) + '%', background: c }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming refills */}
        <div className="card">
          <div className="card__head">
            <div><h3>Upcoming Refills · Next 14 Days</h3><div className="sub">{upcoming.length} members</div></div>
            <button className="btn btn--primary btn--sm" onClick={() => onNavigate('pack')}>
              <Icon name="package" size={13} /> Start packing
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {upcoming.map(({ e, days }) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--lw-grey-line-2)' }}>
                <Avatar name={e.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }} className="truncate">{e.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{e.diagnosis} · {e.state}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: days <= 3 ? 'var(--s-danger)' : days <= 7 ? 'var(--s-warn)' : 'var(--lw-ink)' }}>in {days}d</div>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{fmtDate(e.next_refill)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card__head"><div><h3>Today's Operations</h3><div className="sub">Click a stage to jump in</div></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { page: 'pending',  icon: 'user-round-plus', color: '#2563EB', bg: '#E6EEFE', label: 'New Requests', value: '4',      sub: 'Walk-in + web' },
              { page: 'pack',     icon: 'package',         color: 'var(--s-warn)', bg: 'var(--s-warn-bg)', label: 'To Pack', value: awaiting, sub: 'wizard ready' },
              { page: 'logistics',icon: 'user-round-check',color: '#7C3AED', bg: '#EEE6F8', label: 'To Assign', value: packed,   sub: 'awaiting rider' },
              { page: 'tracking', icon: 'truck',           color: 'var(--lw-orange)', bg: '#FDF4E2', label: 'In Transit', value: ood, sub: 'live tracking' },
              { page: 'claims',   icon: 'check-check',    color: 'var(--s-success)', bg: 'var(--s-success-bg)', label: 'Delivered', value: delivered, sub: 'auto-filed' },
            ].map(p => (
              <div key={p.page} onClick={() => onNavigate(p.page)}
                style={{ cursor: 'pointer', padding: 14, borderRadius: 12, border: '1px solid var(--lw-grey-line)', background: '#fff', transition: 'all .15s var(--ease)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.boxShadow = 'var(--sh-md)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lw-grey-line)'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: p.bg, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon name={p.icon} size={16} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{p.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--lw-charcoal)' }}>{p.value}</div>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 2 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div><h3>Rider Activity</h3><div className="sub">Today · OTP-verified deliveries</div></div>
            <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('payouts')}>Payouts <Icon name="arrow-right" size={13} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {riders.filter(r => r.active).slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--lw-grey-line-2)' }}>
                <Avatar name={r.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{r.zone} · {r.deliveries} deliveries</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <Icon name="star" size={12} style={{ color: 'var(--lw-orange)' }} /> {r.rating}
                </div>
                <Pill kind="success">{r.success}%</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
