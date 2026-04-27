import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { Icon, Avatar, StatusPill, Pill, fmtDate, fmtMoney, daysBetween } from '../components/ui'

const TODAY = new Date('2026-04-18')

const COHORT_NAMES = {
  dc01: 'Diabetes', dc02: 'Hypertension', dc03: 'Sickle Cell',
  dc04: 'Hepatitis B', dc05: 'Seizure Disorder', dc06: 'Eye Disorders',
  dc07: 'Musculoskeletal', dc08: 'Autoimmune', dc09: 'CKD', dc10: 'Asthma/COPD',
}

const COHORT_OPTS = [
  { key: 'all', label: 'All cohorts' },
  ...Object.entries(COHORT_NAMES).map(([k, v]) => ({ key: k, label: v })),
]

function diagnosisLabel(cohorts) {
  if (!cohorts || cohorts.length === 0) return '—'
  const names = cohorts.slice(0, 2).map(c => COHORT_NAMES[c] || c).join(', ')
  return cohorts.length > 2 ? `${names} +${cohorts.length - 2}` : names
}

// ── Medication row ─────────────────────────────────────────────────────────────
function MedRow({ med }) {
  const hasBrandConflict = (med.flags || []).includes('BRAND_CONFLICT')
  const hasDupGeneric    = (med.flags || []).includes('DUPLICATE_GENERIC')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 100px', alignItems: 'start', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--lw-grey-line-2)', fontSize: 13 }}>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--lw-charcoal)' }}>{med.name}</div>
        <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 1 }}>
          {med.generic_name}{med.brand ? ` · Brand: ${med.brand}` : ''}
        </div>
        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{med.frequency}</div>
        {(hasBrandConflict || hasDupGeneric) && (
          <Pill kind={hasBrandConflict ? 'danger' : 'warn'} style={{ marginTop: 4, fontSize: 10 }}>
            {hasBrandConflict ? 'Brand conflict' : 'Duplicate generic'}
          </Pill>
        )}
      </div>
      <div style={{ fontSize: 12 }}>{med.dosage}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{med.qty_30day || med.qty}</div>
      <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{med.route}</div>
    </div>
  )
}

