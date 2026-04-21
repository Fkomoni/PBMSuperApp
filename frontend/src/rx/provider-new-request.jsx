// New Medication Request — one-pager. Five numbered sections + sticky footer.

function useDebouncedQuery(value, ms = 250) {
  const [v, setV] = rxS(value);
  rxE(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

const DOSE_OPTIONS = [
  "1 tablet", "2 tablets", "1 capsule", "2 capsules",
  "5 ml", "10 ml", "15 ml", "20 ml",
  "1 puff", "2 puffs", "1 sachet", "1 drop", "2 drops",
  "1 suppository", "1 application",
];
const FREQUENCY_OPTIONS = [
  { v: "OD",  l: "Once daily (OD)" },
  { v: "BD",  l: "Twice daily (BD)" },
  { v: "TDS", l: "Three times daily (TDS)" },
  { v: "QID", l: "Four times daily (QID)" },
  { v: "PRN", l: "As needed (PRN)" },
  { v: "NOCTE", l: "At night (nocte)" },
  { v: "MANE",  l: "In the morning (mane)" },
  { v: "STAT",  l: "Immediately (stat)" },
  { v: "Q8H",   l: "Every 8 hours" },
  { v: "Q12H",  l: "Every 12 hours" },
];
const DURATION_OPTIONS = [
  { v: 3,   l: "3 days" },
  { v: 5,   l: "5 days" },
  { v: 7,   l: "7 days" },
  { v: 10,  l: "10 days" },
  { v: 14,  l: "14 days" },
  { v: 21,  l: "21 days" },
  { v: 30,  l: "1 month (30 days)" },
  { v: 60,  l: "2 months" },
  { v: 90,  l: "3 months (chronic)" },
  { v: 180, l: "6 months" },
];
const URGENCY_OPTIONS = [
  { v: "routine", l: "Routine" },
  { v: "urgent",  l: "Urgent" },
  { v: "stat",    l: "STAT (same day)" },
];

// Nigeria states + FCT. Used for the state autocomplete in the
// delivery section.
const NG_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe",
  "Zamfara",
];

// Turn a Pydantic/FastAPI error payload into one friendly sentence.
function humanizeError(err) {
  if (!err) return "Something went wrong. Please try again.";
  const msg = (typeof err === "string" ? err : err.message || "").toLowerCase();

  // Known backend phrases → friendly rewrites
  if (msg.includes("address is required")) return "A delivery address is required.";
  if (msg.includes("phone is required")) return "Member phone number is required.";
  if (msg.includes("enrollee_id is required")) return "Enrollee ID is missing.";
  if (msg.includes("prognosis unreachable")) return "We couldn't reach the Leadway member system. Please try again in a moment.";
  if (msg.includes("prognosis")) return "Member record check failed. Please re-verify the enrollee ID.";
  if (msg.includes("wellahealth")) return "Pharmacy partner is temporarily unavailable. Your request has been saved.";
  if (msg.includes("validation") || msg.includes("unprocessable")) return "Some form fields are incomplete or invalid. Please review and resubmit.";
  if (msg.includes("unauthorized") || msg.includes("401")) return "Your session has expired. Please sign in again.";
  if (msg.includes("404") || msg.includes("not found")) return "That member ID wasn't found on Prognosis. Please check and try again.";
  if (msg.includes("network") || msg.includes("failed to fetch")) return "Network problem. Check your connection and try again.";

  // Fallback — still friendly
  return "We couldn't submit the request. Please try again or contact support on 07080627051.";
}

const ATTACH_MAX_BYTES = 8 * 1024 * 1024;
const ATTACH_ACCEPT_MIME = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];

