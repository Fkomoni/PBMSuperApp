// Top-level router for the provider portal.
// hub → login → app(shell + page)

function ProviderApp() {
  const [stage, setStage] = rxS(() => providerAuth.getToken() && providerAuth.getSession() ? "app" : "hub");
  const [session, setSession] = rxS(() => providerAuth.getSession());
  const [page, setPage] = rxS(() => localStorage.getItem("rx.provider.page") || "dashboard");
  const [focus, setFocus] = rxS(null);
  const [startMember, setStartMember] = rxS(null);
  const [handoffErr, setHandoffErr] = rxS(null);

  rxE(() => { if (window.lucide) window.lucide.createIcons(); }, [stage, page]);
  rxE(() => { localStorage.setItem("rx.provider.page", page); }, [page]);

  // Parent-app handoff: if the URL contains ?token=<prognosis> or
  // ?handoff=<email>&secret=<shared-secret>, exchange it for a portal JWT
  // and skip the login screen entirely.
  rxE(() => {
    if (stage === "app") return;
    const u = new URL(window.location.href);
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
      // Scrub the credentials from the address bar.
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
    setPage("dashboard");
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
  else if (page === "new") body = <ProviderNewRequest initialMember={startMember} onSubmitted={r => go("requests", { focus: r?.id || r?.request_id })} />;
  else if (page === "requests") body = <ProviderRequests focus={focus} />;
  else if (page === "admin" && session?.role === "admin") body = <AdminConsole />;
  else body = <ProviderDashboard session={session} onNav={go} />;

  return (
    <ProviderShell session={session} onSignOut={onSignOut} page={page} onNav={go}>
      {body}
    </ProviderShell>
  );
}

ReactDOM.createRoot(document.getElementById("rx-root")).render(<ProviderApp />);
