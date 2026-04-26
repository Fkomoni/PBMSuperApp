import { Icon } from './ui'

const NAV = [
  { key: 'dashboard',       icon: 'layout-dashboard',  label: 'Dashboard',            group: 'Overview' },
  { key: 'enrollees-lagos', icon: 'map-pin',            label: 'Chronic — Lagos',       group: 'Chronic', badge: '52' },
  { key: 'enrollees-outside',icon: 'send',              label: 'Chronic — Outside Lagos',group: 'Chronic', badge: '34' },
  { key: 'member-requests', icon: 'user-round-plus',    label: 'Member Requests',       group: 'Chronic', badge: '4' },
  { key: 'refill-planner',  icon: 'calendar-clock',     label: 'Refill Planner',        group: 'Chronic' },
  { key: 'acute-lagos',     icon: 'siren',              label: 'Acute — Lagos',         group: 'Acute',   badge: '4' },
  { key: 'acute-outside',   icon: 'send',               label: 'Acute — Outside Lagos', group: 'Acute',   badge: '3' },
  { key: 'pharmacy',        icon: 'pill',               label: 'Pharmacy & Tariff',     group: 'Operations' },
  { key: 'tariff-update',   icon: 'banknote',           label: 'Tariff Update',         group: 'Operations', admin: true },
  { key: 'bulk-upload',     icon: 'upload',             label: 'Bulk Member Upload',    group: 'Operations' },
  { key: 'deliveries',      icon: 'truck',              label: 'Create Deliveries',     group: 'Operations' },
  { key: 'pack',            icon: 'package',            label: 'Pack Medications',      group: 'Operations' },
  { key: 'pending',         icon: 'hourglass',          label: 'Pending Approvals',     group: 'Operations', badge: '12' },
  { key: 'logistics',       icon: 'route',              label: 'Logistics — Assign',    group: 'Delivery' },
  { key: 'riders',          icon: 'bike',               label: 'Riders',                group: 'Delivery' },
  { key: 'tracking',        icon: 'map-pin',            label: 'Live Tracking',         group: 'Delivery' },
  { key: 'rider-otp',       icon: 'shield-check',       label: 'Rider OTP',             group: 'Delivery' },
  { key: 'stock',           icon: 'boxes',              label: 'Stock Management',      group: 'Inventory' },
  { key: 'claims',          icon: 'receipt-text',       label: 'Claims',                group: 'Finance' },
  { key: 'exclusion-bills', icon: 'file-minus-2',       label: 'Exclusion Bills',       group: 'Finance' },
  { key: 'clinic-supply',   icon: 'stethoscope',        label: 'Clinic Supply List',    group: 'Finance' },
  { key: 'payouts',         icon: 'banknote',           label: 'Rider Payouts',         group: 'Finance' },
  { key: 'audit',           icon: 'scroll-text',        label: 'Audit Trail',           group: 'Compliance' },
  { key: 'brand-warnings',  icon: 'shield-check',       label: 'Brand Warnings',        group: 'Compliance', admin: true },
  { key: 'reports',         icon: 'bar-chart-3',        label: 'Reports',               group: 'Insights' },
  { key: 'member-app',      icon: 'smartphone',         label: 'Member App',            group: 'Insights' },
]

