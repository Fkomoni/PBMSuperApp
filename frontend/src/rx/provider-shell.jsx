// Provider shell — sidebar + topbar + page slot. Re-uses the `.mshell` / `.mside`
// layout from rxhub.css to keep the look identical to the enrollee app.

const PROVIDER_NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { key: "enrollee", label: "Member lookup", icon: "user-search" },
  { key: "new", label: "New prescription", icon: "file-plus-2" },
  { key: "requests", label: "My requests", icon: "clipboard-list" },
  { key: "resources", label: "Resources", icon: "book-open" },
];

function ProviderShell({ session, onSignOut, page, onNav, children }) {
  const current = PROVIDER_NAV.find(n => n.key === page) || PROVIDER_NAV[0];
  const name = session?.name || session?.full_name || session?.email || "Provider";
  const id = session?.provider_id || session?.prognosis_id || session?.email || "—";

  return (
    <div className="mshell">
      <aside className="mside">
        <div className="mside__brand">
          <div className="mside__logo"><img src={RX_LOGO} alt="" /></div>
          <div>
            <div className="mside__title">RxHub</div>
            <div className="mside__sub">Provider portal</div>
          </div>
        </div>

        <nav className="mside__nav">
          {PROVIDER_NAV.map(n => (
            <button key={n.key}
              className={`mside__link ${page === n.key ? "is-on" : ""}`}
              onClick={() => onNav(n.key)}>
              <RxIcon name={n.icon} size={16} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 12 }}><RxSupport compact dark /></div>

        <div className="mside__me">
          <div className="mside__me__name">{name}</div>
          <div className="mside__me__id">{id}</div>
          <button className="mside__signout" onClick={onSignOut}>
            <RxIcon name="log-out" size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className="mmobtop">
        <div className="mside__logo"><img src={RX_LOGO} alt="" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Manrope", fontSize: 15, fontWeight: 800, color: "var(--rx-red)" }}>RxHub</div>
          <div style={{ fontSize: 11, color: "var(--rx-muted)" }}>{current.label}</div>
        </div>
        <button className="rx-btn rx-btn--ghost rx-btn--sm" onClick={onSignOut}>
          <RxIcon name="log-out" size={13} />
        </button>
      </div>

      <main className="mpage">{children}</main>

      <nav className="mbottom">
        {PROVIDER_NAV.slice(0, 4).map(n => (
          <button key={n.key}
            className={`mbottom__item ${page === n.key ? "is-on" : ""}`}
            onClick={() => onNav(n.key)}>
            <RxIcon name={n.icon} size={18} />
            <span>{n.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

Object.assign(window, { ProviderShell, PROVIDER_NAV });
