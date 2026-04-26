import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { API_BASE } from '../lib/api'
import { Icon, Pill, fmtMoney } from '../components/ui'

// ── Excel date serial → JS Date ───────────────────────────────────────────────
function excelDateToString(serial) {
  if (!serial || isNaN(serial)) return String(serial || '')
  const date = new Date(Math.round((Number(serial) - 25569) * 86400 * 1000))
  return date.toISOString().slice(0, 10)
}

// ── Template download (matches actual upload format) ──────────────────────────
function downloadTemplate() {
  const headers = [
    'entryno', 'enrolleeid', 'enrolleename', 'Company', 'Provider Code',
    'Provider Name', 'procedurename', 'procdeureid', 'diagnosisname',
    'diagnosis_id', 'scheme', 'provider_cost', 'procedurequantity', 'cost',
    'Next Refill Date', 'totalcost', 'Member Address', 'City', 'State', 'Phone Number',
  ]
  const sample = [
    ['1', '21008950/0', '', '', '10001', '', 'METFORMIN 500MG TABLETS', 'OT0217', 'Type 2 diabetes mellitus', 'E11', '', '420', '60', '', '2026-07-01', '25200', '14 Adeniyi Jones', 'Ikeja', 'Lagos', '08012345678'],
    ['2', '21008950/0', '', '', '10001', '', 'LISINOPRIL 10MG', 'AHC1006', 'Essential (primary) hypertension', 'I10', '', '480', '30', '', '2026-07-01', '14400', '14 Adeniyi Jones', 'Ikeja', 'Lagos', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
  ws['!cols'] = headers.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PBM Upload')
  XLSX.writeFile(wb, 'PBM_BulkUpload_Template.xlsx')
}

// ── Parse raw sheet rows into drug-line objects ───────────────────────────────
const COL_MAP = {
  entryno: ['entryno', 'entry no', 'entry'],
  enrolleeid: ['enrolleeid', 'enrollee id', 'member id', 'memberid'],
  enrolleename: ['enrolleename', 'enrollee name', 'member name'],
  company: ['company'],
  provider_code: ['provider code', 'providercode'],
  provider_name: ['provider name', 'providername'],
  procedurename: ['procedurename', 'procedure name', 'drug name', 'drugname'],
  procdeureid: ['procdeureid', 'procedureid', 'procedure id', 'drug code', 'drugcode'],
  diagnosisname: ['diagnosisname', 'diagnosis name', 'diagnosis'],
  diagnosis_id: ['diagnosis_id', 'diagnosisid', 'icd code', 'icd'],
  scheme: ['scheme', 'plan'],
  provider_cost: ['provider_cost', 'provider cost', 'unit cost', 'unitcost'],
  procedurequantity: ['procedurequantity', 'procedure quantity', 'qty', 'quantity'],
  cost: ['cost'],
  next_refill_date: ['next refill date', 'next refill', 'refill date'],
  totalcost: ['totalcost', 'total cost', 'total'],
  address: ['member address', 'address'],
  city: ['city'],
  state: ['state'],
  phone: ['phone number', 'phone', 'phonenumber'],
}

function resolveHeader(raw) {
  const normalized = String(raw || '').trim().toLowerCase()
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    if (aliases.includes(normalized)) return key
  }
  return normalized
}

function parseSheet(data) {
  if (!data || data.length < 2) return []
  const rawHeaders = data[0]
  const headers = rawHeaders.map(resolveHeader)

  return data.slice(1)
    .filter(row => row.some(Boolean))
    .map((row, idx) => {
      const obj = {}
      headers.forEach((h, i) => {
        let val = row[i] !== undefined ? String(row[i]).trim() : ''
        if (h === 'next_refill_date' && val && !isNaN(Number(val))) {
          val = excelDateToString(Number(val))
        }
        obj[h] = val
      })
      obj._row = idx + 2
      obj._errors = []
      if (!obj.enrolleeid) obj._errors.push('Missing enrollee ID')
      if (!obj.provider_code) obj._errors.push('Missing provider code')
      if (!obj.procedurename && !obj.procdeureid) obj._errors.push('Missing procedure/drug')
      if (!obj.provider_cost) obj._errors.push('Missing unit cost')
      if (!obj.procedurequantity) obj._errors.push('Missing quantity')
      // Fields that Prognosis will fill — mark as pending
      obj._prognosis_pending = !obj.enrolleename || !obj.company || !obj.scheme || !obj.provider_name
      obj._synced = false
      return obj
    })
}

// Group drug lines by enrollee for display
function groupByEnrollee(rows) {
  const map = new Map()
  rows.forEach(r => {
    if (!map.has(r.enrolleeid)) {
      map.set(r.enrolleeid, {
        enrolleeid: r.enrolleeid,
        enrolleename: r.enrolleename,
        company: r.company,
        scheme: r.scheme,
        phone: r.phone,
        address: [r.address, r.city, r.state].filter(Boolean).join(', '),
        provider_code: r.provider_code,
        provider_name: r.provider_name,
        lines: [],
        _errors: [],
        _synced: false,
      })
    }
    const grp = map.get(r.enrolleeid)
    grp.lines.push(r)
    if (r._errors.length) grp._errors.push(...r._errors.map(e => `Row ${r._row}: ${e}`))
  })
  return Array.from(map.values())
}

const STEPS = ['Upload file', 'Preview & validate', 'Prognosis sync', 'Confirm & submit']

// ── Step 1: Upload ────────────────────────────────────────────────────────────
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

      {/* Column legend */}
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--lw-grey-bg)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--lw-charcoal)', marginBottom: 10 }}>Expected columns (one row per drug line)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
          {[
            ['enrolleeid', 'Member policy number', false],
            ['Provider Code', 'Prognosis provider code', false],
            ['procedurename', 'Drug / procedure name', false],
            ['procdeureid', 'Drug / procedure code', false],
            ['diagnosisname', 'Diagnosis description', false],
            ['diagnosis_id', 'ICD-10 code', false],
            ['provider_cost', 'Unit cost (₦)', false],
            ['procedurequantity', 'Quantity', false],
            ['Next Refill Date', 'Date or Excel serial', false],
            ['enrolleename', 'Auto-filled by Prognosis', true],
            ['Company', 'Auto-filled by Prognosis', true],
            ['scheme', 'Auto-filled by Prognosis', true],
            ['Provider Name', 'Auto-filled by Prognosis', true],
          ].map(([col, desc, auto]) => (
            <div key={col} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
              <span style={{ fontFamily: 'monospace', color: auto ? '#2563EB' : 'var(--lw-charcoal)', fontWeight: 600, minWidth: 110 }}>{col}</span>
              <span style={{ color: 'var(--lw-muted)' }}>{desc}</span>
              {auto && <Pill kind="info" style={{ fontSize: 10 }}>auto</Pill>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Preview ───────────────────────────────────────────────────────────
function PreviewStep({ groups, totalLines }) {
  const errCount = groups.filter(g => g._errors.length > 0).length
  const pendingSync = groups.filter(g => !g.enrolleename || !g.company || !g.scheme).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--s-success-bg)', fontSize: 13 }}>
          <strong style={{ color: 'var(--s-success)' }}>{groups.length}</strong> <span style={{ color: 'var(--lw-muted)' }}>members · {totalLines} drug lines</span>
        </div>
        {pendingSync > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#E6EEFB', fontSize: 13 }}>
            <strong style={{ color: '#2563EB' }}>{pendingSync}</strong> <span style={{ color: 'var(--lw-muted)' }}>members need Prognosis lookup</span>
          </div>
        )}
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
              <th>Enrollee ID</th>
              <th>Name <span style={{ color: '#2563EB', fontWeight: 400 }}>(Prognosis)</span></th>
              <th>Company <span style={{ color: '#2563EB', fontWeight: 400 }}>(Prognosis)</span></th>
              <th>Scheme <span style={{ color: '#2563EB', fontWeight: 400 }}>(Prognosis)</span></th>
              <th>Provider</th>
              <th>Drug lines</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.enrolleeid} style={{ background: g._errors.length ? 'rgba(198,21,49,.04)' : 'transparent' }}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{g.enrolleeid || <span style={{ color: 'var(--s-danger)' }}>missing</span>}</td>
                <td style={{ fontSize: 12.5 }}>
                  {g.enrolleename
                    ? <span style={{ fontWeight: 600 }}>{g.enrolleename}</span>
                    : <span style={{ color: '#2563EB', fontStyle: 'italic' }}>pending sync</span>}
                </td>
                <td style={{ fontSize: 12 }}>
                  {g.company || <span style={{ color: '#2563EB', fontStyle: 'italic' }}>pending sync</span>}
                </td>
                <td style={{ fontSize: 12 }}>
                  {g.scheme || <span style={{ color: '#2563EB', fontStyle: 'italic' }}>pending sync</span>}
                </td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ fontFamily: 'monospace' }}>{g.provider_code}</div>
                  {g.provider_name
                    ? <div style={{ fontSize: 11, color: 'var(--lw-muted)' }}>{g.provider_name}</div>
                    : <div style={{ fontSize: 11, color: '#2563EB', fontStyle: 'italic' }}>name pending</div>}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {g.lines.map((l, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: 'var(--lw-muted)' }}>
                        <span style={{ fontFamily: 'monospace', marginRight: 4 }}>{l.procdeureid}</span>
                        {l.procedurename} × {l.procedurequantity}
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  {g._errors.length > 0
                    ? <Pill kind="danger" title={g._errors.join('\n')}>Error</Pill>
                    : <Pill kind="success">OK</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Step 3: Prognosis Sync ────────────────────────────────────────────────────
function SyncStep({ groups, syncing, onSync }) {
  const synced  = groups.filter(g => g._synced).length
  const total   = groups.filter(g => g._errors.length === 0).length

  return (
    <div>
      <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--lw-grey-bg)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6EEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="refresh-cw" size={18} style={{ color: '#2563EB' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--lw-charcoal)', marginBottom: 4 }}>Prognosis auto-population</div>
          <div style={{ fontSize: 12.5, color: 'var(--lw-muted)', lineHeight: 1.55 }}>
            For each member ID and provider code, Prognosis will supply:<br />
            <strong style={{ color: 'var(--lw-charcoal)' }}>Enrollee name · Company · Scheme/plan · Provider name</strong>
          </div>
        </div>
        <button className="btn btn--primary" onClick={onSync} disabled={syncing || synced === total} style={{ flexShrink: 0 }}>
          {syncing
            ? <><Icon name="loader-circle" size={14} /> Syncing…</>
            : synced === total
              ? <><Icon name="check-circle" size={14} /> All synced</>
              : <><Icon name="refresh-cw" size={14} /> Sync {total} members</>}
        </button>
      </div>

      {synced > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Enrollee ID</th>
                <th>Name <Pill kind="info" style={{ fontSize: 10, marginLeft: 4 }}>from Prognosis</Pill></th>
                <th>Company</th>
                <th>Scheme</th>
                <th>Provider name</th>
                <th>Drug lines</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.filter(g => g._synced).map(g => {
                const totalCost = g.lines.reduce((s, l) => s + (Number(l.provider_cost) * Number(l.procedurequantity) || 0), 0)
                return (
                  <tr key={g.enrolleeid}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{g.enrolleeid}</td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{g.enrolleename}</td>
                    <td style={{ fontSize: 12 }}>{g.company}</td>
                    <td style={{ fontSize: 12 }}>{g.scheme}</td>
                    <td style={{ fontSize: 12 }}>{g.provider_name}</td>
                    <td>
                      {g.lines.map((l, i) => (
                        <div key={i} style={{ fontSize: 11.5, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--lw-muted)', marginRight: 4 }}>{l.procdeureid}</span>
                          {l.procedurename} × {l.procedurequantity}
                          <strong style={{ color: 'var(--s-success)', marginLeft: 6 }}>
                            {fmtMoney(Number(l.provider_cost) * Number(l.procedurequantity))}
                          </strong>
                        </div>
                      ))}
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--lw-charcoal)', marginTop: 4 }}>
                        Total: {fmtMoney(totalCost)}
                      </div>
                    </td>
                    <td><Pill kind="success"><Icon name="check" size={11} /> Synced</Pill></td>
                  </tr>
                )
              })}
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
  const [rawRows, setRawRows] = useState([])
  const [groups, setGroups]   = useState([])
  const [syncing, setSyncing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [sessions, setSessions] = useState([
    { id: 'BU-001', date: '2026-04-10', file: 'April_Bulk_Upload.xlsx',  total: 18, ok: 16, errors: 2 },
    { id: 'BU-002', date: '2026-04-03', file: 'March_Latecomers.xlsx',   total: 7,  ok: 7,  errors: 0 },
  ])

  const onFile = (data, name) => {
    const rows = parseSheet(data)
    const grps = groupByEnrollee(rows)
    setRawRows(rows)
    setGroups(grps)
    setFileName(name)
    setStep(1)
  }

  // Prognosis sync — calls real API when wired; mock fills blanks for now
  const doSync = async () => {
    setSyncing(true)
    try {
      // TODO: replace mock with real Prognosis API calls:
      //   GET /prognosis/members/{enrolleeid}  → { name, company, scheme }
      //   GET /prognosis/providers/{provider_code} → { name }
      await new Promise(r => setTimeout(r, 1400))
      setGroups(prev => prev.map(g => {
        if (g._errors.length > 0) return g
        return {
          ...g,
          enrolleename: g.enrolleename || `${g.enrolleeid} (Prognosis)`,
          company:      g.company      || 'Leadway Assurance',
          scheme:       g.scheme       || 'Standard',
          provider_name: g.provider_name || `Provider ${g.provider_code}`,
          _synced: true,
        }
      }))
      setToast('Prognosis sync complete — member details auto-populated')
    } catch {
      setToast('Prognosis sync failed — check API connection', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const doSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1200))
    const validGroups  = groups.filter(g => g._errors.length === 0)
    const errorGroups  = groups.filter(g => g._errors.length > 0)
    const id = `BU-${String(sessions.length + 3).padStart(3, '0')}`
    setSessions(prev => [{
      id, date: new Date().toISOString().slice(0, 10), file: fileName,
      total: groups.length, ok: validGroups.length, errors: errorGroups.length,
    }, ...prev])
    setResults({ total: groups.length, ok: validGroups.length, errors: errorGroups.length, lines: rawRows.length })
    setSubmitting(false)
    setStep(3)
    setToast(`${validGroups.length} members uploaded — ${rawRows.length} drug lines processed`)
  }

  const validGroups  = groups.filter(g => g._errors.length === 0)
  const syncedGroups = groups.filter(g => g._synced)
  const canProceed   = [
    true,
    groups.length > 0,
    syncedGroups.length === validGroups.length && validGroups.length > 0,
    true,
  ]

  const reset = () => { setStep(0); setRawRows([]); setGroups([]); setFileName(''); setResults(null) }

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
                <div style={{ fontSize: 12, color: 'var(--lw-muted)', marginBottom: 6 }}>{s.date} · {s.total} members</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Pill kind="success">{s.ok} uploaded</Pill>
                  {s.errors > 0 && <Pill kind="danger">{s.errors} errors</Pill>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        {/* Step indicator */}
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
        {step === 1 && <PreviewStep groups={groups} totalLines={rawRows.length} />}
        {step === 2 && <SyncStep groups={groups} syncing={syncing} onSync={doSync} />}
        {step === 3 && results && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--s-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="check-circle-2" size={32} style={{ color: 'var(--s-success)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lw-charcoal)', marginBottom: 6 }}>Upload complete</div>
            <div style={{ fontSize: 13, color: 'var(--lw-muted)', marginBottom: 6 }}>
              <strong style={{ color: 'var(--s-success)' }}>{results.ok}</strong> members · <strong>{results.lines}</strong> drug lines processed.
            </div>
            {results.errors > 0 && (
              <div style={{ fontSize: 13, color: 'var(--s-danger)', marginBottom: 16 }}>
                <strong>{results.errors}</strong> members skipped due to errors — fix and re-upload.
              </div>
            )}
            <button className="btn btn--primary" onClick={reset}><Icon name="upload" size={14} /> New upload session</button>
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--lw-grey-line)' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => step > 0 && setStep(s => s - 1)} disabled={step === 0}>
              ← Back
            </button>
            {step < 2 && (
              <button className="btn btn--primary" disabled={!canProceed[step]} onClick={() => setStep(s => s + 1)}>
                {step === 0 ? 'Next: Preview' : 'Next: Prognosis sync'} →
              </button>
            )}
            {step === 2 && (
              <button className="btn btn--primary" disabled={!canProceed[2] || submitting} onClick={doSubmit}>
                {submitting
                  ? <><Icon name="loader-circle" size={14} /> Uploading…</>
                  : <><Icon name="upload" size={14} /> Submit {validGroups.length} members</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
