// Top-level router for the provider portal.
// hub → login → app(shell + page)

function ProviderApp() {
  const [stage, setStage] = rxS(() => providerAuth.getToken() && providerAuth.getSession() ? "app" : "hub");
  const [session, setSession] = rxS(() => providerAuth.getSession());
  const [page, setPage] = rxS(() => localStorage.getItem("rx.provider.page") || "dashboard");
  const [focus, setFocus] = rxS(null);
  const [startMember, setStartMember] = rxS(null);

  rxE(() => { if (window.lucide) window.lucide.createIcons(); }, [stage, page]);
  rxE(() => { localStorage.setItem("rx.provider.page", page); }, [page]);

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
    return <ProviderHub onContinue={() => setStage("login")} />;
  }
  if (stage === "login") {
    return <ProviderLogin onBack={() => setStage("hub")} onSignedIn={onSignedIn} />;
  }

  let body;
  if (page === "dashboard") body = <ProviderDashboard session={session} onNav={go} />;
  else if (page === "enrollee") body = <ProviderEnrollee onStartRequest={m => go("new", { member: m })} />;
  else if (page === "new") body = <ProviderNewRequest initialMember={startMember} onSubmitted={r => go("requests", { focus: r?.id || r?.request_id })} />;
  else if (page === "requests") body = <ProviderRequests focus={focus} />;
  else if (page === "resources") body = <ProviderResources />;
  else body = <ProviderDashboard session={session} onNav={go} />;

  return (
    <ProviderShell session={session} onSignOut={onSignOut} page={page} onNav={go}>
      {body}
    </ProviderShell>
  );
}

function ProviderResources() {
  const cards = [
    { icon: "book-open", title: "Leadway formulary", sub: "Current tariff, covered brands, and scheme-specific rules." },
    { icon: "file-text", title: "Claims & submission guide", sub: "How prescriptions become claims and when you get paid." },
    { icon: "route", title: "Routing rules", sub: "Acute vs. chronic, Lagos vs. outside, specialised cohorts." },
    { icon: "headphones", title: "Contact centre", sub: "07080627051 / 02012801051 · 24/7 dedicated provider line." },
  ];
  return (
    <>
      <div className="mpage__head">
        <h1>Resources</h1>
        <p>Handy links and guides for the Leadway provider network.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {cards.map((c, i) => (
          <div key={i} className="res">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--rx-blue-bg)", color: "var(--rx-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RxIcon name={c.icon} size={20} />
            </div>
            <h3>{c.title}</h3>
            <div className="res__body">{c.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("rx-root")).render(<ProviderApp />);
