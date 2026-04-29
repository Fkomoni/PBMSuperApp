// Enrollee lookup — type an enrollee ID, see cover, scheme, flags, last refill, current meds.

function ProviderEnrollee({ onStartRequest }) {
  const [q, setQ] = rxS("");
  const [loading, setLoading] = rxS(false);
  const [err, setErr] = rxS(null);
  const [member, setMember] = rxS(null);

  const lookup = async () => {
    const id = q.trim();
    if (!id) { setErr("Enter a member ID"); return; }
    setErr(null); setLoading(true); setMember(null);
    try {
      const data = await providerApi.lookupEnrollee(id);
      setMember(data);
    } catch (e) {
      setErr(e.message || "Member not found");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mpage__head">
        <h1>Member lookup</h1>
        <p>Verify cover before you prescribe. Paste a member ID from the Leadway card.</p>
      </div>

      <div className="mcard" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="rx-input" style={{ flex: 1, minWidth: 240 }} placeholder="e.g. 23069157/0" value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") lookup(); }} />
          <button className="rx-btn" style={{ width: "auto" }} onClick={lookup} disabled={loading}>
            {loading ? <><RxIcon name="loader-2" size={16} /> Looking up…</> : <><RxIcon name="search" size={16} /> Look up</>}
          </button>
        </div>
        {err && <div style={{ marginTop: 12 }}><RxBanner kind="warn" icon="alert-triangle">{err}</RxBanner></div>}
      </div>

      {member && <MemberCover member={member} onStartRequest={onStartRequest} />}
    </>
  );
}

function field(k, v) { return { k, v: v == null || v === "" ? "—" : v }; }

function MemberCover({ member, onStartRequest }) {
  const flag = (member.flag || member.risk_flag || "").toLowerCase();
  const flagKind = flag === "red" ? "red" : flag === "green" ? "green" : null;

  const meds = member.medications || member.chronic_medications || member.meds || [];

  const basic = [
    field("Member ID", member.enrollee_id || member.member_id),
    field("Scheme", member.scheme || member.plan_name),
    field("Company", member.company || member.employer),
    field("Age", member.age),
    field("Phone", member.phone || member.mobile),
    field("Email", member.email),
    field("State", member.state),
    field("Plan expiry", fmtDate(member.expiry_date || member.plan_end_date)),
  ];

  return (
    <>
      <div className="mcard" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="profile__avatar" style={{ width: 62, height: 62, fontSize: 22, margin: 0 }}>
              {(member.name || member.full_name || "L M").split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("")}
            </div>
            <div>
              <div style={{ fontFamily: "Manrope", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{member.name || member.full_name || "—"}</div>
              <div style={{ fontSize: 13, color: "var(--rx-muted)" }} className="num">{member.enrollee_id || member.member_id || ""} · {member.scheme || ""}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {flagKind && <RxBadge kind={flagKind} icon={flagKind === "red" ? "flag" : "flag"}>{flagKind === "red" ? "Red flag" : "Green flag"}</RxBadge>}
                {member.status && <RxBadge kind="blue">{member.status}</RxBadge>}
                {member.vip && <RxBadge kind="purple" icon="crown">VIP</RxBadge>}
              </div>
            </div>
          </div>
          <button className="rx-btn" style={{ width: "auto" }} onClick={() => onStartRequest && onStartRequest(member)}>
            <RxIcon name="file-plus-2" size={16} /> New prescription for this member
          </button>
        </div>

        {flagKind === "red" && (
          <div style={{ marginTop: 14 }}>
            <RxBanner kind="warn" icon="flag">Prognosis has flagged this member (red). {member.flag_reason || "Review their case before dispensing."}</RxBanner>
          </div>
        )}
      </div>

      <div className="mcard" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Cover details</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {basic.map(f => (
            <div key={f.k} className="med__field">
              <div className="med__field__k">{f.k}</div>
              <div className="med__field__v">{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {meds.length > 0 && (
        <div className="msection">
          <div className="msection__head"><h2>Current chronic medications</h2></div>
          <div className="mgrid-meds">
            {meds.map((m, i) => (
              <div key={i} className="med">
                <div className="med__head">
                  <div>
                    <div className="med__name">{m.name || m.brand || m.drug_name}</div>
                    <div className="med__gen">{m.generic || m.generic_name || m.dosage || ""}</div>
                  </div>
                  {m.classification && <RxBadge kind={m.classification === "chronic" ? "purple" : "orange"}>{m.classification}</RxBadge>}
                </div>
                <div className="med__grid">
                  <div className="med__field">
                    <div className="med__field__k">Dosage</div>
                    <div className="med__field__v">{m.dosage || m.strength || "—"}</div>
                  </div>
                  <div className="med__field">
                    <div className="med__field__k">Quantity</div>
                    <div className="med__field__v">{m.quantity || m.qty || "—"}</div>
                  </div>
                </div>
                <div className={`med__refill-bar ${m.overdue ? "is-over" : ""}`}>
                  <span><RxIcon name="calendar" size={13} /> Next refill</span>
                  <span className="num">{fmtDate(m.next_refill || m.nextRefill)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ProviderEnrollee, MemberCover });
