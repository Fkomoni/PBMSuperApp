// Provider shell — compact horizontal nav for embed-mode use.
// One sticky button bar at the top, page content below. No sidebar,
// no mobile bottom-tabs — designed to sit cleanly inside an iframe in
// the parent Leadway provider dashboard so it reads as a module, not
// another standalone website.

const PROVIDER_NAV = [
  { key: "new",       label: "New Prescription", icon: "file-plus-2" },
  { key: "enrollee",  label: "Member Lookup",    icon: "user-search" },
  { key: "requests",  label: "Request History",  icon: "clipboard-list" },
  { key: "dashboard", label: "Dashboard",        icon: "layout-dashboard" },
];

const ADMIN_NAV = [
  { key: "admin", label: "Admin Console", icon: "shield-check", admin: true },
];

function ProviderShell({ session, onSignOut, page, onNav, children }) {
  const isAdmin = session?.role === "admin";
  const nav = isAdmin ? [...PROVIDER_NAV, ...ADMIN_NAV] : PROVIDER_NAV;
  const name = session?.name || session?.full_name || session?.email || "Provider";

  return (
    <div className="pv-shell">
      <header className="pv-topbar">
        <nav className="pv-topbar__nav">
          {nav.map(n => (
            <button
              key={n.key}
              type="button"
              className={`pv-topbar__btn ${page === n.key ? "is-on" : ""}${n.admin ? " is-admin" : ""}`}
              onClick={() => onNav(n.key)}
            >
              <RxIcon name={n.icon} size={14} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="pv-topbar__user">
          <span className="pv-topbar__name" title={name}>{name}</span>
          <button type="button" className="pv-topbar__signout" onClick={onSignOut}>
            <RxIcon name="log-out" size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </header>
      <main className="pv-shell__page">{children}</main>
    </div>
  );
}

Object.assign(window, { ProviderShell, PROVIDER_NAV });
