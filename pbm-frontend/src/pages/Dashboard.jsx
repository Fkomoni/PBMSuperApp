import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { KpiTile, BarChart, Donut, Pill, Icon, Avatar, fmtMoney } from '../components/ui'

export default function Dashboard({ onNavigate, setToast }) {
  const [stats, setStats]     = useState(null)
  const [riders, setRiders]   = useState([])
  const [claims, setClaims]   = useState([])

  useEffect(() => {
    fetch(API_BASE + '/api/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d) }).catch(() => {})
    fetch(API_BASE + '/api/riders', { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setRiders).catch(() => {})
    fetch(API_BASE + '/api/claims', { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setClaims).catch(() => {})
  }, [])

  if (!stats) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading dashboard…</div>

  const { enrollees = {}, acute_orders = {}, claims: claimStats = {}, stock = {}, riders: riderStats = {}, partners = {} } = stats

  // Region breakdown for donut
  const regionEntries = Object.entries(enrollees.by_region || {}).sort((a, b) => b[1] - a[1])
  const REGION_COLORS = ['#C61531', '#F15A24', '#2563EB', '#7C3AED', '#0E9488', '#F6A524']

  // Claims by status for bar chart
  const claimStatusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})
  const claimBarData   = ['Approved', 'Pending', 'Under Review', 'Rejected'].map(s => claimStatusCounts[s] || 0)
  const claimBarLabels = ['Approved', 'Pending', 'Review', 'Rejected']

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, color: 'var(--lw-muted)', marginBottom: 2 }}>PBM Operations Portal</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--lw-charcoal)' }}>Dashboard</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--lw-muted)', fontSize: 14 }}>
          <strong style={{ color: 'var(--lw-charcoal)' }}>{enrollees.active || 0}</strong> active members ·{' '}
          <strong style={{ color: 'var(--s-warn)' }}>{acute_orders.pending || 0}</strong> acute orders pending ·{' '}
          <strong style={{ color: 'var(--s-danger)' }}>{stock.low_stock_count || 0}</strong> drugs below reorder level
        </p>
      </div>

      {/* KPI tiles */}
      <div className="kpis">
        <KpiTile kind="blue"   icon="users-round"  label="Active Members"      value={enrollees.active || 0}        spark={[20,22,24,26,25,27,28,30,29,31,32,34]} />
        <KpiTile kind="amber"  icon="siren"         label="Acute Orders Pending" value={acute_orders.pending || 0}    spark={[3,5,4,6,8,7,9,8,10,9,11,10]} />
        <KpiTile kind="green"  icon="receipt-text"  label="Claims This Month"   value={claimStats.total || 0}         spark={[8,10,12,14,13,16,18,17,20,22,24,26]} />
        <KpiTile kind="purple" icon="landmark"      label="Claims Value"        value={fmtMoney(claimStats.total_value_ngn || 0)} spark={[12,15,18,20,19,22,24,26,28,30,32,35]} />
      </div>

      {/* Alert banners */}
      {stock.low_stock_count > 0 && (
        <div className="banner banner--danger" style={{ marginBottom: 16 }}>
          <Icon name="pill" size={18} />
          <div><strong>{stock.low_stock_count} drug{stock.low_stock_count !== 1 ? 's' : ''}</strong> below reorder level — check stock now.</div>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('stock')}>View stock</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Claims breakdown */}
        <div className="card">
          <div className="card__head">
            <div><h3>Claims by Status</h3><div className="sub">All time · {claimStats.total || 0} total</div></div>
            <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('claims')}>View all <Icon name="arrow-right" size={13} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['var(--s-success)', 'Approved',    claimStats.approved || 0],
                ['var(--s-warn)',    'Pending',      claimStats.pending  || 0],
                ['var(--s-danger)',  'Rejected',     (claimStats.total || 0) - (claimStats.approved || 0) - (claimStats.pending || 0)],
              ].map(([c, l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                  <span style={{ color: 'var(--lw-muted)', flex: 1 }}>{l}</span>
                  <span style={{ fontWeight: 700, color: 'var(--lw-charcoal)' }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--lw-muted)' }}>Approval rate</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--lw-charcoal)' }}>
                {claimStats.total ? Math.round(((claimStats.approved || 0) / claimStats.total) * 100) : 0}%
              </div>
              <Pill kind="success" icon="trending-up">Claims processed</Pill>
            </div>
            <BarChart data={claimBarData} labels={claimBarLabels} color="var(--lw-red)" />
          </div>
        </div>

        {/* Members by region */}
        <div className="card">
          <div className="card__head"><div><h3>Members by Region</h3><div className="sub">{enrollees.total || 0} total</div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Donut size={120} thickness={14}
              segments={regionEntries.map(([, v], i) => ({ v, c: REGION_COLORS[i % REGION_COLORS.length] }))}
              centerLabel={{ v: enrollees.total || 0, l: 'Members' }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {regionEntries.slice(0, 5).map(([region, count], i) => (
                <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: REGION_COLORS[i % REGION_COLORS.length] }} />
                  <span style={{ flex: 1, color: 'var(--lw-ink)' }}>{region}</span>
                  <span style={{ color: 'var(--lw-muted)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Operations pipeline */}
        <div className="card">
          <div className="card__head"><div><h3>Today's Operations</h3><div className="sub">Click a stage to jump in</div></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { page: 'pending',   icon: 'user-round-plus',  color: '#2563EB',          bg: '#E6EEFE',             label: 'New',       value: acute_orders.pending || 0,    sub: 'requests' },
              { page: 'acute-lagos',icon: 'siren',           color: 'var(--s-danger)',  bg: 'var(--s-danger-bg)',  label: 'Acute',     value: acute_orders.total || 0,      sub: 'orders' },
              { page: 'logistics', icon: 'user-round-check', color: '#7C3AED',          bg: '#EEE6F8',             label: 'Logistics', value: riderStats.available || 0,    sub: 'riders avail' },
              { page: 'stock',     icon: 'pill',             color: 'var(--s-warn)',    bg: 'var(--s-warn-bg)',    label: 'Low Stock', value: stock.low_stock_count || 0,   sub: 'drugs' },
              { page: 'claims',    icon: 'check-check',      color: 'var(--s-success)', bg: 'var(--s-success-bg)', label: 'Approved',  value: claimStats.approved || 0,     sub: 'claims' },
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

        {/* Rider activity */}
        <div className="card">
          <div className="card__head">
            <div><h3>Rider Activity</h3><div className="sub">{riderStats.total || 0} riders · {riderStats.available || 0} available</div></div>
            <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('riders')}>View all <Icon name="arrow-right" size={13} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {riders.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--lw-grey-line-2)' }}>
                <Avatar name={r.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{r.region} · {r.deliveries_today} deliveries today</div>
                </div>
                <Pill kind={r.status === 'Available' ? 'success' : r.status === 'On Delivery' ? 'info' : 'neutral'}>{r.status}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
