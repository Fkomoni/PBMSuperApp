import { useEffect, useRef } from 'react'

// ── Icon (lucide-react) ──────────────────────────────────────────────────────
// Thin wrapper that maps name strings to lucide components lazily
import * as LucideIcons from 'lucide-react'

export function Icon({ name, size = 16, strokeWidth = 1.75, style, className }) {
  const pascal = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')
  const Comp = LucideIcons[pascal]
  if (!Comp) return <span style={{ width: size, height: size, display: 'inline-block', ...style }} />
  return <Comp size={size} strokeWidth={strokeWidth} style={style} className={className} />
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name = '?', size = '' }) {
  const initials = name.split(' ').filter(Boolean).slice(-2).map(s => s[0]).join('').toUpperCase()
  return <span className={`av${size ? ` av--${size}` : ''}`}>{initials}</span>
}

// ── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ kind = 'neutral', children, icon }) {
  return (
    <span className={`pill pill--${kind}`}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  )
}

export function StatusPill({ status }) {
  const map = {
    'Delivered':        ['success', 'check-check'],
    'Out for Delivery': ['info',    'truck'],
    'Assigned':         ['info',    'user-round'],
    'Packed':           ['neutral', 'package-check'],
    'Packing':          ['warn',    'package'],
    'Awaiting Pack':    ['warn',    'clock'],
    'Incomplete':       ['danger',  'triangle-alert'],
    'Pending Approval': ['warn',    'hourglass'],
    'Active':           ['success', 'circle-check'],
    'Inactive':         ['neutral', 'circle'],
    'Awaiting triage':  ['warn',    'hourglass'],
    'Triaged':          ['info',    'check'],
    'Sent to Partner':  ['info',    'send'],
    'Acknowledged':     ['info',    'message-circle'],
    'Dispensing':       ['info',    'pill'],
    'Failed':           ['danger',  'x-circle'],
    'Cancelled':        ['neutral', 'x'],
  }
  const [kind, icon] = map[status] || ['neutral', 'circle']
  return <Pill kind={kind} icon={icon}>{status}</Pill>
}

// ── KpiTile ──────────────────────────────────────────────────────────────────
export function KpiTile({ kind, icon, label, value, delta, deltaKind = 'up', spark }) {
  const color = kind === 'blue' ? '#2563EB' : kind === 'green' ? 'var(--s-success)' : kind === 'amber' ? 'var(--s-warn)' : kind === 'purple' ? '#7C3AED' : 'var(--s-danger)'
  return (
    <div className={`kpi kpi--${kind}`}>
      <div className="kpi__row">
        <div className="kpi__icon"><Icon name={icon} size={19} /></div>
        {delta && (
          <span className={`kpi__delta ${deltaKind}`}>
            <Icon name={deltaKind === 'up' ? 'trending-up' : 'trending-down'} size={11} /> {delta}
          </span>
        )}
      </div>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value num">{value}</div>
      {spark && <div className="kpi__spark"><Sparkline data={spark} color={color} /></div>}
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, color = 'var(--cta-bg)', height = 34 }) {
  if (!data || data.length < 2) return null
  const w = 120, h = height
  const max = Math.max(...data), min = Math.min(...data), range = Math.max(1, max - min)
  const pts = data.map((v, i) => [i * (w / (data.length - 1)), h - ((v - min) / range) * (h - 4) - 2])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── BarChart ─────────────────────────────────────────────────────────────────
export function BarChart({ data, height = 160, color = 'var(--cta-bg)', labels }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, padding: '4px 0' }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', flex: 1 }}>
            <div style={{ width: '100%', height: `${(v / max) * 100}%`, background: color, borderRadius: '4px 4px 0 0', opacity: .85 }} />
          </div>
          {labels && <div style={{ fontSize: 10.5, color: 'var(--lw-muted)' }}>{labels[i]}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Donut ─────────────────────────────────────────────────────────────────────
export function Donut({ segments, size = 120, thickness = 14, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.v, 0)
  let acc = 0
  const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--lw-grey-line-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.v / total) * circ, offset = acc; acc += len
          return <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.c} strokeWidth={thickness}
            strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${c} ${c})`} strokeLinecap="butt" />
        })}
      </svg>
      {centerLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          <div style={{ fontSize: 20, color: 'var(--lw-charcoal)', letterSpacing: '-.02em' }}>{centerLabel.v}</div>
          <div style={{ fontSize: 10.5, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{centerLabel.l}</div>
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide, icon }) {
  if (!open) return null
  return (
    <div className="scrim" onClick={onClose}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon && <div className="kpi__icon kpi--blue" style={{ width: 34, height: 34 }}><Icon name={icon} size={16} /></div>}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          </div>
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="scrim" onClick={onClose}>
      <div className={`drawer${wide ? ' drawer--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="drawer__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ message, kind = 'success', onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [message, onClose])
  if (!message) return null
  return (
    <div className={`toast toast--${kind}`}>
      <Icon name={kind === 'success' ? 'check-circle' : kind === 'warn' ? 'alert-triangle' : kind === 'error' ? 'x-circle' : 'info'} size={16} />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon = 'inbox', title, body, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--lw-grey-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lw-muted)' }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14, color: 'var(--lw-charcoal)' }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: 'var(--lw-muted)', marginTop: 5, maxWidth: 360, marginInline: 'auto' }}>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

// ── FlagChip ──────────────────────────────────────────────────────────────────
export function FlagChip({ flag, reason }) {
  if (!flag) return null
  const isRed = flag === 'red'
  return (
    <span title={reason} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 700,
      background: isRed ? 'rgba(220,38,38,.08)' : 'rgba(16,170,92,.1)',
      color: isRed ? '#b91c1c' : '#0a7a42',
      border: `1px solid ${isRed ? 'rgba(220,38,38,.28)' : 'rgba(16,170,92,.3)'}`,
      textTransform: 'uppercase', letterSpacing: '.02em',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRed ? '#dc2626' : '#10aa5c' }} />
      {isRed ? 'Red flag' : 'Green flag'}
    </span>
  )
}

// ── PlannerStat ───────────────────────────────────────────────────────────────
export function PlannerStat({ icon, color, label, value, sub, danger }) {
  return (
    <div style={{ padding: 14, background: '#fff', border: '1px solid var(--lw-grey-line)', borderRadius: 12, borderLeft: `4px solid ${danger ? 'var(--s-danger)' : color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--lw-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, letterSpacing: '-.02em' }} className="num">{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--lw-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtMoney(n) {
  if (n == null) return '—'
  return '₦' + Number(n).toLocaleString('en-NG')
}
export function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function daysBetween(from, toStr) {
  const to = new Date(toStr)
  return Math.ceil((to - from) / 86400000)
}