// ── Enrollee drawer ────────────────────────────────────────────────────────────
function EnrolleeDrawer({ enrollee, onClose, setToast }) {
  const [tab, setTab]           = useState('overview')
  const [meds, setMeds]         = useState(null)
  const [medsLoading, setMedsLoading] = useState(false)
  const [medsData, setMedsData] = useState(null)
  const [comment, setComment]   = useState('')
  const [comments, setComments] = useState(enrollee.comments || [])

  const days = daysBetween(TODAY, enrollee.next_refill)

  useEffect(() => {
    if (tab === 'medications' && meds === null) {
      setMedsLoading(true)
      fetch(API_BASE + `/api/enrollees/${enrollee.id}/medications`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setMedsData(data)
          setMeds(data.medications || [])
          setMedsLoading(false)
        })
        .catch(() => setMedsLoading(false))
    }
  }, [tab, meds, enrollee.id])

  const addComment = () => {
    if (!comment.trim()) return
    setComments(c => [...c, { id: Date.now(), text: comment, by: 'You', at: 'just now' }])
    setComment('')
    setToast('Comment added')
  }

  const chronicLimit = enrollee.benefit_cap || 500000
  const flaggedMeds  = (meds || []).filter(m => (m.flags || []).length > 0)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 580 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          <Avatar name={enrollee.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lw-charcoal)' }}>{enrollee.name}</div>
            <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 1 }}>
              {enrollee.id} · {diagnosisLabel(enrollee.disease_cohorts)} · {enrollee.phone}
            </div>
          </div>
          <StatusPill status={enrollee.status} />
          <button className="top__icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--lw-grey-line)' }}>
          {['overview', 'medications', 'comments', 'audit'].map(t => (
            <button key={t} className={`tab-btn${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>

          {/* ── Overview ─── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Phone', enrollee.phone], ['Email', enrollee.email],
                  ['Company', enrollee.company], ['Scheme', enrollee.scheme],
                  ['Region', enrollee.region], ['Policy No', enrollee.policy_no],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Cohorts */}
              <div style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginBottom: 6 }}>Disease Cohorts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(enrollee.disease_cohorts || []).map(c => (
                    <Pill key={c} kind="default">{COHORT_NAMES[c] || c}</Pill>
                  ))}
                  {(!enrollee.disease_cohorts || enrollee.disease_cohorts.length === 0) && (
                    <span style={{ fontSize: 13, color: 'var(--lw-muted)' }}>None assigned</span>
                  )}
                </div>
              </div>

              {enrollee.next_refill && (
                <div style={{ padding: '12px 14px', background: days != null && days <= 3 ? 'var(--s-danger-bg)' : days != null && days <= 7 ? 'var(--s-warn-bg)' : 'var(--s-success-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Next refill</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: days != null && days <= 3 ? 'var(--s-danger)' : days != null && days <= 7 ? 'var(--s-warn)' : 'var(--s-success)' }}>
                    {fmtDate(enrollee.next_refill)}{days != null ? ` · in ${days} days` : ''}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  ['Adherence', `${enrollee.adherence ?? '—'}%`],
                  ['Copay', fmtMoney(enrollee.copay)],
                  ['Benefit Cap', fmtMoney(enrollee.benefit_cap)],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', border: '1px solid var(--lw-grey-line)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lw-charcoal)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Medications ─── */}
          {tab === 'medications' && (
            <div>
              {medsLoading && (
                <div style={{ color: 'var(--lw-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading medications…</div>
              )}
              {!medsLoading && meds !== null && (
                <>
                  {/* Chronic limit widget */}
                  {enrollee.benefit_cap != null && (
                    <div style={{ padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 12, marginBottom: 14, border: '1px solid var(--lw-grey-line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Chronic limit (benefit cap)</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lw-charcoal)', marginTop: 2 }}>{fmtMoney(enrollee.benefit_cap)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>Total meds on plan</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lw-charcoal)' }}>
                            {medsData ? `${medsData.total_medications} drugs` : '—'}
                          </div>
                        </div>
                      </div>
                      {medsData && medsData.flagged_count > 0 && (
                        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--s-danger-bg)', fontSize: 12, display: 'inline-block' }}>
                          <span style={{ color: 'var(--s-danger)', fontWeight: 700 }}>⚠ {medsData.flagged_count} flagged</span>
                          <span style={{ color: 'var(--lw-muted)' }}> (brand conflict / duplicate)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 100px', gap: 8, padding: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--lw-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span>Drug / Generic</span><span>Dosage</span><span>Qty/30d</span><span>Route</span>
                  </div>

                  {meds.map((m, i) => (
                    <MedRow key={`${m.drug}-${i}`} med={{ ...m, name: m.drug }} />
                  ))}

                  {meds.length === 0 && (
                    <div style={{ color: 'var(--lw-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No medications on file.</div>
                  )}
                </>
              )}
              {!medsLoading && meds === null && (
                <div style={{ color: 'var(--lw-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Click the tab to load medications.</div>
              )}
            </div>
          )}

          {/* ── Comments ─── */}
          {tab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comments.map((c, i) => (
                <div key={c.id || i} style={{ padding: '10px 12px', background: 'var(--lw-grey-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--lw-charcoal)' }}>{c.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--lw-muted)', marginTop: 4 }}>{c.author || c.by} · {c.timestamp || c.at}</div>
                </div>
              ))}
              {comments.length === 0 && <div style={{ color: 'var(--lw-muted)', fontSize: 13 }}>No comments yet.</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="input" style={{ flex: 1 }} value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Add a note…" onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button className="btn btn--primary btn--sm" onClick={addComment}>Post</button>
              </div>
            </div>
          )}

          {/* ── Audit ─── */}
          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(enrollee.audit_log || []).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, paddingLeft: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lw-red)', marginTop: 4 }} />
                    {i < (enrollee.audit_log.length - 1) && <div style={{ width: 1, flex: 1, background: 'var(--lw-grey-line)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lw-charcoal)' }}>{ev.action}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>{ev.by} · {ev.at}</div>
                  </div>
                </div>
              ))}
              {(!enrollee.audit_log || enrollee.audit_log.length === 0) && (
                <div style={{ color: 'var(--lw-muted)', fontSize: 13 }}>No audit events.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--lw-grey-line)', display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm"><Icon name="send" size={13} /> Message</button>
          <button className="btn btn--ghost btn--sm"><Icon name="calendar-clock" size={13} /> Build refill</button>
          <button className="btn btn--primary btn--sm"><Icon name="package" size={13} /> Start pack</button>
        </div>
      </div>
    </div>
  )
}

// ── Main list ──────────────────────────────────────────────────────────────────
export default function Enrollees({ region, setToast }) {
  const [data, setData]         = useState([])
  const [search, setSearch]     = useState('')
  const [cohort, setCohort]     = useState('all')
  const [statusF, setStatusF]   = useState('all')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch(API_BASE + `/api/enrollees?region=${region}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [region])

  const filtered = data.filter(e => {
    const q = search.toLowerCase()
    const matchQ = !q || e.name.toLowerCase().includes(q)
      || (e.id || '').toLowerCase().includes(q)
      || (e.policy_no || '').toLowerCase().includes(q)
    const matchC = cohort === 'all' || (e.disease_cohorts || []).includes(cohort)
    const matchS = statusF === 'all' || e.status === statusF
    return matchQ && matchC && matchS
  })

  const uniqueStatuses = ['all', ...new Set(data.map(e => e.status))]

  if (loading) return <div className="page" style={{ color: 'var(--lw-muted)', padding: 48 }}>Loading…</div>

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input placeholder="Search name or policy number…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 165 }} value={cohort} onChange={e => setCohort(e.target.value)}>
          {COHORT_OPTS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input" style={{ width: 160 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>{filtered.length} members</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Policy No</th>
              <th>Scheme</th>
              <th>Diagnosis</th>
              <th>Region</th>
              <th>Next Refill</th>
              <th>Adherence</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const days = daysBetween(TODAY, e.next_refill)
              return (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={e.name} size={28} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--lw-charcoal)', fontSize: 13 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{e.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.id}</td>
                  <td style={{ fontSize: 12.5 }}>{e.scheme}</td>
                  <td style={{ fontSize: 12, maxWidth: 160 }}>
                    <span title={(e.disease_cohorts || []).map(c => COHORT_NAMES[c] || c).join(', ')}>
                      {diagnosisLabel(e.disease_cohorts)}
                    </span>
                  </td>
                  <td>{e.region}</td>
                  <td>
                    {e.next_refill ? (
                      <>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: days <= 3 ? 'var(--s-danger)' : days <= 7 ? 'var(--s-warn)' : 'var(--lw-ink)' }}>
                          {fmtDate(e.next_refill)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>in {days}d</div>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    {e.adherence != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="prog" style={{ width: 60 }}>
                          <div style={{ width: `${e.adherence}%`, background: e.adherence >= 85 ? 'var(--s-success)' : e.adherence >= 70 ? 'var(--s-warn)' : 'var(--s-danger)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{e.adherence}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td><StatusPill status={e.status} /></td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={ev => { ev.stopPropagation(); setSelected(e) }}>
                      <Icon name="chevron-right" size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--lw-muted)', padding: 32 }}>No enrollees match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <EnrolleeDrawer enrollee={selected} onClose={() => setSelected(null)} setToast={msg => setToast(msg)} />}
    </div>
  )
}
