// Top-level router for the provider portal.
// Stages:
//   blocked  — embed-only mode and no valid entry (direct visit)
//   hub      — role picker (kept for admin direct-login path)
//   login    — email/password form
//   app      — authenticated portal
//
// Entry points into `app`:
//   1. ?ticket=<opaque>   — parent app's one-time embed ticket (preferred)
//   2. ?rx_token=<jwt>    — legacy direct JWT handoff (still supported)
//   3. ?handoff=…&secret= — legacy shared-secret passthrough
//   4. Direct email/password login (admin only in embed-mode; anyone in
//                                   standalone mode)

function _isAdminUnlock() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("admin") === "1";
  } catch (_) { return false; }
}

function _requireEmbed() {
  return window.__REQUIRE_EMBED__ === true;
}

function EmbedBlocked() {
  // Shown when a provider lands on the portal directly in embed-only
  // mode. Keeps the brand language, gives support numbers, and offers
  // the admin escape hatch (?admin=1) without advertising it too loudly.
  return (
    <div className="hub">
      <div className="hub__inner">
        <div className="hub__brand">
          <div className="hub__logo"><img src={RX_LOGO} alt="Leadway Health" /></div>
          <h1 className="hub__title">Leadway <span className="rx">RxHub</span></h1>
          <p className="hub__sub">Provider Portal · prescribe, refer, track</p>
        </div>

        <div className="hub__grid" style={{ gridTemplateColumns: "1fr", maxWidth: 520, margin: "0 auto" }}>
          <div className="hub__card" style={{ textAlign: "center", cursor: "default" }}>
            <div className="hub__icon"><RxIcon name="lock" size={22} /></div>
            <h3>Sign in from your provider dashboard</h3>
            <p>
              RxHub is only reachable from the Leadway Provider dashboard.
              Please return to your dashboard and click the RxHub tile to
              continue.
            </p>
          </div>
        </div>

        <div className="hub__foot">
          <RxIcon name="headphones" size={14} />
          <span>Need help? Call the Leadway Health contact centre on</span>
          <a href="tel:+2347080627051" style={{ color: "#fff", fontWeight: 700 }}>07080627051</a>
          <span style={{ opacity: .5 }}>/</span>
          <a href="tel:+2342012801051" style={{ color: "#fff", fontWeight: 700 }}>02012801051</a>
          <span className="hub__foot__pill">24/7</span>
        </div>
      </div>
    </div>
  );
}

