// Provider dashboard — three stat cards + recent requests + routing rule reminder.

function StatusBadge({ status }) {
  const map = {
    pending: { kind: "orange", icon: "clock" },
    submitted: { kind: "blue", icon: "send" },
    routed: { kind: "purple", icon: "shuffle" },
    dispensing: { kind: "blue", icon: "pill" },
    ready: { kind: "green", icon: "package-check" },
    delivered: { kind: "green", icon: "check-circle-2" },
    closed: { kind: "grey", icon: "check" },
    cancelled: { kind: "red", icon: "x-circle" },
    rejected: { kind: "red", icon: "x-octagon" },
  };
  const s = (status || "pending").toLowerCase().replace(/\s+/g, "-");
  const m = map[s] || map.pending;
  return <RxBadge kind={m.kind} icon={m.icon}>{status || "Pending"}</RxBadge>;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return String(d); }
}

function fmtDateTime(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return String(d); }
}

function ProviderDashboard({ session, onNav }) {
  const [requests, setRequests] = rxS(null);
  const [err, setErr] = rxS(null);

  rxE(() => {
    let mounted = true;
    providerApi.listRequests({ limit: 10 })
      .then(r => { if (mounted) setRequests(Array.isArray(r) ? r : (r?.items || [])); })
      .catch(e => { if (mounted) setErr(e.message); });
    return () => { mounted = false; };
  }, []);

  const stats = rxM(() => {
    const list = requests || [];
    const open = list.filter(r => !["delivered", "closed", "cancelled", "rejected"].includes((r.status || "").toLowerCase())).length;
    const delivered = list.filter(r => ["delivered", "closed"].includes((r.status || "").toLowerCase())).length;
    return { total: list.length, open, delivered };
  }, [requests]);

  return (
    <>
      <div className="mpage__head-row">
        <div>
          <h1>Welcome back{session?.name ? `, ${session.name.split(" ")[0]}` : ""}</h1>
          <p>Your prescription routing console. New orders, open tracking, and a snapshot of your last 10 requests.</p>
        </div>
        <div className="mpage__actions">
          <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={() => onNav("enrollee")}>
            <RxIcon name="user-search" size={14} /> Look up member
          </button>
          <button className="rx-btn rx-btn--sm" onClick={() => onNav("new")} style={{ width: "auto" }}>
            <RxIcon name="file-plus-2" size={14} /> New prescription
          </button>
        </div>
      </div>

      <div className="mstats">
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "var(--rx-blue-bg)", color: "var(--rx-blue)" }}><RxIcon name="clipboard-list" size={22} /></div>
          <div>
            <div className="mstat__label">Total requests</div>
            <div className="mstat__value num">{requests == null ? "—" : stats.total}</div>
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "#fff3ea", color: "#b45309" }}><RxIcon name="loader" size={22} /></div>
          <div>
            <div className="mstat__label">Open</div>
            <div className="mstat__value num">{requests == null ? "—" : stats.open}</div>
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__icon" style={{ background: "var(--rx-green-bg)", color: "var(--rx-green)" }}><RxIcon name="check-circle-2" size={22} /></div>
          <div>
            <div className="mstat__label">Delivered</div>
            <div className="mstat__value num">{requests == null ? "—" : stats.delivered}</div>
          </div>
        </div>
      </div>

      <section className="msection">
        <div className="msection__head">
          <h2>Recent requests</h2>
          <button className="link" onClick={() => onNav("requests")}>View all <RxIcon name="arrow-right" size={12} /></button>
        </div>
        <div className="mcard" style={{ padding: 0, overflow: "hidden" }}>
          {err && <div style={{ padding: 20 }}><RxBanner kind="warn" icon="alert-triangle">Couldn't load requests: {err}</RxBanner></div>}
          {!err && requests == null && <div style={{ padding: 32, textAlign: "center", color: "var(--rx-muted)" }}>Loading your recent requests…</div>}
          {!err && requests != null && requests.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No requests yet</div>
              <div style={{ fontSize: 13, color: "var(--rx-muted)", marginBottom: 14 }}>Send your first prescription to the Leadway PBM hub.</div>
              <button className="rx-btn rx-btn--sm" style={{ width: "auto", display: "inline-flex" }} onClick={() => onNav("new")}>
                <RxIcon name="file-plus-2" size={14} /> Create prescription
              </button>
            </div>
          )}
          {!err && requests != null && requests.length > 0 && (
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Member</th>
                  <th>Classification</th>
                  <th>Route</th>
                  <th>Received</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 8).map(r => (
                  <tr key={r.id || r.request_id} style={{ cursor: "pointer" }} onClick={() => onNav("requests", { focus: r.id || r.request_id })}>
                    <td><span className="num" style={{ fontWeight: 600 }}>#{r.id || r.request_id}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.enrollee_name || r.member_name || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--rx-muted)" }} className="num">{r.enrollee_id || r.member_id || ""}</div>
                    </td>
                    <td>{r.classification ? <RxBadge kind={r.classification === "chronic" ? "purple" : r.classification === "acute" ? "orange" : "blue"}>{r.classification}</RxBadge> : "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{r.route || r.channel || "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--rx-muted)" }}>{fmtDateTime(r.created_at || r.submitted_at || r.receivedAt)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

Object.assign(window, { ProviderDashboard, StatusBadge, fmtDate, fmtDateTime });
