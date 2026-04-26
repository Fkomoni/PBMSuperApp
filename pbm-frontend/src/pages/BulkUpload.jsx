import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Icon, Pill, Avatar, fmtMoney } from '../components/ui'

// ── Template definition ───────────────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  'member_id', 'first_name', 'last_name', 'phone', 'email',
  'plan_code', 'company', 'gender', 'dob',
  'primary_address', 'primary_city', 'primary_state',
  'alt_address', 'alt_city', 'alt_state',
  'drug_code_1', 'drug_name_1', 'qty_1',
  'drug_code_2', 'drug_name_2', 'qty_2',
  'drug_code_3', 'drug_name_3', 'qty_3',
]

const REQUIRED = ['member_id', 'first_name', 'last_name', 'phone', 'plan_code', 'primary_address', 'primary_state']

// Mock Prognosis data keyed by member_id / drug_code
const PROGNOSIS_PLANS = {
  'LH-0201': { start_date: '2024-01-15', end_date: '2026-12-31' },
  'LH-0202': { start_date: '2023-06-01', end_date: '2025-12-31' },
  'LH-0203': { start_date: '2024-03-10', end_date: '2026-09-30' },
  'LH-0204': { start_date: '2023-11-20', end_date: '2025-11-19' },
  'LH-0205': { start_date: '2024-07-01', end_date: '2027-06-30' },
}
const PROGNOSIS_PRICES = {
  'MET500': { name: 'Metformin 500mg', price: 420 },
  'LSN10':  { name: 'Lisinopril 10mg', price: 480 },
  'AML5':   { name: 'Amlodipine 5mg',  price: 620 },
  'ATV20':  { name: 'Atorvastatin 20mg', price: 1100 },
  'GLB5':   { name: 'Glibenclamide 5mg', price: 340 },
  'LOS50':  { name: 'Losartan 50mg',   price: 890 },
}

const STEPS = ['Upload file', 'Preview & validate', 'Prognosis sync', 'Confirm & submit']

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, [
    'LH-0201', 'Amina', 'Bello', '08012345678', 'amina@example.com',
    'GOLD-PLUS', 'Zenith Bank', 'F', '1990-05-12',
    '14 Adeniyi Jones Ave', 'Ikeja', 'Lagos',
    '', '', '',
    'MET500', '', '60', 'LSN10', '', '30', '', '', '',
  ]])
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Members')
  XLSX.writeFile(wb, 'PBM_BulkUpload_Template.xlsx')
}

function parseRows(data) {
  if (!data || data.length < 2) return []
  const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/ /g, '_'))
  return data.slice(1).filter(row => row.some(Boolean)).map((row, idx) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : '' })
    const errors = REQUIRED.filter(k => !obj[k])
    const drugs = [1, 2, 3].map(n => ({
      code: obj[`drug_code_${n}`] || '',
      name: obj[`drug_name_${n}`] || '',
      qty:  parseInt(obj[`qty_${n}`] || '0', 10),
      price: null,
    })).filter(d => d.code || d.name)
    return { _idx: idx + 2, ...obj, drugs, errors, synced: false, start_date: '', end_date: '', _duplicate: false }
  })
}

function validateDuplicates(rows) {
  const seen = new Map()
  return rows.map(r => {
    if (seen.has(r.member_id)) {
      return { ...r, errors: [...r.errors, 'Duplicate member_id in sheet'], _duplicate: true }
    }
    if (r.member_id) seen.set(r.member_id, true)
    return r
  })
}

