// Requests list + tracking drawer. Provider-scoped (GET /medication-requests).
// Clicking a row loads /medication-requests/{id}/tracking and opens the drawer.

function ProviderRequests({ focus }) {
  const [items, setItems] = rxS(null);
  const [err, setErr] = rxS(null);
  const [filter, setFilter] = rxS("all");
  const [picked, setPicked] = rxS(null);

  rxE(() => {
    let mounted = true;
    providerApi.listRequests({ limit: 100 })
      .then(r => { if (mounted) setItems(Array.isArray(r) ? r : (r?.items || [])); })
      .catch(e => { if (mounted) setErr(e.message); });
    return () => { mounted = false; };
  }, []);

  rxE(() => {
    if (focus && items) {
      const match = items.find(x => (x.id || x.request_id) === focus);
      if (match) setPicked(match);
    }
  }, [focus, items]);

  const filtered = rxM(() => {
    if (!items) return [];
    const openSet = new Set(["pending", "submitted", "routed", "dispensing", "ready"]);
    const doneSet = new Set(["delivered", "closed"]);
    return items.filter(r => {
      const s = (r.status || "").toLowerCase();
      if (filter === "open") return openSet.has(s);
      if (filter === "delivered") return doneSet.has(s);
      return true;
    });
  }, [items, filter]);

  return (
    <>
      <div className="mpage__head-row">
        <div>
          <h1>My requests</h1>
          <p>Every prescription you've submitted to the Leadway PBM hub.</p>
        </div>
        <RxSeg
          options={[{ v: "all", l: "All" }, { v: "open", l: "Open" }, { v: "delivered", l: "Delivered" }]}
          value={filter} onChange={setFilter} />
      </div>

      <div className="mcard" style={{ padding: 0, overflow: "hidden" }}>
        {err && <div style={{ padding: 20 }}><RxBanner kind="warn" icon="alert-triangle">Couldn't load requests: {err}</RxBanner></div>}
        {!err && items == null && <div style={{ padding: 40, textAlign: "center", color: "var(--rx-muted)" }}>Loading…</div>}
        {!err && items != null && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--rx-muted)" }}>No requests match this filter.</div>
        )}
        {!err && filtered.length > 0 && (
          <table className="rx-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Member</th>
                <th>Drugs</th>
                <th>Classification</th>
                <th>Route</th>
                <th>Received</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const items = r.items || r.medications || [];
                return (
                  <tr key={r.id || r.request_id} style={{ cursor: "pointer" }} onClick={() => setPicked(r)}>
                    <td><span className="num" style={{ fontWeight: 600 }}>#{r.id || r.request_id}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.enrollee_name || r.member_name || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }} className="num">{r.enrollee_id || r.member_id || ""}</div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {items.length
                        ? items.slice(0, 2).map(i => i.drug_name || i.name).filter(Boolean).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "")
                        : "—"}
                    </td>
                    <td>{r.classification ? <RxBadge kind={r.classification === "chronic" ? "purple" : r.classification === "acute" ? "orange" : "blue"}>{r.classification}</RxBadge> : "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{r.route || r.channel || "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{fmtDateTime(r.created_at || r.submitted_at)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ textAlign: "right" }}><RxIcon name="chevron-right" size={16} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {picked && <TrackingDrawer request={picked} onClose={() => setPicked(null)} />}
    </>
  );
}

function TrackingDrawer({ request, onClose }) {
  const id = request.id || request.request_id;
  const [tracking, setTracking] = rxS(null);
  const [err, setErr] = rxS(null);

  rxE(() => {
    let mounted = true;
    setTracking(null); setErr(null);
    providerApi.getTracking(id)
      .then(r => { if (mounted) setTracking(r); })
      .catch(e => { if (mounted) setErr(e.message); });
    return () => { mounted = false; };
  }, [id]);

  const events = tracking?.events || tracking?.timeline || [];
  const items = request.items || request.medications || tracking?.items || [];

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
            <div className="med__field">
              <div className="med__field__k">Member</div>
              <div className="med__field__v">{request.enrollee_name || request.member_name || "—"}</div>
            </div>
            <div className="med__field">
              <div className="med__field__k">Member ID</div>
              <div className="med__field__v num">{request.enrollee_id || request.member_id || "—"}</div>
            </div>
            <div className="med__field">
              <div className="med__field__k">Status</div>
              <div className="med__field__v"><StatusBadge status={request.status} /></div>
            </div>
            <div className="med__field">
              <div className="med__field__k">Classification</div>
              <div className="med__field__v">{request.classification || "—"}</div>
            </div>
            <div className="med__field">
              <div className="med__field__k">Route</div>
              <div className="med__field__v" style={{ fontSize: 12.5 }}>{request.route || request.channel || "—"}</div>
            </div>
            <div className="med__field">
              <div className="med__field__k">Submitted</div>
              <div className="med__field__v">{fmtDateTime(request.created_at || request.submitted_at)}</div>
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Medications</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it, i) => (
                  <div key={i} className="mcard mcard--flat" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.drug_name || it.name}</div>
                      <div style={{ fontSize: 12, color: "var(--rx-muted)" }}>{[it.dosage, it.quantity && `qty ${it.quantity}`, it.duration_days && `${it.duration_days}d`].filter(Boolean).join(" · ")}</div>
                    </div>
                    {it.classification && <RxBadge kind={it.classification === "chronic" ? "purple" : "orange"}>{it.classification}</RxBadge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tracking</div>
          {err && <RxBanner kind="warn" icon="alert-triangle">Couldn't load tracking: {err}</RxBanner>}
          {!err && tracking == null && <div style={{ fontSize: 13, color: "var(--rx-muted)" }}>Loading timeline…</div>}
          {!err && tracking != null && events.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--rx-muted)" }}>No tracking events yet. We'll show updates as the PBM hub processes this request.</div>
          )}
          {!err && events.length > 0 && (
            <div className="pv-timeline">
              {events.map((e, i) => (
                <div key={i} className="pv-timeline__step">
                  <div className={`pv-timeline__dot ${e.kind || ""}`}><RxIcon name={e.icon || "dot"} size={10} /></div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.label || e.title || e.status}</div>
                    <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }}>{fmtDateTime(e.at || e.timestamp)}</div>
                    {e.note && <div style={{ fontSize: 12, color: "var(--rx-ink-2)", marginTop: 4 }}>{e.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProviderRequests, TrackingDrawer });
