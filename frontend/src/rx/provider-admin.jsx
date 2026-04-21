// Admin console — every request across providers + summary split by channel.

const CHANNEL_LABELS = {
  wellahealth: "WellaHealth",
  leadway_pbm_whatsapp_1: "Leadway PBM · WhatsApp #1",
  leadway_pbm_whatsapp_2: "Leadway PBM · WhatsApp #2",
};

function channelPill(ch) {
  if (!ch) return <RxBadge kind="grey">—</RxBadge>;
  if (ch === "wellahealth") return <RxBadge kind="orange" icon="truck">WellaHealth</RxBadge>;
  if (ch === "leadway_pbm_whatsapp_1") return <RxBadge kind="red" icon="message-circle">PBM · #1</RxBadge>;
  if (ch === "leadway_pbm_whatsapp_2") return <RxBadge kind="purple" icon="message-circle">PBM · #2</RxBadge>;
  return <RxBadge kind="blue">{ch}</RxBadge>;
}

function AdminConsole() {
  const [summary, setSummary] = rxS(null);
  const [requests, setRequests] = rxS(null);
  const [err, setErr] = rxS(null);
  const [days, setDays] = rxS(30);

  const [channel, setChannel] = rxS("");
  const [classification, setClassification] = rxS("");
  const [state, setState] = rxS("");
  const [q, setQ] = rxS("");
  const [picked, setPicked] = rxS(null);

  const reloadSummary = () => {
    providerApi.admin.summary(days)
      .then(setSummary)
      .catch(e => setErr(e.message));
  };

  const reloadList = () => {
    const params = { limit: 100 };
    if (channel) params.channel = channel;
    if (classification) params.classification = classification;
    if (state) params.state = state;
    if (q) params.q = q;
    providerApi.admin.listRequests(params)
      .then(r => setRequests(r?.items || []))
      .catch(e => setErr(e.message));
  };

  rxE(() => { reloadSummary(); }, [days]);
  rxE(() => { reloadList(); }, [channel, classification, state]);

  const byChannel = (summary?.by_channel || []).reduce((acc, r) => { acc[r.key] = r.count; return acc; }, {});
  const wellaCount = byChannel["wellahealth"] || 0;
  const pbm1Count = byChannel["leadway_pbm_whatsapp_1"] || 0;
  const pbm2Count = byChannel["leadway_pbm_whatsapp_2"] || 0;

  return (
    <>
      <div className="mpage__head-row">
        <div>
          <h1>Admin console</h1>
          <p>Every prescription across all providers. Filter by where it was routed.</p>
        </div>
        <RxSeg
          options={[{ v: 7, l: "7 days" }, { v: 30, l: "30 days" }, { v: 90, l: "90 days" }]}
          value={days} onChange={setDays} />
      </div>

      {/* Channel split */}
      <div className="mstats">
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "#fff3ea", color: "#b45309" }}><RxIcon name="truck" size={22} /></div>
          <div>
            <div className="mstat__label">Sent to WellaHealth</div>
            <div className="mstat__value num">{summary == null ? "—" : wellaCount}</div>
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "#fdecef", color: "var(--rx-red)" }}><RxIcon name="message-circle" size={22} /></div>
          <div>
            <div className="mstat__label">Leadway PBM · WhatsApp #1</div>
            <div className="mstat__value num">{summary == null ? "—" : pbm1Count}</div>
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "var(--rx-purple-bg)", color: "var(--rx-purple)" }}><RxIcon name="message-circle" size={22} /></div>
          <div>
            <div className="mstat__label">Leadway PBM · WhatsApp #2</div>
            <div className="mstat__value num">{summary == null ? "—" : pbm2Count}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mcard" style={{ marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rx-muted)", alignSelf: "center", marginRight: 4 }}>Channel:</span>
          {["", "wellahealth", "leadway_pbm_whatsapp_1", "leadway_pbm_whatsapp_2"].map(c => (
            <button key={c || "all"}
              className={`rx-btn rx-btn--sm ${channel === c ? "" : "rx-btn--ghost"}`}
              style={{ width: "auto" }}
              onClick={() => setChannel(c)}>
              {c === "" ? "All" : CHANNEL_LABELS[c] || c}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rx-muted)", alignSelf: "center" }}>Type:</span>
          {["", "acute", "chronic", "mixed"].map(c => (
            <button key={c || "any"}
              className={`rx-btn rx-btn--sm ${classification === c ? "" : "rx-btn--ghost"}`}
              style={{ width: "auto" }}
              onClick={() => setClassification(c)}>
              {c || "Any"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 220, display: "flex", gap: 8 }}>
          <input className="rx-input" style={{ flex: 1 }} placeholder="Search id / member id / name" value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") reloadList(); }} />
          <input className="rx-input" style={{ width: 120 }} placeholder="State" value={state}
            onChange={e => setState(e.target.value)} />
          <button className="rx-btn rx-btn--sm" style={{ width: "auto" }} onClick={reloadList}>
            <RxIcon name="search" size={14} /> Go
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mcard" style={{ padding: 0, overflow: "hidden" }}>
        {err && <div style={{ padding: 20 }}><RxBanner kind="warn" icon="alert-triangle">{err}</RxBanner></div>}
        {!err && requests == null && <div style={{ padding: 40, textAlign: "center", color: "var(--rx-muted)" }}>Loading…</div>}
        {!err && requests != null && requests.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--rx-muted)" }}>No requests match these filters.</div>
        )}
        {!err && requests && requests.length > 0 && (
          <table className="rx-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Member</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Channel</th>
                <th>State</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setPicked(r.id)}>
                  <td><span className="num" style={{ fontWeight: 600 }}>#{r.id}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.enrollee_name || "—"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }} className="num">{r.enrollee_id}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{r.provider_name || "—"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }}>{r.provider_facility || r.provider_email || ""}</div>
                  </td>
                  <td>{r.classification ? <RxBadge kind={r.classification === "chronic" ? "purple" : r.classification === "acute" ? "orange" : "blue"}>{r.classification}</RxBadge> : "—"}</td>
                  <td>{channelPill(r.channel)}</td>
                  <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{r.enrollee_state || "—"}</td>
                  <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{fmtDateTime(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ textAlign: "right" }}><RxIcon name="chevron-right" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {picked && <AdminRequestDrawer id={picked} onClose={() => setPicked(null)} />}
    </>
  );
}

function AdminRequestDrawer({ id, onClose }) {
  const [data, setData] = rxS(null);
  const [err, setErr] = rxS(null);
  const [refreshing, setRefreshing] = rxS(false);
  const [refreshMsg, setRefreshMsg] = rxS(null);

  const load = () => {
    providerApi.admin.requestDetail(id)
      .then(r => setData(r))
      .catch(e => setErr(e.message));
  };

  rxE(() => { load(); }, [id]);

  const refreshStatus = async () => {
    setRefreshing(true); setRefreshMsg(null);
    try {
      const r = await providerApi.admin.refreshStatus(id);
      if (r?.ok) {
        setRefreshMsg(`Synced — WellaHealth status: ${r.external_status || "—"}`);
        load();
      } else {
        setRefreshMsg(r?.error || "Could not refresh status");
      }
    } catch (e) {
      setRefreshMsg(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="pv-drawer">
      <div className="pv-drawer__scrim" onClick={onClose} />
      <div className="pv-drawer__panel">
        <div className="pv-drawer__head">
          <div>
            <div style={{ fontSize: 11.5, color: "var(--rx-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Request</div>
            <div style={{ fontFamily: "Manrope", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }} className="num">#{id}</div>
          </div>
          <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={onClose} style={{ width: 34, padding: 0, height: 34 }}>
            <RxIcon name="x" size={16} />
          </button>
        </div>
        <div className="pv-drawer__body">
          {err && <RxBanner kind="warn" icon="alert-triangle">{err}</RxBanner>}
          {!err && !data && <div style={{ color: "var(--rx-muted)" }}>Loading…</div>}
          {data && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  ["Member", data.enrollee_name || "—"],
                  ["Member ID", data.enrollee_id],
                  ["State", data.enrollee_state || "—"],
                  ["Phone", data.enrollee_phone || "—"],
                  ["Email", data.enrollee_email || "—"],
                  ["Provider", data.provider_name || "—"],
                  ["Facility", data.provider_facility || data.provider_email || "—"],
                  ["Submitted", fmtDateTime(data.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="med__field">
                    <div className="med__field__k">{k}</div>
                    <div className="med__field__v">{v}</div>
                  </div>
                ))}
                <div className="med__field">
                  <div className="med__field__k">Type</div>
                  <div className="med__field__v">{data.classification || "—"}</div>
                </div>
                <div className="med__field">
                  <div className="med__field__k">Channel</div>
                  <div className="med__field__v">{channelPill(data.channel)}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Route</div>
              <div style={{ fontSize: 13, color: "var(--rx-ink-2)", marginBottom: 16 }}>{data.route || "—"}</div>

              {data.channel === "wellahealth" && (
                <div className="mcard mcard--flat" style={{ padding: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>WellaHealth fulfilment</div>
                    <button type="button" className="rx-btn rx-btn--ghost rx-btn--sm" style={{ width: "auto" }}
                      onClick={refreshStatus} disabled={refreshing || !(data.external_tracking_code || data.external_ref)}>
                      <RxIcon name={refreshing ? "loader-2" : "refresh-cw"} size={12} /> {refreshing ? "Refreshing…" : "Refresh status"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[
                      ["Status", data.external_status || (data.external_ref ? "pending" : "not dispatched")],
                      ["Tracking code", data.external_tracking_code || "—"],
                      ["Pharmacy", data.external_pharmacy_name || "auto-assigned by WellaHealth"],
                      ["Last synced", data.external_synced_at ? fmtDateTime(data.external_synced_at) : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="med__field">
                        <div className="med__field__k">{k}</div>
                        <div className="med__field__v">{v}</div>
                      </div>
                    ))}
                  </div>
                  {refreshMsg && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--rx-muted)" }}>{refreshMsg}</div>
                  )}
                </div>
              )}

              {data.items?.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Medications</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {data.items.map((it, i) => (
                      <div key={i} className="mcard mcard--flat" style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.drug_name}</div>
                        <div style={{ fontSize: 12, color: "var(--rx-muted)" }}>{[it.dosage, it.quantity && `qty ${it.quantity}`, it.duration_days && `${it.duration_days}d`].filter(Boolean).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {data.events?.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Timeline</div>
                  <div className="pv-timeline">
                    {data.events.map((e, i) => (
                      <div key={i} className="pv-timeline__step">
                        <div className={`pv-timeline__dot ${e.kind || ""}`}><RxIcon name={e.icon || "dot"} size={10} /></div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.label}</div>
                          <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }}>{fmtDateTime(e.at)}</div>
                          {e.note && <div style={{ fontSize: 12, color: "var(--rx-ink-2)", marginTop: 4 }}>{e.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminConsole, AdminRequestDrawer });
