// New prescription — 4-step wizard:
//   1. Member (enrollee ID lookup)
//   2. Diagnosis (ICD-10 autocomplete, multi-select)
//   3. Medications (drug search, dosage, quantity, duration, classification hint)
//   4. Delivery + review (Google Places address, phone, notes, preview routing, submit)

const STEPS = [
  { key: "member", label: "Member", icon: "user-round" },
  { key: "dx", label: "Diagnosis", icon: "clipboard-pen" },
  { key: "meds", label: "Medications", icon: "pill" },
  { key: "review", label: "Delivery & review", icon: "send" },
];

function Stepper({ step, onStep }) {
  return (
    <div className="pv-steps">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <button key={s.key} className={`pv-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`} onClick={() => i <= step && onStep(i)}>
            <span className="pv-step__dot">{done ? <RxIcon name="check" size={12} /> : <RxIcon name={s.icon} size={12} />}</span>
            <span className="pv-step__label">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function useDebouncedQuery(value, ms = 250) {
  const [v, setV] = rxS(value);
  rxE(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

function DiagnosisPicker({ selected, onAdd, onRemove }) {
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
    <div>
      <RxField label="Search ICD-10 diagnosis">
        <div className="ac">
          <input className="rx-input" value={q} placeholder="e.g. hypertension, E11.9, asthma"
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
      </RxField>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
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

function DrugRow({ item, onChange, onRemove }) {
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
      unit_price: d.unit_price || d.tariff || d.price,
      classification: d.classification || d.route || item.classification,
    });
    setQ(""); setItems([]); setOpen(false);
  };

  return (
    <div className="pv-drug">
      <div className="pv-drug__head">
        {!item.drug_name ? (
          <div className="ac" style={{ flex: 1 }}>
            <input className="rx-input" placeholder="Search drug name (e.g. Amlodipine 10mg)"
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
          <div className="ac__selected" style={{ marginTop: 0, flex: 1 }}>
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

        <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={onRemove}
          style={{ marginLeft: 8, width: 36, padding: 0, height: 40 }}>
          <RxIcon name="trash-2" size={15} />
        </button>
      </div>

      <div className="pv-drug__grid">
        <RxField label="Dosage">
          <input className="rx-input" placeholder="e.g. 10mg OD"
            value={item.dosage || ""} onChange={e => onChange({ ...item, dosage: e.target.value })} />
        </RxField>
        <RxField label="Quantity">
          <input className="rx-input" type="number" min={1} placeholder="30"
            value={item.quantity || ""} onChange={e => onChange({ ...item, quantity: e.target.value })} />
        </RxField>
        <RxField label="Duration (days)">
          <input className="rx-input" type="number" min={1} placeholder="30"
            value={item.duration_days || ""} onChange={e => onChange({ ...item, duration_days: e.target.value })} />
        </RxField>
        <RxField label="Classification">
          <RxSeg
            options={[{ v: "acute", l: "Acute" }, { v: "chronic", l: "Chronic" }, { v: "auto", l: "Auto" }]}
            value={item.classification || "auto"}
            onChange={v => onChange({ ...item, classification: v })} />
        </RxField>
      </div>

      {item.unit_price && item.quantity && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--rx-muted)" }}>
          Tariff: ₦{Number(item.unit_price).toLocaleString()} × {item.quantity} =
          <strong style={{ color: "var(--rx-ink)", marginLeft: 4 }} className="num">
            ₦{(Number(item.unit_price) * Number(item.quantity)).toLocaleString()}
          </strong>
        </div>
      )}
    </div>
  );
}

function AddressPicker({ value, onChange }) {
  const [q, setQ] = rxS(value?.formatted || "");
  const [sugs, setSugs] = rxS([]);
  const [open, setOpen] = rxS(false);
  const dq = useDebouncedQuery(q, 300);

  rxE(() => {
    if (!dq || dq.length < 3 || (value && value.formatted === dq)) { setSugs([]); return; }
    let cancelled = false;
    providerApi.addressAutocomplete(dq)
      .then(r => {
        if (cancelled) return;
        const items = Array.isArray(r) ? r : (r?.predictions || r?.items || []);
        setSugs(items);
      })
      .catch(() => { if (!cancelled) setSugs([]); });
    return () => { cancelled = true; };
  }, [dq, value?.formatted]);

  const pickSug = async (s) => {
    const pid = s.place_id || s.id;
    setOpen(false);
    if (pid) {
      try {
        const d = await providerApi.addressDetails(pid);
        onChange({
          formatted: d?.formatted_address || s.description || s.label,
          lat: d?.lat ?? d?.location?.lat,
          lng: d?.lng ?? d?.location?.lng,
          place_id: pid,
          components: d?.components || d?.address_components,
        });
        setQ(d?.formatted_address || s.description || s.label || "");
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
      <input className="rx-input" placeholder="Start typing the delivery address"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); if (value) onChange({ formatted: e.target.value }); }}
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

// ===== Routing preview — mirrors the backend rules so providers see where their order will land =====
function previewRoute({ classifications, state }) {
  const isLagos = (state || "").toLowerCase() === "lagos";
  const now = new Date();
  const weekday = now.getDay(); // 0 Sun, 6 Sat
  const isWeekday = weekday >= 1 && weekday <= 5;

  const hasChronic = classifications.includes("chronic");
  const hasAcute = classifications.includes("acute");
  const hasSpecial = classifications.includes("special");

  if (hasSpecial) {
    return isLagos
      ? { channel: "Leadway PBM Super App · WhatsApp #1", kind: "special-lagos" }
      : { channel: "Leadway PBM Super App · WhatsApp #2", kind: "special-outside" };
  }
  if (hasChronic && hasAcute) {
    return { channel: "Leadway PBM Super App · WhatsApp #1 (mixed)", kind: "mixed" };
  }
  if (hasChronic) {
    return isLagos
      ? { channel: "Leadway PBM Super App · WhatsApp #2 (chronic, Lagos)", kind: "chronic-lagos" }
      : { channel: "Leadway PBM Super App · WhatsApp #2 (chronic, outside Lagos)", kind: "chronic-outside" };
  }
  if (hasAcute) {
    if (isLagos && isWeekday) return { channel: "Leadway PBM Super App · WhatsApp #1 (acute, Lagos, weekday)", kind: "acute-lagos-weekday" };
    if (isLagos) return { channel: "WellaHealth partner pharmacy (Lagos, weekend/after-hours)", kind: "acute-lagos-weekend" };
    return { channel: "WellaHealth / onboarded partner pharmacy (outside Lagos)", kind: "acute-outside" };
  }
  return { channel: "—", kind: "none" };
}

function ProviderNewRequest({ onSubmitted, initialMember }) {
  const [step, setStep] = rxS(0);
  const [memberId, setMemberId] = rxS(initialMember?.enrollee_id || initialMember?.member_id || "");
  const [member, setMember] = rxS(initialMember || null);
  const [lookingUp, setLookingUp] = rxS(false);
  const [lookupErr, setLookupErr] = rxS(null);

  const [diagnoses, setDiagnoses] = rxS([]);
  const [drugs, setDrugs] = rxS([{ id: 1 }]);
  const [address, setAddress] = rxS(null);
  const [altPhone, setAltPhone] = rxS("");
  const [notes, setNotes] = rxS("");
  const [submitting, setSubmitting] = rxS(false);
  const [submitErr, setSubmitErr] = rxS(null);

  const lookup = async () => {
    const id = memberId.trim();
    if (!id) { setLookupErr("Enter a member ID"); return; }
    setLookupErr(null); setLookingUp(true);
    try {
      const data = await providerApi.lookupEnrollee(id);
      setMember(data);
      if (data?.state) setAddress(a => a || null);
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

  const validDrugs = drugs.filter(d => d.drug_name && d.dosage && d.quantity);
  const classifications = Array.from(new Set(validDrugs.map(d => d.classification).filter(c => c && c !== "auto")));

  const routing = rxM(() => previewRoute({ classifications, state: member?.state }), [classifications.join("|"), member?.state]);

  const canNext = (() => {
    if (step === 0) return !!member;
    if (step === 1) return diagnoses.length > 0;
    if (step === 2) return validDrugs.length > 0;
    return true;
  })();

  const submit = async () => {
    setSubmitting(true); setSubmitErr(null);
    try {
      const payload = {
        enrollee_id: member.enrollee_id || member.member_id || memberId.trim(),
        diagnoses: diagnoses.map(d => ({ code: d.code, name: d.name })),
        items: validDrugs.map(d => ({
          drug_id: d.drug_id,
          drug_name: d.drug_name,
          generic: d.generic,
          dosage: d.dosage,
          quantity: Number(d.quantity),
          duration_days: d.duration_days ? Number(d.duration_days) : null,
          classification_hint: d.classification === "auto" ? null : d.classification,
          unit_price: d.unit_price || null,
        })),
        delivery: address ? {
          formatted: address.formatted,
          lat: address.lat,
          lng: address.lng,
          place_id: address.place_id,
        } : null,
        alt_phone: altPhone || null,
        notes: notes || null,
      };
      const r = await providerApi.submitRequest(payload);
      onSubmitted && onSubmitted(r);
    } catch (e) {
      setSubmitErr(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mpage__head">
        <h1>New prescription</h1>
        <p>Four quick steps. We auto-classify, apply tariff, and route to the right fulfilment channel.</p>
      </div>

      <Stepper step={step} onStep={setStep} />

      <div className="mcard" style={{ marginTop: 18 }}>
        {step === 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Member</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="rx-input" style={{ flex: 1, minWidth: 240 }} placeholder="e.g. 23069157/0" value={memberId}
                onChange={e => setMemberId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") lookup(); }} />
              <button className="rx-btn" style={{ width: "auto" }} onClick={lookup} disabled={lookingUp}>
                {lookingUp ? <><RxIcon name="loader-2" size={16} /> Looking up…</> : <><RxIcon name="search" size={16} /> Verify cover</>}
              </button>
            </div>
            {lookupErr && <div style={{ marginTop: 12 }}><RxBanner kind="warn" icon="alert-triangle">{lookupErr}</RxBanner></div>}
            {member && (
              <div style={{ marginTop: 16 }}>
                <MemberCover member={member} onStartRequest={() => { /* already in-flow */ }} />
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Diagnosis (ICD-10)</div>
            <DiagnosisPicker
              selected={diagnoses}
              onAdd={d => setDiagnoses(xs => [...xs, d])}
              onRemove={d => setDiagnoses(xs => xs.filter(x => x.code !== d.code))} />
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Medications</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {drugs.map((d, i) => (
                <DrugRow key={d.id || i} item={d}
                  onChange={v => updateDrug(i, v)}
                  onRemove={() => removeDrug(i)} />
              ))}
            </div>
            <button className="rx-btn rx-btn--ghost rx-btn--sm" style={{ width: "auto", marginTop: 12 }} onClick={addDrug}>
              <RxIcon name="plus" size={14} /> Add another drug
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Delivery address</div>
            <RxField label="Address (Google Places)">
              <AddressPicker value={address} onChange={setAddress} />
            </RxField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <RxField label="Alternative phone (optional)">
                <input className="rx-input" placeholder="e.g. 08012345678" value={altPhone}
                  onChange={e => setAltPhone(e.target.value)} />
              </RxField>
              <RxField label="Prescriber notes">
                <input className="rx-input" placeholder="Anything PBM or pharmacy should know"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </RxField>
            </div>

            <div style={{ marginTop: 18, padding: 16, background: "#fafafc", border: "1px solid var(--rx-line)", borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Routing preview</div>
              <div style={{ fontSize: 13.5, color: "var(--rx-ink)", marginBottom: 6 }}>
                <RxIcon name="route" size={14} /> {routing.channel}
              </div>
              <div style={{ fontSize: 12, color: "var(--rx-muted)", lineHeight: 1.55 }}>
                Based on member state (<strong>{member?.state || "—"}</strong>), classifications ({classifications.join(", ") || "auto"}) and current time.
              </div>
            </div>

            {submitErr && <div style={{ marginTop: 14 }}><RxBanner kind="warn" icon="alert-triangle">{submitErr}</RxBanner></div>}
          </>
        )}

        <div className="pv-stepbar">
          <button className="rx-btn rx-btn--ghost rx-btn--sm" style={{ width: "auto" }}
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}>
            <RxIcon name="arrow-left" size={14} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button className="rx-btn rx-btn--sm" style={{ width: "auto" }}
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canNext}>
              Next <RxIcon name="arrow-right" size={14} />
            </button>
          ) : (
            <button className="rx-btn rx-btn--sm" style={{ width: "auto" }}
              onClick={submit} disabled={submitting || validDrugs.length === 0}>
              {submitting ? <><RxIcon name="loader-2" size={14} /> Submitting…</> : <><RxIcon name="send" size={14} /> Submit prescription</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { STEPS, Stepper, DiagnosisPicker, DrugRow, AddressPicker, useDebouncedQuery, ProviderNewRequest, previewRoute });
