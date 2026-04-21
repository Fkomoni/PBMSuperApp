// Top-level router for the provider portal.
// hub → login → app(shell + page)

function ProviderApp() {
  const [stage, setStage] = rxS(() => providerAuth.getToken() && providerAuth.getSession() ? "app" : "hub");
  const [session, setSession] = rxS(() => providerAuth.getSession());
  const [page, setPage] = rxS(() => localStorage.getItem("rx.provider.page") || "new");
  const [focus, setFocus] = rxS(null);
  const [startMember, setStartMember] = rxS(null);
  const [handoffErr, setHandoffErr] = rxS(null);

  rxE(() => { if (window.lucide) window.lucide.createIcons(); }, [stage, page]);
  rxE(() => { localStorage.setItem("rx.provider.page", page); }, [page]);

  // Parent-app handoff: skip the login screen when the parent portal has
  // already authenticated the provider. Three modes (in priority order):
  //
  // 1. ?rx_token=<rxhub_jwt>  — Preferred. The parent portal's *server* calls
  //    POST /api/v1/auth/session-exchange with {email, parent_shared_secret}
  //    (EMBED_SHARED_SECRET env var), receives an RxHub JWT, and injects it
  //    into the iframe/link URL. The shared secret never touches the browser.
  //
  // 2. ?handoff=<email>&secret=<shared_secret>  — Simple fallback when the
  //    parent app can't do server-to-server calls. The shared secret travels
  //    in the URL (visible in browser history / logs) — use mode 1 where
  //    possible.
  //
  // 3. ?token=<prognosis_bearer>  — Future Prognosis passthrough (not yet
  //    wired on the backend; will return 501 until implemented).
  rxE(() => {
    if (stage === "app") return;
    const u = new URL(window.location.href);

    // Mode 1: direct RxHub JWT — decode claims, store, and go straight in.
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
        setHandoffErr("Auto sign-in token was invalid — please log in below.");
      }
      return;
    }

    // Mode 2 & 3: exchange via the backend.
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

  const onSignedIn = (sess) => { setSession(sess); setStage("app"); };
  const onSignOut = () => {
    providerApi.logout();
    setSession(null);
    setStage("hub");
    localStorage.removeItem("rx.provider.page");
    setPage("new");
  };

  const go = (p, opts) => {
    setPage(p);
    setFocus(opts?.focus || null);
    setStartMember(opts?.member || null);
  };

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