function ProviderApp() {
  const hasSession = providerAuth.getToken() && providerAuth.getSession();
  const initialStage = hasSession
    ? "app"
    : (_requireEmbed() && !_isAdminUnlock() ? "blocked" : "hub");

  const [stage, setStage] = rxS(initialStage);
  const [session, setSession] = rxS(() => providerAuth.getSession());
  const [page, setPage] = rxS(() => localStorage.getItem("rx.provider.page") || "new");
  const [focus, setFocus] = rxS(null);
  const [startMember, setStartMember] = rxS(null);
  const [handoffErr, setHandoffErr] = rxS(null);

  rxE(() => { if (window.lucide) window.lucide.createIcons(); }, [stage, page]);
  rxE(() => { localStorage.setItem("rx.provider.page", page); }, [page]);

  // Parent-app handoff — priority order: ticket > rx_token > handoff/secret.
  rxE(() => {
    if (stage === "app") return;
    const u = new URL(window.location.href);

    // 1. Embed-login ticket — the canonical path. Single-use, 60-second TTL.
    const ticket = u.searchParams.get("ticket");
    if (ticket) {
      providerApi.redeemTicket(ticket).then(data => {
        const provider = (data && data.provider) || providerAuth.getSession() || {};
        setSession({ role: provider.role || "provider", ...provider });
        setStage("app");
        u.searchParams.delete("ticket");
        window.history.replaceState({}, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""));
      }).catch(e => {
        setHandoffErr(e.message || "Sign-in ticket is invalid or expired");
        // In embed-only mode, a bad ticket means the parent app shipped a
        // stale URL — block rather than silently falling back to a login
        // form that would 401 anyway.
        if (_requireEmbed() && !_isAdminUnlock()) setStage("blocked");
      });
      return;
    }

    // 2. Direct JWT in URL (legacy — still useful for dev tooling).
    const rxToken = u.searchParams.get("rx_token");
    if (rxToken) {
      try {
        const parts = rxToken.split(".");
        const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        providerAuth.setToken(rxToken);
        const sess = {
          role: claims.role || "provider",
          email: claims.email || "",
          name: claims.name || "",
          provider_id: claims.sub,
        };
        providerAuth.setSession(sess);
        setSession(sess);
        setStage("app");
        u.searchParams.delete("rx_token");
        window.history.replaceState({}, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""));
      } catch (_) {
        setHandoffErr("Auto sign-in token was invalid.");
      }
      return;
    }

    // 3. Legacy email+secret handoff.
    const prognosisToken = u.searchParams.get("token");
    const handoffEmail = u.searchParams.get("handoff");
    const handoffSecret = u.searchParams.get("secret");
    if (!prognosisToken && !(handoffEmail && handoffSecret)) return;

    const body = prognosisToken
      ? { prognosis_token: prognosisToken }
      : { email: handoffEmail, parent_shared_secret: handoffSecret };

    providerApi.exchange(body).then(data => {
      const provider = (data && data.provider) || providerAuth.getSession() || {};
      setSession({ role: "provider", ...provider });
      setStage("app");
      u.searchParams.delete("token");
      u.searchParams.delete("handoff");
      u.searchParams.delete("secret");
      window.history.replaceState({}, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""));
    }).catch(e => setHandoffErr(e.message || "Automatic sign-in failed"));
  }, []);

  const onSignedIn = (sess) => {
    // In embed-only mode, only admins may arrive here via direct login.
    if (_requireEmbed() && !_isAdminUnlock() && sess?.role !== "admin") {
      providerApi.logout();
      setSession(null);
      setStage("blocked");
      return;
    }
    setSession(sess);
    setStage("app");
  };
  const onSignOut = () => {
    providerApi.logout();
    setSession(null);
    // Return to the blocker in embed-mode so a signed-out provider can't
    // just hit the login form again without an admin unlock param.
    setStage(_requireEmbed() && !_isAdminUnlock() ? "blocked" : "hub");
    localStorage.removeItem("rx.provider.page");
    setPage("new");
  };

  const go = (p, opts) => {
    setPage(p);
    setFocus(opts?.focus || null);
    setStartMember(opts?.member || null);
  };

  if (stage === "blocked") {
    return <EmbedBlocked />;
  }
  if (stage === "hub") {
    return (
      <>
        <ProviderHub onContinue={() => setStage("login")} />
        {handoffErr && (
          <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 20 }}>
            <div style={{ background: "#fff", border: "1px solid #fadabd", color: "#9c4d0a", padding: "10px 14px", borderRadius: 12, fontSize: 13, maxWidth: 520, boxShadow: "0 10px 30px rgba(0,0,0,.15)" }}>
              <RxIcon name="alert-triangle" size={14} /> Auto sign-in from the parent app failed: {handoffErr}. Use the login below.
            </div>
          </div>
        )}
      </>
    );
  }
  if (stage === "login") {
    return <ProviderLogin onBack={() => setStage("hub")} onSignedIn={onSignedIn} />;
  }

  let body;
  if (page === "dashboard") body = <ProviderDashboard session={session} onNav={go} />;
  else if (page === "enrollee") body = <ProviderEnrollee onStartRequest={m => go("new", { member: m })} />;
  else if (page === "new") body = <ProviderNewRequest session={session} initialMember={startMember}
    onSubmitted={r => go("requests", { focus: r?.id || r?.request_id })}
    onCancel={() => go("requests")} />;
  else if (page === "requests") body = <ProviderRequests focus={focus} />;
  else if (page === "admin" && session?.role === "admin") body = <AdminConsole />;
  else body = <ProviderNewRequest session={session} initialMember={startMember}
    onSubmitted={r => go("requests", { focus: r?.id || r?.request_id })} />;

  return (
    <ProviderShell session={session} onSignOut={onSignOut} page={page} onNav={go}>
      <PageTabs session={session} page={page} onNav={go} />
      {body}
    </ProviderShell>
  );
}

function PageTabs({ session, page, onNav }) {
  const tabs = [
    { key: "new",       label: "New Rx Request" },
    { key: "requests",  label: "Request History" },
  ];
  if (session?.role === "admin") {
    tabs.push({ key: "admin", label: "Review Queue" });
    tabs.push({ key: "reports", label: "Reports" });
  }
  return (
    <div className="pv-tabs">
      {tabs.map(t => (
        <button key={t.key}
          className={`pv-tab ${page === t.key ? "is-on" : ""}`}
          onClick={() => onNav(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("rx-root")).render(<ProviderApp />);