// ── Step components ───────────────────────────────────────────────────────────
function UploadStep({ onFile }) {
  const ref = useRef()
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
      onFile(data, file.name)
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '24px 0' }}>
      <div
        style={{ width: '100%', maxWidth: 520, border: `2px dashed ${dragging ? 'var(--lw-red)' : 'var(--lw-grey-line)'}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(198,21,49,.03)' : '#fff', transition: 'all .15s' }}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--lw-grey-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icon name="upload" size={26} style={{ color: 'var(--lw-red)' }} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Drop your Excel file here</div>
        <div style={{ fontSize: 13, color: 'var(--lw-muted)' }}>or click to browse — .xlsx, .xls, .csv supported</div>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>
      <button className="btn btn--ghost" onClick={downloadTemplate}>
        <Icon name="download" size={14} /> Download template
      </button>
      <div style={{ fontSize: 12, color: 'var(--lw-muted)', textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
        The template includes columns for <strong>member ID, plan, company, primary &amp; alternative addresses</strong>, and up to 3 drug codes. Drug prices auto-populate from Prognosis in step 3.
      </div>
    </div>
  )
}

function PreviewStep({ rows }) {
  const errCount = rows.filter(r => r.errors.length > 0).length
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--s-success-bg)', fontSize: 13 }}>
          <strong style={{ color: 'var(--s-success)' }}>{rows.length - errCount}</strong> <span style={{ color: 'var(--lw-muted)' }}>valid rows</span>
        </div>
        {errCount > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--s-danger-bg)', fontSize: 13 }}>
            <strong style={{ color: 'var(--s-danger)' }}>{errCount}</strong> <span style={{ color: 'var(--lw-muted)' }}>rows with errors</span>
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Row</th><th>Member ID</th><th>Name</th><th>Phone</th>
              <th>Plan</th><th>Company</th><th>Primary Address</th>
              <th>Alt Address</th><th>Drugs</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r._idx} style={{ background: r.errors.length ? 'rgba(198,21,49,.04)' : 'transparent' }}>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--lw-muted)' }}>{r._idx}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.member_id || <span style={{ color: 'var(--s-danger)' }}>missing</span>}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.first_name} {r.last_name}</td>
                <td style={{ fontSize: 12 }}>{r.phone}</td>
                <td style={{ fontSize: 12 }}>{r.plan_code}</td>
                <td style={{ fontSize: 12 }}>{r.company}</td>
                <td style={{ fontSize: 12, maxWidth: 160 }}>
                  <div className="truncate">{[r.primary_address, r.primary_city, r.primary_state].filter(Boolean).join(', ')}</div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--lw-muted)', maxWidth: 140 }}>
                  {r.alt_address ? <div className="truncate">{[r.alt_address, r.alt_city, r.alt_state].filter(Boolean).join(', ')}</div> : '—'}
                </td>
                <td style={{ fontSize: 12 }}>{r.drugs.length} drug{r.drugs.length !== 1 ? 's' : ''}</td>
                <td>
                  {r.errors.length > 0
                    ? <Pill kind="danger" title={r.errors.join(', ')}>Error</Pill>
                    : r._duplicate
                      ? <Pill kind="warn">Duplicate</Pill>
                      : <Pill kind="success">OK</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errCount > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--s-danger-bg)', borderRadius: 10, fontSize: 12.5, color: 'var(--s-danger)' }}>
          Rows with errors will be skipped during submit. Fix the source file and re-upload to include them.
        </div>
      )}
    </div>
  )
}

function SyncStep({ rows, setRows, syncing, onSync }) {
  const synced = rows.filter(r => r.synced).length
  const total  = rows.filter(r => r.errors.length === 0).length

  return (
    <div>
      <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--lw-grey-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="refresh-cw" size={20} style={{ color: '#2563EB' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)' }}>Prognosis sync</div>
          <div style={{ fontSize: 12, color: 'var(--lw-muted)' }}>Fetches plan start/end dates and auto-populates drug unit prices for each member.</div>
        </div>
        <button className="btn btn--primary" onClick={onSync} disabled={syncing || synced === total}>
          {syncing ? <Icon name="loader-circle" size={14} /> : <Icon name="refresh-cw" size={14} />}
          {syncing ? 'Syncing…' : synced === total ? 'All synced' : `Sync ${total} members`}
        </button>
      </div>

      {synced > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>Member ID</th><th>Name</th><th>Plan start</th><th>Plan end</th><th>Drugs (price auto-filled)</th><th></th></tr>
            </thead>
            <tbody>
              {rows.filter(r => r.synced).map(r => (
                <tr key={r.member_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.member_id}</td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ fontSize: 12.5 }}>{r.start_date || '—'}</td>
                  <td style={{ fontSize: 12.5 }}>{r.end_date || '—'}</td>
                  <td>
                    {r.drugs.map((d, i) => d.code ? (
                      <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--lw-muted)' }}>{d.code}</span>
                        {' '}{d.name}{' '}
                        {d.price !== null ? <strong style={{ color: 'var(--s-success)' }}>₦{d.price.toLocaleString()}</strong> : <span style={{ color: 'var(--s-warn)' }}>price unknown</span>}
                        {' × '}{d.qty}
                      </div>
                    ) : null)}
                  </td>
                  <td><Pill kind="success"><Icon name="check" size={11} /> Synced</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BulkUpload({ setToast }) {
  const [step, setStep]       = useState(0)
  const [fileName, setFileName] = useState('')
  const [rows, setRows]       = useState([])
  const [syncing, setSyncing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  const [sessions, setSessions] = useState([
    { id: 'BU-001', date: '2026-04-10', file: 'April_Bulk_Upload.xlsx', total: 18, ok: 16, errors: 2 },
    { id: 'BU-002', date: '2026-04-03', file: 'March_Latecomers.xlsx',  total: 7,  ok: 7,  errors: 0 },
  ])

  const onFile = (data, name) => {
    const parsed = validateDuplicates(parseRows(data))
    setRows(parsed)
    setFileName(name)
    setStep(1)
  }

  const doSync = async () => {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1200))
    setRows(prev => prev.map(r => {
      if (r.errors.length > 0) return r
      const plan = PROGNOSIS_PLANS[r.member_id] || { start_date: '2025-01-01', end_date: '2026-12-31' }
      const enrichedDrugs = r.drugs.map(d => {
        const match = PROGNOSIS_PRICES[d.code]
        return { ...d, name: match?.name || d.name || d.code, price: match?.price ?? null }
      })
      return { ...r, ...plan, drugs: enrichedDrugs, synced: true }
    }))
    setSyncing(false)
    setToast('Prognosis sync complete')
  }

  const doSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1500))
    const valid = rows.filter(r => r.errors.length === 0)
    const id = `BU-${String(sessions.length + 3).padStart(3, '0')}`
    setSessions(prev => [{ id, date: new Date().toISOString().slice(0, 10), file: fileName, total: rows.length, ok: valid.length, errors: rows.length - valid.length }, ...prev])
    setResults({ total: rows.length, ok: valid.length, errors: rows.length - valid.length })
    setSubmitting(false)
    setStep(3)
    setToast(`${valid.length} members uploaded successfully`)
  }

  const validCount = rows.filter(r => r.errors.length === 0).length
  const syncedCount = rows.filter(r => r.synced).length
  const canProceed = [
    true,
    rows.length > 0,
    syncedCount === validCount && validCount > 0,
    true,
  ]

  const reset = () => { setStep(0); setRows([]); setFileName(''); setResults(null) }

  return (
    <div className="page">
      {/* Past sessions */}
      {sessions.length > 0 && step === 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Recent upload sessions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10 }}>
            {sessions.map(s => (
              <div key={s.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon name="file-spreadsheet" size={16} style={{ color: '#16A34A' }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--lw-charcoal)', flex: 1 }} className="truncate">{s.file}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--lw-muted)' }}>{s.id}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginBottom: 6 }}>{s.date} · {s.total} rows</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Pill kind="success">{s.ok} uploaded</Pill>
                  {s.errors > 0 && <Pill kind="danger">{s.errors} errors</Pill>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="card">
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: i < step ? 'var(--lw-red)' : i === step ? 'var(--lw-charcoal)' : 'var(--lw-grey-line)',
                  color: i <= step ? '#fff' : 'var(--lw-muted)' }}>
                  {i < step ? <Icon name="check" size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--lw-charcoal)' : 'var(--lw-muted)', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1.5, background: i < step ? 'var(--lw-red)' : 'var(--lw-grey-line)', margin: '0 12px' }} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 0 && <UploadStep onFile={onFile} />}
        {step === 1 && <PreviewStep rows={rows} />}
        {step === 2 && <SyncStep rows={rows} setRows={setRows} syncing={syncing} onSync={doSync} />}
        {step === 3 && results && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--s-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="check-circle-2" size={32} style={{ color: 'var(--s-success)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Upload complete</div>
            <div style={{ fontSize: 13, color: 'var(--lw-muted)', marginBottom: 20 }}>
              <strong style={{ color: 'var(--s-success)' }}>{results.ok}</strong> members enrolled successfully.
              {results.errors > 0 && <> <strong style={{ color: 'var(--s-danger)' }}>{results.errors}</strong> rows skipped.</>}
            </div>
            <button className="btn btn--primary" onClick={reset}><Icon name="upload" size={14} /> New upload session</button>
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--lw-grey-line)' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => step === 0 ? null : setStep(s => s - 1)} disabled={step === 0}>
              ← Back
            </button>
            {step < 2 && (
              <button className="btn btn--primary" disabled={!canProceed[step]} onClick={() => setStep(s => s + 1)}>
                {step === 1 ? 'Next: Prognosis sync' : 'Next: Preview'} →
              </button>
            )}
            {step === 2 && (
              <button className="btn btn--primary" disabled={!canProceed[2] || submitting} onClick={doSubmit}>
                {submitting ? <><Icon name="loader-circle" size={14} /> Uploading…</> : <><Icon name="upload" size={14} /> Submit {validCount} members</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
