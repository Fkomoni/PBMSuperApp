import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, Pill, fmtDate } from '../components/ui'

const STEPS = ['Select Member', 'Verify Drugs', 'Print Label', 'Confirm Pack']

function StepIndicator({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i < step ? 'var(--lw-red)' : i === step ? 'var(--lw-charcoal)' : 'var(--lw-grey-line)',
              color: i <= step ? '#fff' : 'var(--lw-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {i < step ? <Icon name="check" size={13} /> : i + 1}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--lw-charcoal)' : 'var(--lw-muted)', whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--lw-red)' : 'var(--lw-grey-line)', margin: '0 12px' }} />}
        </div>
      ))}
    </div>
  )
}

export default function Pack({ setToast }) {
  const [queue, setQueue]       = useState([])
  const [step, setStep]         = useState(0)
  const [current, setCurrent]   = useState(null)
  const [checked, setChecked]   = useState(new Set())
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pbm_token')
    Promise.all([
      fetch(API_BASE + '/api/enrollees?region=lagos',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(API_BASE + '/api/enrollees?region=outside', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([l, o]) => {
      const topack = [...l, ...o].filter(e => e.status === 'Awaiting Pack' || e.status === 'Packing')
      setQueue(topack)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const startPack = (e) => {
    setCurrent(e)
    setChecked(new Set())
    setStep(1)
  }

  const confirmPack = () => {
    setQueue(prev => prev.filter(e => e.id !== current.id))
    setToast(`${current.name}'s pack confirmed — moved to Packed`)
    setCurrent(null)
    setStep(0)
  }

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  if (step === 0) {
    return (
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{queue.length} order{queue.length !== 1 ? 's' : ''} awaiting pack</div>
        </div>

        {queue.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--lw-muted)' }}>
            <Icon name="package-check" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 15 }}>All orders are packed!</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {queue.map(e => (
            <div key={e.id} className="card" style={{ cursor: 'pointer' }} onClick={() => startPack(e)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Avatar name={e.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{e.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{e.plan_id} · {e.state}</div>
                </div>
                <Pill kind={e.status === 'Packing' ? 'warn' : 'default'}>{e.status}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginBottom: 6 }}>
                {e.diagnosis} · Refill {fmtDate(e.next_refill)}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', marginBottom: 12 }}>
                {(e.medications || []).length} medication{(e.medications || []).length !== 1 ? 's' : ''}
              </div>
              <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Icon name="package" size={14} /> Start packing
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const meds = current?.medications || []
  const allChecked = meds.every(m => checked.has(m.id))

  return (
    <div className="page">
      <StepIndicator step={step} />

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        {step === 1 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Avatar name={current.name} size={42} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lw-charcoal)' }}>{current.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{current.plan_id} · {current.diagnosis} · Refill {fmtDate(current.next_refill)}</div>
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Verify medications — tick each as you pack</div>
            {meds.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--lw-grey-line-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked.has(m.id)} onChange={() => setChecked(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })} style={{ width: 17, height: 17, cursor: 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>{m.dosage} · {m.frequency}</div>
                </div>
                {checked.has(m.id) && <Icon name="check-circle-2" size={18} style={{ color: 'var(--s-success)' }} />}
              </label>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => { setStep(0); setCurrent(null) }}>← Back</button>
              <button className="btn btn--primary" disabled={!allChecked} onClick={() => setStep(2)}>
                Next: Print Label →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)', marginBottom: 16 }}>Print Label</div>
            <div style={{ border: '2px dashed var(--lw-grey-line)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 20 }}>
              <Icon name="printer" size={32} style={{ color: 'var(--lw-muted)', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lw-charcoal)' }}>{current.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-muted)' }}>{current.plan_id} · {current.address || current.state}</div>
              <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 4 }}>Refill date: {fmtDate(current.next_refill)}</div>
              <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => window.print()}>
                <Icon name="printer" size={14} /> Print / Download label
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn--primary" onClick={() => setStep(3)}>Label printed →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0 28px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--s-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Icon name="package-check" size={28} style={{ color: 'var(--s-success)' }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--lw-charcoal)' }}>Ready to seal!</div>
              <div style={{ fontSize: 13, color: 'var(--lw-muted)', marginTop: 4 }}>All {meds.length} medications verified and label printed.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn--primary" onClick={confirmPack}>
                <Icon name="check-circle" size={14} /> Confirm packed
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
