import { useState } from 'react'
import { Icon, Pill, fmtDate, fmtMoney } from '../components/ui'

const MOCK_MEMBER = {
  name: 'Amina Bello',
  plan_id: 'LH-LG-0001',
  plan: 'Gold Plus',
  scheme: 'Zenith Bank Group',
  diagnosis: 'Diabetes Type 2',
  next_refill: '2026-04-22',
  adherence: 92,
  benefit_cap: 1500000,
  used: 420000,
  medications: [
    { name: 'Metformin 500mg', dosage: '2 tablets', frequency: 'Twice daily', next_due: '2026-04-22' },
    { name: 'Glibenclamide 5mg', dosage: '1 tablet', frequency: 'Once daily (morning)', next_due: '2026-04-22' },
    { name: 'Lisinopril 10mg', dosage: '1 tablet', frequency: 'Once daily', next_due: '2026-04-22' },
  ],
  recent_orders: [
    { id: 'DEL-2026-021', date: '2026-03-20', status: 'Delivered', drugs: 3 },
    { id: 'DEL-2026-008', date: '2026-02-18', status: 'Delivered', drugs: 3 },
    { id: 'DEL-2026-003', date: '2026-01-20', status: 'Delivered', drugs: 2 },
  ],
}

function PhoneFrame({ children }) {
  return (
    <div style={{ width: 360, margin: '0 auto', border: '8px solid #1a1a1a', borderRadius: 40, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)', position: 'relative', background: '#f5f5f5' }}>
      <div style={{ background: '#1a1a1a', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 60, height: 6, background: '#333', borderRadius: 4 }} />
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 680, background: '#f5f5f5' }}>
        {children}
      </div>
    </div>
  )
}

export default function MemberApp({ setToast }) {
  const [screen, setScreen] = useState('home')
  const m = MOCK_MEMBER

  const refillPct = Math.round((m.used / m.benefit_cap) * 100)

  return (
    <div className="page">
      <div className="banner banner--info" style={{ marginBottom: 20 }}>
        <Icon name="smartphone" size={18} />
        <div>This is a <strong>preview</strong> of the member-facing self-service app. Members access this via a dedicated URL or the Leadway Health app.</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <PhoneFrame>
          {/* Top bar */}
          <div style={{ background: 'linear-gradient(135deg, #263626, #3A4F3A)', padding: '16px 20px 20px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Leadway Health · PBM</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{m.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{m.plan_id} · {m.plan}</div>
          </div>

          {/* Nav */}
          <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #eee' }}>
            {[['home', 'Home', 'home'], ['meds', 'Meds', 'pill'], ['orders', 'Orders', 'package'], ['help', 'Help', 'message-circle']].map(([k, l, ico]) => (
              <button key={k} onClick={() => setScreen(k)} style={{ flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: screen === k ? '#C61531' : '#9CA3AF' }}>
                <Icon name={ico} size={18} />
                <span style={{ fontSize: 10, fontWeight: screen === k ? 700 : 400 }}>{l}</span>
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {screen === 'home' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Refill card */}
                <div style={{ background: 'linear-gradient(135deg, #C61531, #E03050)', borderRadius: 16, padding: '16px 18px', color: '#fff' }}>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Next refill</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtDate(m.next_refill)}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{m.medications.length} medications</div>
                  <button style={{ marginTop: 12, background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}>
                    Request early refill
                  </button>
                </div>

                {/* Adherence */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#263626' }}>Adherence score</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: m.adherence >= 85 ? '#16A34A' : '#D97706' }}>{m.adherence}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6' }}>
                    <div style={{ width: `${m.adherence}%`, height: '100%', borderRadius: 6, background: m.adherence >= 85 ? '#16A34A' : '#D97706' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    {m.adherence >= 85 ? 'Great job — keep it up!' : 'Try not to miss doses'}
                  </div>
                </div>

                {/* Benefit usage */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#263626', marginBottom: 8 }}>Benefit usage</div>
                  <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6', marginBottom: 6 }}>
                    <div style={{ width: `${refillPct}%`, height: '100%', borderRadius: 6, background: '#2563EB' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                    <span>Used: {fmtMoney(m.used)}</span>
                    <span>Cap: {fmtMoney(m.benefit_cap)}</span>
                  </div>
                </div>
              </div>
            )}

            {screen === 'meds' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#263626', marginBottom: 4 }}>My Medications</div>
                {m.medications.map((med, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#263626' }}>{med.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{med.dosage} · {med.frequency}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Icon name="calendar" size={12} style={{ color: '#C61531' }} />
                      <span style={{ fontSize: 12, color: '#C61531', fontWeight: 600 }}>Next due: {fmtDate(med.next_due)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#263626', marginBottom: 4 }}>Order History</div>
                {m.recent_orders.map(o => (
                  <div key={o.id} style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="package" size={18} style={{ color: '#16A34A' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#263626' }}>{o.id}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtDate(o.date)} · {o.drugs} drugs</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{o.status}</div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'help' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#263626', marginBottom: 4 }}>Support</div>
                {[
                  { icon: 'phone', label: 'Call PBM Centre', sub: '0700-LEADWAY', color: '#2563EB' },
                  { icon: 'message-circle', label: 'WhatsApp Chat', sub: '+234 800 000 0000', color: '#16A34A' },
                  { icon: 'mail', label: 'Email Support', sub: 'pbm@leadway.com', color: '#7C3AED' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={item.icon} size={18} style={{ color: item.color }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#263626' }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PhoneFrame>
      </div>
    </div>
  )
}
