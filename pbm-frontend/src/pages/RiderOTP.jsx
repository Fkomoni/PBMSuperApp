import { useState } from 'react'
import { Icon, Avatar, Pill } from '../components/ui'

const PENDING_OTP = [
  { id: 'DEL-001', member: 'Amina Bello',       plan_id: 'LH-LG-0001', rider: 'Chidi Okafor',  otp: '4821', address: '14 Adeniyi Jones Ave, Ikeja' },
  { id: 'DEL-004', member: 'Taiwo Ogundimu',     plan_id: 'LH-LG-0013', rider: 'Chidi Okafor',  otp: '7736', address: '22 Allen Avenue, Ikeja' },
  { id: 'DEL-002', member: 'Emeka Nwosu',        plan_id: 'LH-LG-0005', rider: 'Musa Abdullahi',otp: '3394', address: '5 Admiralty Way, Lekki Phase 1' },
  { id: 'DEL-005', member: 'Fatima Al-Hassan',   plan_id: 'LH-AB-0034', rider: 'Yusuf Danjuma', otp: '6615', address: 'Plot 12, Jabi District, Abuja' },
]

export default function RiderOTP({ setToast }) {
  const [deliveries, setDeliveries] = useState(PENDING_OTP)
  const [inputs, setInputs] = useState({})
  const [verified, setVerified] = useState(new Set())
  const [failed, setFailed]     = useState(new Set())

  const verify = (d) => {
    const entered = (inputs[d.id] || '').trim()
    if (entered === d.otp) {
      setVerified(s => new Set([...s, d.id]))
      setFailed(s => { const n = new Set(s); n.delete(d.id); return n })
      setToast(`OTP verified — ${d.member} delivery confirmed`)
    } else {
      setFailed(s => new Set([...s, d.id]))
      setToast('Incorrect OTP — please re-check', 'error')
    }
  }

  const confirmAll = () => {
    setDeliveries(prev => prev.filter(d => !verified.has(d.id)))
    setVerified(new Set())
    setToast(`${verified.size} deliver${verified.size !== 1 ? 'ies' : 'y'} confirmed and logged`)
  }

  return (
    <div className="page">
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <Icon name="shield-check" size={18} />
        <div>Riders enter the OTP shared by the member upon handoff. All verifications are audit-logged.</div>
      </div>

      {verified.size > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn--primary" onClick={confirmAll}>
            <Icon name="check-circle" size={14} /> Confirm all verified ({verified.size})
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {deliveries.map(d => {
          const isVerified = verified.has(d.id)
          const isFailed   = failed.has(d.id)
          return (
            <div key={d.id} className="card" style={{ borderColor: isVerified ? 'var(--s-success)' : isFailed ? 'var(--s-danger)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar name={d.member} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{d.member}</div>
                  <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{d.plan_id} · {d.address}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--lw-muted)' }}>
                  <div>Rider: <strong style={{ color: 'var(--lw-charcoal)' }}>{d.rider}</strong></div>
                  <div>{d.id}</div>
                </div>
                {isVerified && <Pill kind="success"><Icon name="check" size={11} /> Verified</Pill>}
                {isFailed   && <Pill kind="danger"><Icon name="x" size={11} /> Failed</Pill>}
              </div>

              {!isVerified && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--lw-muted)', display: 'block', marginBottom: 5 }}>Enter OTP from member</label>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="_ _ _ _"
                      value={inputs[d.id] || ''}
                      onChange={e => setInputs(i => ({ ...i, [d.id]: e.target.value.replace(/\D/g, '') }))}
                      style={{ letterSpacing: '0.3em', fontSize: 18, fontWeight: 700, textAlign: 'center', maxWidth: 160, borderColor: isFailed ? 'var(--s-danger)' : undefined }}
                      onKeyDown={e => e.key === 'Enter' && verify(d)}
                    />
                    {isFailed && <div style={{ fontSize: 11.5, color: 'var(--s-danger)', marginTop: 4 }}>OTP does not match — please re-enter</div>}
                  </div>
                  <button
                    className="btn btn--primary"
                    disabled={!inputs[d.id] || inputs[d.id].length < 4}
                    onClick={() => verify(d)}
                    style={{ marginTop: 18 }}
                  >
                    <Icon name="shield-check" size={14} /> Verify
                  </button>
                </div>
              )}

              {isVerified && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--s-success-bg)', borderRadius: 8 }}>
                  <Icon name="check-circle-2" size={16} style={{ color: 'var(--s-success)' }} />
                  <span style={{ fontSize: 13, color: 'var(--s-success)', fontWeight: 600 }}>Delivery confirmed — OTP matched</span>
                </div>
              )}
            </div>
          )
        })}

        {deliveries.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--lw-muted)' }}>
            <Icon name="shield-check" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 15 }}>All deliveries for today have been verified.</div>
          </div>
        )}
      </div>
    </div>
  )
}
