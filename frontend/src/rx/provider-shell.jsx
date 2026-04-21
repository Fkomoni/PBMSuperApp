// Provider shell — sidebar + topbar + page slot. Re-uses the `.mshell` / `.mside`
// layout from rxhub.css to keep the look identical to the enrollee app.

const PROVIDER_NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { key: "enrollee", label: "Member lookup", icon: "user-search" },
  { key: "new", label: "New prescription", icon: "file-plus-2" },
  { key: "requests", label: "My requests", icon: "clipboard-list" },
];

const ADMIN_NAV = [
  { key: "admin", label: "Admin console", icon: "shield-check" },
];

function ProviderShell({ session, onSignOut, page, onNav, children }) {
  const isAdmin = session?.role === "admin";
  const nav = isAdmin ? [...PROVIDER_NAV, ...ADMIN_NAV] : PROVIDER_NAV;
  const current = nav.find(n => n.key === page) || nav[0];
  const name = session?.name || session?.full_name || session?.email || "Provider";

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
          {nav.map(n => (
            <button key={n.key}
              className={`mside__link ${page === n.key ? "is-on" : ""}`}
              onClick={() => onNav(n.key)}>
              <RxIcon name={n.icon} size={16} />
              <span>{n.label}</span>
              {n.key === "admin" && <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", padding: "2px 7px", borderRadius: 999, background: "rgba(225, 6, 0, .18)", color: "#ff5a55", border: "1px solid rgba(255, 90, 85, .28)", textTransform: "uppercase" }}>Admin</span>}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 12 }}><RxSupport compact dark /></div>

        <div className="mside__me">
          <div className="mside__me__name">{name}</div>
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
        {nav.slice(0, 4).map(n => (
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
