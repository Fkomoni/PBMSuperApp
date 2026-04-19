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

  // Parent-app handoff: read a *short-lived signed* handoff payload that
  // the parent app injected into sessionStorage (or window.__handoff__)
  // before opening this portal. We deliberately do NOT accept the payload
  // via URL query parameters: the URL ends up in browser history, in the
  // Referer header of every outbound request, and in access logs, making
  // static-secret query params trivial to steal.
  rxE(() => {
    if (stage === "app") return;

    let handoff = null;
    try {
      const raw = sessionStorage.getItem("rx.handoff");
      if (raw) handoff = JSON.parse(raw);
    } catch { /* ignore malformed */ }
    if (!handoff && window.__handoff__) handoff = window.__handoff__;

    // Back-compat: if the old query format is still present, strip it
    // from the URL immediately and show a user-facing error. This
    // prevents the secret from persisting in history + referer headers
    // on any subsequent navigation.
    const u = new URL(window.location.href);
    const hadLegacy =
      u.searchParams.has("token") ||
      u.searchParams.has("handoff") ||
      u.searchParams.has("secret");
    if (hadLegacy) {
      u.searchParams.delete("token");
      u.searchParams.delete("handoff");
      u.searchParams.delete("secret");
      window.history.replaceState({}, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""));
      setHandoffErr("Sign-in via URL is no longer supported. Ask the parent app to use the signed handoff API.");
      return;
    }

    if (!handoff || !handoff.email || !handoff.signature) return;

    providerApi.exchange(handoff).then(data => {
      const provider = (data && data.provider) || providerAuth.getSession() || {};
      setSession({ role: "provider", ...provider });
      setStage("app");
      // One-shot: always clear the handoff blob so it can't be replayed.
      try { sessionStorage.removeItem("rx.handoff"); } catch {}
      try { delete window.__handoff__; } catch {}
    }).catch(e => {
      try { sessionStorage.removeItem("rx.handoff"); } catch {}
      setHandoffErr(e.message || "Automatic sign-in failed");
    });
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