function _fmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PrescriptionUploader({ files, onChange }) {
  const [drag, setDrag] = rxS(false);
  const [err, setErr] = rxS(null);
  const inputRef = rxR(null);

  const addFiles = (incoming) => {
    setErr(null);
    const accepted = [];
    for (const f of incoming) {
      if (!ATTACH_ACCEPT_MIME.includes((f.type || "").toLowerCase())) {
        setErr(`"${f.name}" is not a PDF or image — skipped`);
        continue;
      }
      if (f.size > ATTACH_MAX_BYTES) {
        setErr(`"${f.name}" is bigger than 8MB — skipped`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) onChange([...(files || []), ...accepted]);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const fs = Array.from(e.dataTransfer?.files || []);
    if (fs.length) addFiles(fs);
  };

  const removeAt = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        style={{
          cursor: "pointer",
          border: `1.5px dashed ${drag ? "var(--rx-red)" : "var(--rx-line)"}`,
          background: drag ? "var(--rx-red-bg, #fff5f5)" : "#fafafb",
          borderRadius: 12,
          padding: "22px 18px",
          textAlign: "center",
          transition: "all .15s",
        }}
      >
        <div style={{ display: "inline-flex", width: 40, height: 40, borderRadius: 999, background: "#fff", alignItems: "center", justifyContent: "center", border: "1px solid var(--rx-line)", marginBottom: 10 }}>
          <RxIcon name="file-up" size={18} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Drop a prescription here, or click to browse</div>
        <div style={{ fontSize: 12, color: "var(--rx-muted)", marginTop: 4 }}>PDF, PNG, JPG — up to 8MB each. Adding a file is optional.</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          style={{ display: "none" }}
          onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      {err && <div style={{ marginTop: 8, fontSize: 12, color: "#b85c00" }}><RxIcon name="alert-triangle" size={12} /> {err}</div>}

      {(files || []).length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 10,
              border: "1px solid var(--rx-line)", background: "#fff",
            }}>
              <RxIcon name={(f.type || "").startsWith("image/") ? "image" : "file-text"} size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }}>{_fmtBytes(f.size)}</div>
              </div>
              <button type="button" onClick={() => removeAt(i)} style={{ background: 0, border: 0, cursor: "pointer", color: "var(--rx-muted)", padding: 4 }} aria-label="Remove">
                <RxIcon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PharmacyPickerButton({ state, lga, selected, onChange }) {
  const [open, setOpen] = rxS(false);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {selected ? (
          <div className="ac__selected" style={{ marginTop: 0, flex: 1, minWidth: 220 }}>
            <RxIcon name="map-pin" size={16} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{selected.name}</div>
              {selected.area || selected.lga ? (
                <div style={{ fontSize: 11.5, fontWeight: 500, opacity: .75 }}>
                  {[selected.area, selected.lga].filter(Boolean).join(", ")}
                </div>
              ) : null}
            </div>
            <button type="button" className="rx-btn rx-btn--ghost rx-btn--sm" style={{ width: "auto" }} onClick={() => setOpen(true)}>Change</button>
            <button type="button" onClick={() => onChange(null)} style={{ background: 0, border: 0, color: "inherit", cursor: "pointer", padding: 4 }} aria-label="Clear"><RxIcon name="x" size={14} /></button>
          </div>
        ) : (
          <button type="button" className="rx-btn rx-btn--sm" style={{ width: "100%" }}
            onClick={() => setOpen(true)}
            disabled={!state || state.length < 3}>
            <RxIcon name="map-pin" size={14} /> Find Pharmacies Near This Address
          </button>
        )}
        {!selected && (
          <span style={{ fontSize: 12, color: "var(--rx-muted)" }}>
            {!state || state.length < 3
              ? "Verify the delivery address above first"
              : "Pick the partner pharmacy closest to the member — WellaHealth will fulfil there"}
          </span>
        )}
      </div>
      {open && (
        <PharmacyPickerModal
          state={state} memberLga={lga}
          onSelect={(p) => { onChange(p); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PharmacyPickerModal({ state, memberLga, onSelect, onClose }) {
  const [items, setItems] = rxS([]);
  const [loading, setLoading] = rxS(false);
  const [err, setErr] = rxS(null);
  const [q, setQ] = rxS("");
  // Default to the member's LGA so the first view is already filtered.
  // Provider can widen to "All LGAs" via the dropdown to see the full list.
  const [lgaFilter, setLgaFilter] = rxS(memberLga || "");

  rxE(() => {
    const s = (state || "").trim();
    if (!s) return;
    let cancelled = false;
    setLoading(true); setErr(null);
    providerApi.listPharmacies(s, null)
      .then(r => { if (!cancelled) setItems(r?.items || []); })
      .catch(e => { if (!cancelled) setErr(e.message || "Couldn't load pharmacies"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [state]);

  const lgas = rxM(() => {
    const s = new Set();
    for (const p of items) if (p.lga) s.add(p.lga);
    return Array.from(s).sort();
  }, [items]);

  const normLga = (s) => (s || "").toLowerCase()
    .replace(/\s*\bl\.?g\.?a\.?\b\s*/g, "").trim();

  const filtered = rxM(() => {
    const ql = q.trim().toLowerCase();
    const lgaL = normLga(lgaFilter);
    const memberLgaL = normLga(memberLga);
    const scored = items
      // tolerant LGA match: case + "LGA" suffix + contains both ways
      .filter(p => {
        if (!lgaL) return true;
        const p_l = normLga(p.lga);
        return p_l === lgaL || p_l.includes(lgaL) || lgaL.includes(p_l);
      })
      .filter(p => !ql || (
        (p.name || "").toLowerCase().includes(ql) ||
        (p.area || "").toLowerCase().includes(ql) ||
        (p.address || "").toLowerCase().includes(ql) ||
        (p.lga || "").toLowerCase().includes(ql)
      ))
      .map(p => {
        const p_l = normLga(p.lga);
        let rank = 2;
        if (memberLgaL && (p_l === memberLgaL || p_l.includes(memberLgaL) || memberLgaL.includes(p_l))) rank = 0;
        else if (lgaL && p_l === lgaL) rank = 1;
        return { p, rank };
      })
      .sort((a, b) => a.rank - b.rank);
    return scored.map(x => x.p);
  }, [items, q, lgaFilter, memberLga]);

  // If the default member-LGA filter matched zero pharmacies, auto-widen
  // to "All LGAs" after the list loads — better than a blank panel.
  rxE(() => {
    if (!loading && items.length > 0 && memberLga && lgaFilter === memberLga) {
      const ml = normLga(memberLga);
      const anyHit = items.some(p => {
        const pl = normLga(p.lga);
        return pl === ml || pl.includes(ml) || ml.includes(pl);
      });
      if (!anyHit) setLgaFilter("");
    }
  }, [loading, items]);

  return (
    <div className="pv-drawer" role="dialog" aria-modal="true">
      <div className="pv-drawer__scrim" onClick={onClose} />
      <div className="pv-drawer__panel" style={{ width: "min(520px, 96vw)" }}>
        <div className="pv-drawer__head">
          <div>
            <div style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800 }}>Select a pharmacy</div>
            <div style={{ fontSize: 12, color: "var(--rx-muted)" }}>
              {loading ? "Loading…" : `${items.length} in ${state}${memberLga ? ` · member LGA ${memberLga}` : ""}`}
            </div>
          </div>
          <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={onClose} style={{ width: 34, padding: 0, height: 34 }}>
            <RxIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--rx-line)" }}>
          <input className="rx-input" placeholder="Search by pharmacy name, area, or street"
            value={q} onChange={e => setQ(e.target.value)} />
          {lgas.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <select className="pv-select" value={lgaFilter} onChange={e => setLgaFilter(e.target.value)}>
                <option value="">All LGAs ({lgas.length})</option>
                {lgas.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="pv-drawer__body" style={{ padding: "14px 20px 24px" }}>
          {err && <RxBanner kind="warn" icon="alert-triangle">{err}</RxBanner>}
          {!err && !loading && filtered.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--rx-muted)", padding: "24px 0", textAlign: "center" }}>
              No pharmacies match.
            </div>
          )}
          {filtered.map((p, i) => {
            const isMemberLga = memberLga && (p.lga || "").toLowerCase() === memberLga.toLowerCase();
            return (
              <button key={p.pharmacy_code} type="button"
                onClick={() => onSelect(p)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: isMemberLga ? "var(--rx-green-bg)" : "var(--rx-card)",
                  border: `1px solid ${isMemberLga ? "#c6ebd3" : "var(--rx-line)"}`,
                  borderRadius: 10, padding: "12px 14px", marginBottom: 10,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                {isMemberLga && (
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#0d7a35", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>
                    Closest to member LGA
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                {(p.area || p.lga) && (
                  <div style={{ fontSize: 12, color: "var(--rx-muted)", marginTop: 2 }}>
                    {[p.area, p.lga].filter(Boolean).join(", ")}
                  </div>
                )}
                {p.address && (
                  <div style={{ fontSize: 12, color: "var(--rx-ink-2)", marginTop: 4 }}>{p.address}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StateField({ value, onChange }) {
  const [q, setQ] = rxS(value || "");
  const [open, setOpen] = rxS(false);
  rxE(() => { setQ(value || ""); }, [value]);

  const matches = rxM(() => {
    const ql = (q || "").toLowerCase();
    if (!ql) return NG_STATES.slice(0, 8);
    return NG_STATES.filter(s => s.toLowerCase().includes(ql)).slice(0, 8);
  }, [q]);

  return (
    <div className="ac">
      <input className="rx-input" placeholder="Type state name..."
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && matches.length > 0 && (
        <div className="ac__drop">
          {matches.map(s => (
            <div key={s} className="ac__item" onMouseDown={() => { onChange(s); setQ(s); setOpen(false); }}>
              <div className="k">{s}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Diagnosis autocomplete (inline, no trigger) ────────────────────
function DiagnosisField({ selected, onAdd, onRemove }) {
  const [q, setQ] = rxS("");
  const [items, setItems] = rxS([]);
  const [loading, setLoading] = rxS(false);
  const dq = useDebouncedQuery(q, 250);

  rxE(() => {
    if (!dq || dq.length < 2) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    providerApi.lookupDiagnoses(dq)
      .then(r => { if (!cancelled) setItems(Array.isArray(r) ? r : (r?.items || [])); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dq]);

  return (
    <div className="rx-field">
      <label>Diagnosis <span style={{ color: "var(--rx-red)" }}>*</span></label>
      <div className="ac">
        <input className="rx-input" value={q} placeholder="Type to search diagnoses..."
          onChange={e => setQ(e.target.value)} />
        {q.length >= 2 && (items.length > 0 || loading) && (
          <div className="ac__drop">
            {loading && <div className="ac__item" style={{ color: "var(--rx-muted)" }}>Searching…</div>}
            {items.slice(0, 10).map((d, i) => {
              const code = d.code || d.icd10 || d.id;
              const name = d.name || d.description || d.label;
              const already = selected.some(s => (s.code || s.id) === code);
              return (
                <div key={code || i} className="ac__item"
                  style={already ? { opacity: .5, cursor: "not-allowed" } : undefined}
                  onMouseDown={() => { if (!already) { onAdd({ code, name }); setQ(""); setItems([]); } }}>
                  <div className="k">{name}</div>
                  <div className="v"><span className="num">{code}</span>{already ? " · already added" : ""}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {selected.map((d, i) => (
            <span key={i} className="pv-chip">
              <span className="num" style={{ fontWeight: 700 }}>{d.code}</span>
              <span>{d.name}</span>
              <button onClick={() => onRemove(d)} aria-label="Remove"><RxIcon name="x" size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── One medication card ─────────────────────────────────────────────
function MedicationCard({ index, item, onChange, onRemove, showRemove }) {
  const [q, setQ] = rxS("");
  const [items, setItems] = rxS([]);
  const [open, setOpen] = rxS(false);
  const dq = useDebouncedQuery(q, 250);

  rxE(() => {
    if (!dq || dq.length < 2) { setItems([]); return; }
    let cancelled = false;
    providerApi.searchMedications(dq)
      .then(r => { if (!cancelled) setItems(Array.isArray(r) ? r : (r?.items || [])); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [dq]);

  const pick = (d) => {
    onChange({
      ...item,
      drug_id: d.id || d.drug_id || d.code,
      drug_name: d.name || d.brand_name || d.drug_name,
      generic: d.generic || d.generic_name,
      strength: d.strength || _parseStrength(d.name || d.brand_name || d.drug_name || "") || item.strength,
      unit_price: d.unit_price || d.tariff || d.price,
      classification: d.classification || d.route || item.classification,
    });
    setQ(""); setItems([]); setOpen(false);
  };

  return (
    <div className="pv-med">
      <div className="pv-med__label">Medication {index + 1}</div>
      {showRemove && (
        <button className="pv-med__remove" onClick={onRemove} aria-label="Remove medication">
          <RxIcon name="trash-2" size={14} />
        </button>
      )}

      <div className="pv-block__row pv-block__row--2" style={{ marginBottom: 14 }}>
        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Drug Name <span style={{ color: "var(--rx-red)" }}>*</span></label>
          {!item.drug_name ? (
            <div className="ac">
              <input className="rx-input" placeholder="Type to search medications..."
                value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)} />
              {open && items.length > 0 && (
                <div className="ac__drop">
                  {items.slice(0, 10).map((d, i) => (
                    <div key={i} className="ac__item" onMouseDown={() => pick(d)}>
                      <div className="k">{d.name || d.brand_name || d.drug_name}</div>
                      <div className="v">
                        {d.generic || d.generic_name || ""}
                        {d.unit_price ? <span className="num"> · ₦{Number(d.unit_price).toLocaleString()}</span> : null}
                        {d.classification ? ` · ${d.classification}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ac__selected" style={{ marginTop: 0 }}>
              <RxIcon name="pill" size={16} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{item.drug_name}</div>
                {item.generic && <div style={{ fontSize: 11.5, fontWeight: 500, opacity: .75 }}>{item.generic}</div>}
              </div>
              <button onClick={() => onChange({ ...item, drug_id: null, drug_name: "", generic: "", unit_price: null })}
                style={{ background: 0, border: 0, color: "inherit", cursor: "pointer", padding: 4 }}>
                <RxIcon name="x" size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Strength</label>
          <input className="rx-input" placeholder="Auto-filled when you select a drug"
            value={item.strength || ""} onChange={e => onChange({ ...item, strength: e.target.value })} />
        </div>
      </div>

      <div className="pv-block__row pv-block__row--3">
        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Dose <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <select className="pv-select"
            value={item.dose || ""} onChange={e => onChange({ ...item, dose: e.target.value })}>
            <option value="">Select dose</option>
            {DOSE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Frequency <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <select className="pv-select"
            value={item.frequency || ""} onChange={e => onChange({ ...item, frequency: e.target.value })}>
            <option value="">Select</option>
            {FREQUENCY_OPTIONS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
        </div>
        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Duration <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <select className="pv-select"
            value={item.duration_days || ""} onChange={e => onChange({ ...item, duration_days: e.target.value })}>
            <option value="">Select</option>
            {DURATION_OPTIONS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function _parseStrength(name) {
  const m = /(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%|iu))/i.exec(name || "");
  return m ? m[1] : "";
}

function AddressFieldInline({ value, onChange, placeholder }) {
  const [q, setQ] = rxS(value?.formatted || "");
  const [sugs, setSugs] = rxS([]);
  const [open, setOpen] = rxS(false);
  const dq = useDebouncedQuery(q, 300);

  rxE(() => {
    // Don't fetch suggestions when a Google result was already picked —
    // otherwise every keystroke runs autocomplete. `place_id` being set
    // means the user accepted a Google suggestion.
    if (!dq || dq.length < 3 || (value && value.place_id && value.formatted === dq)) {
      setSugs([]); return;
    }
    let cancelled = false;
    providerApi.addressAutocomplete(dq)
      .then(r => {
        if (cancelled) return;
        setSugs(Array.isArray(r) ? r : (r?.predictions || r?.items || []));
      })
      .catch(() => { if (!cancelled) setSugs([]); });
    return () => { cancelled = true; };
  }, [dq]);

  const pickSug = async (s) => {
    const pid = s.place_id || s.id;
    setOpen(false);
    if (pid) {
      try {
        const d = await providerApi.addressDetails(pid);
        const formatted = d?.formatted_address || s.description || s.label;
        onChange({
          formatted,
          lat: d?.lat ?? d?.location?.lat,
          lng: d?.lng ?? d?.location?.lng,
          place_id: pid,
          state: d?.state,
          lga:   d?.lga,
        });
        setQ(formatted || "");
      } catch {
        onChange({ formatted: s.description || s.label, place_id: pid });
        setQ(s.description || s.label || "");
      }
    } else {
      onChange({ formatted: s.description || s.label });
      setQ(s.description || s.label || "");
    }
  };

  return (
    <div className="ac">
      <input className="rx-input" placeholder={placeholder || "Start typing address..."}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); onChange({ formatted: e.target.value, ...(value?.place_id ? {} : {}) }); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && sugs.length > 0 && (
        <div className="ac__drop">
          {sugs.slice(0, 8).map((s, i) => (
            <div key={s.place_id || i} className="ac__item" onMouseDown={() => pickSug(s)}>
              <div className="k">{s.main_text || s.description?.split(",")[0] || s.label}</div>
              <div className="v">{s.secondary_text || s.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Routing preview (mirrors backend rules) ────────────────────────
function previewRoute({ classifications, state }) {
  const isLagos = (state || "").toLowerCase() === "lagos";

  const hasChronic = classifications.includes("chronic");
  const hasAcute = classifications.includes("acute");
  const hasSpecial = classifications.includes("special");

  if (hasSpecial) return { channel: isLagos ? "Leadway PBM · WhatsApp #1" : "Leadway PBM · WhatsApp #2", kind: "special" };
  if (hasChronic && hasAcute) return { channel: "Leadway PBM · WhatsApp #1 (mixed)", kind: "mixed" };
  if (hasChronic) return { channel: "Leadway PBM · WhatsApp #2", kind: "chronic" };
  if (hasAcute) return { channel: "WellaHealth partner pharmacy", kind: "acute" };
  return { channel: "—", kind: "none" };
}

// ═════════════════════════════════════════════════════════════════════
// Main one-pager
// ═════════════════════════════════════════════════════════════════════
function ProviderNewRequest({ session, initialMember, onSubmitted, onCancel }) {
  // Section 1 — Enrollee
  const [memberId, setMemberId] = rxS(initialMember?.enrollee_id || initialMember?.member_id || "");
  const [member, setMember] = rxS(initialMember || null);
  const [lookingUp, setLookingUp] = rxS(false);
  const [lookupErr, setLookupErr] = rxS(null);
  const [memberPhone, setMemberPhone] = rxS(initialMember?.phone || "");
  const [altPhone, setAltPhone] = rxS("");
  const [memberEmail, setMemberEmail] = rxS(initialMember?.email || "");
  // Track which fields came from Prognosis so we show the green chip.
  const [phoneFromProg, setPhoneFromProg] = rxS(!!initialMember?.phone);
  const [emailFromProg, setEmailFromProg] = rxS(!!initialMember?.email);

  // Section 2 — Clinical
  const [diagnoses, setDiagnoses] = rxS([]);
  const [treatingDoctor, setTreatingDoctor] = rxS("");

  // Section 3 — Medications
  const [drugs, setDrugs] = rxS([{ id: 1 }]);

  // Section 4 — Delivery
  const [state, setState] = rxS(initialMember?.state || "");
  const [address, setAddress] = rxS(null);

  // When Google Places returns a state on the picked address, auto-fill
  // the State field so the pharmacy picker can load without a second step.
  rxE(() => {
    if (address?.state && !state) setState(address.state);
  }, [address?.state]);

  // Section 5 — Additional
  const [urgency, setUrgency] = rxS("routine");
  const [notes, setNotes] = rxS("");

  // Partner pharmacy — object shown in the UI, code sent to backend
  const [pharmacy, setPharmacy] = rxS(null);
  const pharmacyCode = pharmacy?.pharmacy_code || null;

  // Optional prescription uploads — stored as in-memory File objects until
  // submit, then uploaded one by one to the newly created request id.
  const [attachments, setAttachments] = rxS([]);

  const [submitting, setSubmitting] = rxS(false);
  const [submitErr, setSubmitErr] = rxS(null);

  const lookup = async () => {
    const id = memberId.trim();
    if (!id) { setLookupErr("Enter a member ID"); return; }
    setLookupErr(null); setLookingUp(true);
    try {
      const data = await providerApi.lookupEnrollee(id);
      setMember(data);
      if (data?.phone) { setMemberPhone(data.phone); setPhoneFromProg(true); }
      else setPhoneFromProg(false);
      if (data?.email) { setMemberEmail(data.email); setEmailFromProg(true); }
      else setEmailFromProg(false);
      if (data?.address && !address) setAddress({ formatted: data.address });
      // State is intentionally NOT auto-populated — the provider types
      // where the member will actually pick up / receive the delivery,
      // which may differ from the member's registered state.
    } catch (e) {
      setMember(null);
      setLookupErr(e.message || "Member not found");
    } finally {
      setLookingUp(false);
    }
  };

  const addDrug = () => setDrugs(d => [...d, { id: Date.now() }]);
  const updateDrug = (idx, v) => setDrugs(d => d.map((x, i) => i === idx ? v : x));
  const removeDrug = (idx) => setDrugs(d => d.length === 1 ? [{ id: Date.now() }] : d.filter((_, i) => i !== idx));

  const validDrugs = drugs.filter(d => d.drug_name && d.dose && d.frequency && d.duration_days);
  const classifications = Array.from(new Set(validDrugs.map(d => d.classification).filter(Boolean)));
  const routing = rxM(() => previewRoute({ classifications, state }), [classifications.join("|"), state]);

  const canSubmit =
    member &&
    memberPhone.trim().length >= 10 &&
    diagnoses.length > 0 &&
    validDrugs.length > 0 &&
    !!address?.formatted &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setSubmitErr(null);
    try {
      // Use what the provider typed first (always a proper "21000645/0"
      // string); fall back to Prognosis only if the form is empty. Prognosis
      // sometimes echoes an internal numeric id — coerce anything to string.
      const finalEnrolleeId = String(
        memberId.trim() || member.enrollee_id || member.member_id || ""
      );
      const payload = {
        enrollee_id: finalEnrolleeId,
        diagnoses: diagnoses.map(d => ({ code: d.code, name: d.name })),
        items: validDrugs.map(d => {
          const dosage = [d.strength, d.dose, d.frequency].filter(Boolean).join(" ");
          const durationDays = Number(d.duration_days) || null;
          // derive quantity if caller didn't supply one
          let qty = d.quantity ? Number(d.quantity) : null;
          if (!qty) {
            const doseCount = parseInt((d.dose || "").match(/^\d+/)?.[0] || "1", 10);
            const freqMap = { OD: 1, BD: 2, TDS: 3, QID: 4, Q8H: 3, Q12H: 2 };
            const perDay = freqMap[d.frequency] || 1;
            qty = durationDays ? doseCount * perDay * durationDays : doseCount * perDay;
          }
          return {
            drug_id: d.drug_id,
            drug_name: d.drug_name,
            generic: d.generic,
            dosage: dosage || d.drug_name,
            quantity: qty,
            duration_days: durationDays,
            classification_hint: d.classification || null,
            unit_price: d.unit_price || null,
          };
        }),
        delivery: address ? {
          formatted: address.formatted,
          lat: address.lat,
          lng: address.lng,
          place_id: address.place_id,
        } : null,
        member_phone: memberPhone || null,
        member_email: memberEmail || null,
        member_state: state || null,
        alt_phone: altPhone || null,
        urgency: urgency || "routine",
        treating_doctor: treatingDoctor || null,
        pharmacy_code: pharmacyCode || null,
        notes: notes || null,
      };
      const r = await providerApi.submitRequest(payload);
      // Fire-and-safe-fail attachment uploads. If any one fails we still
      // keep the submitted request — attachments are optional.
      const rxId = r?.id || r?.request_id;
      if (rxId && attachments.length > 0) {
        for (const f of attachments) {
          try { await providerApi.uploadAttachment(rxId, f); }
          catch (ue) { console.warn("attachment upload failed:", f.name, ue); }
        }
      }
      onSubmitted && onSubmitted(r);
    } catch (e) {
      // Log the real error for diagnostics, show a friendly line to the provider.
      console.error("submit failed:", e);
      setSubmitErr(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const facility = session?.facility || session?.provider_name || "";

  return (
    <div className="pv-onepager">
      <div className="pv-onepager__head">
        <h1>New Medication Request</h1>
        <p>Submit a prescription for an enrolled member.</p>
      </div>

      {/* ───────────── 1. Enrollee ───────────── */}
      <section className="pv-block">
        <div className="pv-block__head"><span className="pv-block__num">1.</span> Enrollee Information</div>

        <div className="rx-field">
          <label>Enrollee ID <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <div className="pv-lookup">
            <input className="rx-input" placeholder="Enter Enrollee ID" value={memberId}
              onChange={e => setMemberId(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") lookup(); }} />
            <button type="button" onClick={lookup} disabled={lookingUp}>
              {lookingUp ? "Looking…" : "Look Up"}
            </button>
          </div>
          {lookupErr && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--rx-red)", fontWeight: 600 }}>{lookupErr}</div>}
          {member && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--rx-green-bg)", border: "1px solid #c6ebd3", borderRadius: 8, fontSize: 13, color: "#0d7a35" }}>
              <strong>{member.name || "Member"}</strong>
              {member.scheme && <> · {member.scheme}</>}
              {member.age && <> · {member.age} yrs</>}
              {member.state && <> · {member.state}</>}
            </div>
          )}
        </div>

        <div className="pv-block__row pv-block__row--3">
          <div className="rx-field" style={{ marginBottom: 0 }}>
            <label>Member Phone <span style={{ color: "var(--rx-red)" }}>*</span></label>
            <input className="rx-input" placeholder="e.g. 08012345678" value={memberPhone}
              onChange={e => { setMemberPhone(e.target.value); setPhoneFromProg(false); }} />
          </div>
          <div className="rx-field" style={{ marginBottom: 0 }}>
            <label>Alternative Phone</label>
            <input className="rx-input" placeholder="Optional" value={altPhone}
              onChange={e => setAltPhone(e.target.value)} />
          </div>
          <div className="rx-field" style={{ marginBottom: 0 }}>
            <label>Member Email</label>
            <input className="rx-input" placeholder={member && !memberEmail ? "Email not on file — add one" : "Optional"}
              value={memberEmail}
              onChange={e => { setMemberEmail(e.target.value); setEmailFromProg(false); }} />
          </div>
        </div>

        {facility && (
          <div className="pv-block__facility">
            <span className="pv-block__facility__k">Facility</span>
            <span className="pv-block__facility__v">{facility}</span>
          </div>
        )}
      </section>

      {/* ───────────── 2. Clinical ───────────── */}
      <section className="pv-block">
        <div className="pv-block__head"><span className="pv-block__num">2.</span> Clinical Information</div>

        <div className="pv-block__row pv-block__row--2">
          <div>
            <DiagnosisField
              selected={diagnoses}
              onAdd={d => setDiagnoses(xs => [...xs, d])}
              onRemove={d => setDiagnoses(xs => xs.filter(x => x.code !== d.code))} />
          </div>
          <div className="rx-field" style={{ marginBottom: 0 }}>
            <label>Treating Doctor <span style={{ color: "var(--rx-muted)" }}>(optional)</span></label>
            <input className="rx-input" placeholder="Dr. name" value={treatingDoctor}
              onChange={e => setTreatingDoctor(e.target.value)} />
          </div>
        </div>
      </section>

      {/* ───────────── 3. Medications ───────────── */}
      <section className="pv-block">
        <div className="pv-block__head"><span className="pv-block__num">3.</span> Medications</div>

        {drugs.map((d, i) => (
          <MedicationCard key={d.id || i}
            index={i}
            item={d}
            onChange={v => updateDrug(i, v)}
            onRemove={() => removeDrug(i)}
            showRemove={drugs.length > 1} />
        ))}

        <button type="button" className="pv-add-med" onClick={addDrug}>
          + Add Another Medication
        </button>
      </section>

      {/* ───────────── 4. Delivery ───────────── */}
      <section className="pv-block">
        <div className="pv-block__head"><span className="pv-block__num">4.</span> Delivery Location</div>

        <div className="rx-field">
          <label>State <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <StateField value={state} onChange={setState} />
        </div>
        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Delivery Address <span style={{ color: "var(--rx-red)" }}>*</span></label>
          <AddressFieldInline value={address} onChange={setAddress} />
          {(address?.state || address?.lga) && (
            <div style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 10px", borderRadius: 999,
              background: "var(--rx-green-bg)", color: "#0d7a35",
              fontSize: 12, fontWeight: 600, border: "1px solid #c6ebd3",
            }}>
              <RxIcon name="map-pin" size={12} />
              {[address.state, address.lga].filter(Boolean).join(" · ")}
              {address.state && address.lga && (
                <span style={{ fontWeight: 500, opacity: .75, marginLeft: 4 }}>
                  detected from address
                </span>
              )}
            </div>
          )}
        </div>

        {(() => {
          const hasState = !!(state || address?.state);
          if (!hasState) return null;
          const stateL = (state || address?.state || "").toLowerCase();
          const toPBMWhatsApp = routing.kind === "chronic" || routing.kind === "mixed" || routing.kind === "special";
          // Lagos + Leadway PBM WhatsApp → Leadway's in-house pharmacy
          // fulfils directly, so skip the partner-pharmacy picker.
          if (toPBMWhatsApp && stateL === "lagos") {
            return (
              <div style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--rx-green-bg)",
                border: "1px solid #c6ebd3",
                color: "#0d7a35",
                fontSize: 12.5, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <RxIcon name="check-circle-2" size={14} />
                Leadway pharmacy (Lagos) fulfils this request directly — no partner pharmacy needed.
              </div>
            );
          }
          const hint = toPBMWhatsApp
            ? "(optional — Leadway PBM will route to the nearest partner pharmacy)"
            : "(optional — WellaHealth auto-assigns if blank)";
          return (
            <div className="rx-field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label>Partner Pharmacy <span style={{ color: "var(--rx-muted)", fontWeight: 500 }}>{hint}</span></label>
              <PharmacyPickerButton state={state || address?.state} lga={address?.lga} selected={pharmacy} onChange={setPharmacy} />
            </div>
          );
        })()}

        {classifications.length > 0 && (
          <div className="pv-route-hint">
            <strong>Routing preview:</strong> {routing.channel}
          </div>
        )}
      </section>

      {/* ───────────── 5. Additional ───────────── */}
      <section className="pv-block">
        <div className="pv-block__head"><span className="pv-block__num">5.</span> Additional Information</div>

        <div className="rx-field">
          <label>Urgency</label>
          <select className="pv-select" value={urgency} onChange={e => setUrgency(e.target.value)}>
            {URGENCY_OPTIONS.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
          </select>
        </div>
        <div className="rx-field">
          <label>Provider Notes</label>
          <textarea className="rx-input" rows={3} placeholder="Optional notes"
            style={{ resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="rx-field" style={{ marginBottom: 0 }}>
          <label>Prescription attachments <span style={{ color: "var(--rx-muted)", fontWeight: 500 }}>(optional — PDF or image, up to 8MB each)</span></label>
          <PrescriptionUploader files={attachments} onChange={setAttachments} />
        </div>
      </section>

      {submitErr && <div style={{ marginBottom: 14 }}><RxBanner kind="warn" icon="alert-triangle">{submitErr}</RxBanner></div>}

      <div className="pv-footer">
        <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={() => onCancel && onCancel()}>Cancel</button>
        <button className="rx-btn rx-btn--sm" onClick={submit} disabled={!canSubmit}>
          {submitting ? <><RxIcon name="loader-2" size={14} /> Submitting…</> : <>Submit Request <RxIcon name="send" size={14} /></>}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { DOSE_OPTIONS, FREQUENCY_OPTIONS, DURATION_OPTIONS, URGENCY_OPTIONS,
  DiagnosisField, MedicationCard, AddressFieldInline,
  ProviderNewRequest, previewRoute, useDebouncedQuery });