export function Sidebar({ active, onNavigate, role }) {
  const grouped = {}
  NAV.forEach(it => {
    if (it.admin && role !== 'admin') return
    ;(grouped[it.group] = grouped[it.group] || []).push(it)
  })

  return (
    <aside className="side">
      <div className="side__brand">
        <img src="/leadway-logo.jpg" alt="Leadway Health HMO" style={{ height: 48, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
        <div className="wm" style={{ display: 'none' }}>
          <div className="w1">LEADWAY</div>
          <div className="w2">Health<span className="hmo">PBM</span></div>
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1, paddingBottom: 12 }}>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="side__group">{group}</div>
            <div className="side__nav">
              {items.map(it => (
                <div
                  key={it.key}
                  className={`side__item${active === it.key ? ' is-active' : ''}`}
                  onClick={() => onNavigate(it.key)}
                >
                  <Icon name={it.icon} size={17} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.admin && (
                    <span className="badge" style={{ background: 'rgba(220,38,38,.12)', color: 'var(--lw-red)', fontSize: 9 }}>ADM</span>
                  )}
                  {it.badge && <span className="badge">{it.badge}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="side__foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="shield-check" size={13} />
          <span>NAFDAC-compliant audit log</span>
        </div>
        <div style={{ marginTop: 4, opacity: .7 }}>v1.0.0 · Prognosis sync ✓</div>
      </div>
    </aside>
  )
}

export function Topbar({ title, crumb, user, onLogout }) {
  const initials = (user?.name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  const roleLabel = {
    admin: 'PBM Admin', pharm_ops: 'Pharmacy Ops', pharmacist: 'Pharmacist',
    logistics: 'Logistics', contact: 'Contact Centre', rider: 'Rider',
  }[user?.role] || user?.role

  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        {crumb && <div className="top__crumb">{crumb}</div>}
      </div>
      <div className="top__search">
        <Icon name="search" size={15} />
        <input placeholder="Search enrollees, drugs, riders…" />
        <span className="top__kbd">⌘K</span>
      </div>
      <button className="top__icon-btn" title="Notifications">
        <Icon name="bell" size={18} />
        <span className="dot" />
      </button>
      <button className="top__icon-btn" title="Sync Prognosis">
        <Icon name="refresh-cw" size={18} />
      </button>
      <div className="top__user">
        <div className="av">{initials}</div>
        <div className="meta">
          <div className="n">{user?.name}</div>
          <div className="r">{roleLabel}</div>
        </div>
        <button className="top__icon-btn" title="Sign out" onClick={onLogout}>
          <Icon name="log-out" size={16} />
        </button>
      </div>
    </header>
  )
}

export const PAGE_TITLES = {
  dashboard:          ['Dashboard',               'Overview · Today'],
  'enrollees-lagos':  ['Chronic — Lagos',         'Chronic · Lagos team · own riders'],
  'enrollees-outside':['Chronic — Outside Lagos', 'Chronic · Partner pharmacy team'],
  'member-requests':  ['Member Requests',         'Chronic · Self-service'],
  'refill-planner':   ['Refill Planner',          'Chronic · Forecast'],
  'acute-lagos':      ['Acute — Lagos',           'Acute · Lagos team · own riders'],
  'acute-outside':    ['Acute — Outside Lagos',   'Acute · Partner pharmacy team'],
  pharmacy:           ['Pharmacy & Tariff',        'Operations · Formulary'],
  'tariff-update':    ['Tariff Update',            'Operations · Admin only'],
  'bulk-upload':      ['Bulk Member Upload',       'Operations · Excel import'],
  deliveries:         ['Create Deliveries',        'Operations · Queue'],
  pack:               ['Pack Medications',         'Operations · Packing bay'],
  pending:            ['Pending Approvals',        'Operations · Review'],
  logistics:          ['Logistics',                'Delivery · Assign packed orders'],
  riders:             ['Riders',                   'Delivery · Fleet'],
  tracking:           ['Live Tracking',            'Delivery · In transit'],
  'rider-otp':        ['Rider OTP',               'Delivery · Mobile handoff'],
  stock:              ['Stock Management',         'Inventory · FEFO'],
  claims:             ['Claims',                   'Finance · API submission'],
  'exclusion-bills':  ['Exclusion Bills',          'Finance · Off-scheme claims'],
  'clinic-supply':    ['Clinic Supply List',       'Finance · Bulk clinic orders'],
  payouts:            ['Rider Payouts',            'Finance · Weekly'],
  audit:              ['Audit Trail',              'Compliance · All actions'],
  'brand-warnings':   ['Brand Warnings',           'Compliance · Scheme rules'],
  reports:            ['Reports',                  'Insights · Exports'],
  'member-app':       ['Member App Preview',       'Insights · Self-service'],
}
