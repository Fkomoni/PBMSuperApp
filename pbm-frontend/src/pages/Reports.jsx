import { useState } from 'react'
import { Icon, BarChart, Donut, Pill, fmtMoney } from '../components/ui'

const REPORT_TYPES = [
  { key: 'claims',     label: 'Claims Summary',       icon: 'receipt-text' },
  { key: 'adherence',  label: 'Adherence Report',     icon: 'activity' },
  { key: 'dispensing', label: 'Dispensing Volume',    icon: 'pill' },
  { key: 'delivery',   label: 'Delivery Performance', icon: 'truck' },
  { key: 'riders',     label: 'Rider Performance',    icon: 'bike' },
]

const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']

export default function Reports({ setToast }) {
  const [report, setReport]   = useState('claims')
  const [period, setPeriod]   = useState('monthly')
  const [exporting, setExporting] = useState(false)

  const exportReport = async () => {
    setExporting(true)
    await new Promise(r => setTimeout(r, 800))
    setExporting(false)
    setToast(`${REPORT_TYPES.find(r => r.key === report)?.label} exported`)
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="seg">
          {REPORT_TYPES.map(r => (
            <button key={r.key} className={`seg__btn${report === r.key ? ' is-active' : ''}`} onClick={() => setReport(r.key)}>
              <Icon name={r.icon} size={13} /> {r.label}
            </button>
          ))}
        </div>
        <div className="seg">
          {['monthly', 'quarterly', 'ytd'].map(p => (
            <button key={p} className={`seg__btn${period === p ? ' is-active' : ''}`} onClick={() => setPeriod(p)} style={{ textTransform: 'uppercase', fontSize: 11 }}>{p}</button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={exportReport} disabled={exporting}>
          {exporting ? <Icon name="loader-circle" size={14} /> : <Icon name="download" size={14} />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {report === 'claims' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Claims', value: '248', sub: 'This period', color: '#2563EB' },
              { label: 'Total Value',  value: '₦41.2M', sub: '+18.4% vs prior', color: 'var(--lw-charcoal)' },
              { label: 'Avg Claim',    value: '₦166K', sub: 'Per episode', color: '#7C3AED' },
              { label: 'Rejection Rate', value: '3.2%', sub: '↓ from 4.8%', color: 'var(--s-success)' },
            ].map(t => (
              <div key={t.label} style={{ padding: '14px 16px', border: '1px solid var(--lw-grey-line)', borderRadius: 14, background: '#fff' }}>
                <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.color, marginTop: 2 }}>{t.value}</div>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 2 }}>{t.sub}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card__head"><div><h3>Claims by Month</h3><div className="sub">Value in ₦M</div></div></div>
            <BarChart data={[32,38,41,35,44,48,52]} labels={MONTHS} />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>Diagnosis Group</th><th>Claims</th><th>Value</th><th>Avg Copay</th><th>Share</th></tr></thead>
              <tbody>
                {[
                  ['Diabetes',      88, 18200000, 42500, 44],
                  ['Hypertension',  72, 10800000, 31200, 29],
                  ['Cardiovascular',38, 7600000,  55000, 15],
                  ['Asthma',        28, 3400000,  28000, 11],
                  ['Renal',         22, 1200000,  18000, 9],
                ].map(([g, c, v, cp, s]) => (
                  <tr key={g}>
                    <td style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{g}</td>
                    <td style={{ fontSize: 13 }}>{c}</td>
                    <td style={{ fontSize: 13 }}>{fmtMoney(v)}</td>
                    <td style={{ fontSize: 13 }}>{fmtMoney(cp)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="prog" style={{ width: 60 }}><div style={{ width: `${s}%`, background: 'var(--lw-red)' }} /></div>
                        <span style={{ fontSize: 12 }}>{s}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report === 'adherence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card__head"><div><h3>Adherence Trend</h3><div className="sub">% members on-track (≥85%)</div></div></div>
              <BarChart data={[72, 74, 76, 78, 80, 82, 84]} labels={MONTHS} />
            </div>
            <div className="card">
              <div className="card__head"><div><h3>Breakdown</h3><div className="sub">Current period</div></div></div>
              <Donut size={120} thickness={14}
                segments={[{ v: 62, c: 'var(--s-success)' }, { v: 24, c: 'var(--s-warn)' }, { v: 14, c: 'var(--s-danger)' }]}
                centerLabel={{ v: '84%', l: 'avg' }}
              />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[['On track ≥85%', '62%', 'var(--s-success)'], ['At risk 70–84%', '24%', 'var(--s-warn)'], ['Critical <70%', '14%', 'var(--s-danger)']].map(([l, v, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: c }} />
                    <span style={{ flex: 1, color: 'var(--lw-muted)' }}>{l}</span>
                    <span style={{ fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {report === 'delivery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Success Rate', value: '96.4%', icon: 'check-circle-2', color: 'var(--s-success)' },
              { label: 'Avg TAT',      value: '2.8h',  icon: 'clock',          color: '#2563EB' },
              { label: 'OTP Rate',     value: '98.1%', icon: 'shield-check',   color: '#7C3AED' },
            ].map(t => (
              <div key={t.label} style={{ padding: '16px', border: '1px solid var(--lw-grey-line)', borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name={t.icon} size={24} style={{ color: t.color }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.color }}>{t.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card__head"><div><h3>Deliveries per Week</h3></div></div>
            <BarChart data={[82, 95, 110, 88, 124, 132, 118, 140, 156, 148, 162, 178]} labels={['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12']} />
          </div>
        </div>
      )}

      {(report === 'dispensing' || report === 'riders') && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Icon name="bar-chart-3" size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 15, color: 'var(--lw-muted)' }}>
            {REPORT_TYPES.find(r => r.key === report)?.label} report is being compiled for this period.
          </div>
          <div style={{ fontSize: 13, color: 'var(--lw-muted)', marginTop: 4 }}>Check back shortly or export raw data above.</div>
        </div>
      )}
    </div>
  )
}
