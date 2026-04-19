// RxHub UI primitives — icons, small shared bits. Relies on window.Icon / React from ui.jsx.
const { useState: rxS, useEffect: rxE, useMemo: rxM, useRef: rxR, Fragment: rxF } = React;

// Brand logo URL (fallback to local asset)
const RX_LOGO = (window.__resources && window.__resources.logo) || "assets/leadway-logo.jpg";

// Softer icon wrapper — respects lucide
function RxIcon({ name, size = 18, color, style }) {
  const ref = rxR(null);
  rxE(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ nameAttr: "data-lucide" });
      const svg = ref.current.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", size); svg.setAttribute("height", size);
        if (color) svg.style.color = color;
      }
    }
  }, [name, size, color]);
  return <span ref={ref} style={{ display: "inline-flex", alignItems: "center", ...style }} />;
}

function RxBadge({ kind = "grey", icon, children }) {
  return (
    <span className={`rx-badge rx-badge--${kind}`}>
      {icon && <RxIcon name={icon} size={11} />}
      {children}
    </span>
  );
}

function RxSeg({ options, value, onChange }) {
  return (
    <div className="rx-seg">
      {options.map(o => (
        <button key={o.v || o} className={(o.v || o) === value ? "is-on" : ""} onClick={() => onChange(o.v || o)}>
          {o.l || o}
        </button>
      ))}
    </div>
  );
}

function RxField({ label, children }) {
  return <div className="rx-field"><label>{label}</label>{children}</div>;
}

function RxBanner({ kind = "info", icon, children }) {
  return (
    <div className={`rx-banner rx-banner--${kind}`}>
      {icon && <RxIcon name={icon} size={18} style={{ flexShrink: 0, marginTop: 1 }} />}
      <div>{children}</div>
    </div>
  );
}

// Autocomplete — drugs or diagnoses
function RxAutocomplete({ items, labelKey = "n", subKey = "gen", placeholder, onSelect, selected, onClear }) {
  const [q, setQ] = rxS("");
  const [open, setOpen] = rxS(false);
  const matches = rxM(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    return items.filter(it => (it[labelKey] || "").toLowerCase().includes(ql) || (it[subKey] || "").toLowerCase().includes(ql)).slice(0, 8);
  }, [q, items]);

  if (selected) {
    return (
      <div className="ac__selected">
        <RxIcon name="check-circle-2" size={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{selected[labelKey]}</div>
          {selected[subKey] && <div style={{ fontSize: 11.5, fontWeight: 500, opacity: .75 }}>{selected[subKey]}</div>}
        </div>
        <button onClick={onClear} style={{ background: 0, border: 0, color: "inherit", cursor: "pointer", padding: 4 }}>
          <RxIcon name="x" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="ac">
      <input
        className="rx-input"
        style={{ borderColor: "var(--rx-red)" }}
        value={q}
        placeholder={placeholder}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div className="ac__drop">
          {matches.map((m, i) => (
            <div key={i} className="ac__item" onMouseDown={() => { onSelect(m); setQ(""); setOpen(false); }}>
              <div className="k">{m[labelKey]}</div>
              <div className="v">{m[subKey]} {m.code && <span className="num">· {m.code}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { rxS, rxE, rxM, rxR, rxF, RX_LOGO, RxIcon, RxBadge, RxSeg, RxField, RxBanner, RxAutocomplete, RxSupport, RxSupportFooter });

// ================= SUPPORT CONTACT =================
// Leadway Health contact centre — surfaced everywhere so members/providers/staff never feel stuck.
function RxSupport({ compact, dark }) {
  const bg = dark ? "rgba(255,255,255,.05)" : "#fff5f4";
  const border = dark ? "1px solid rgba(255,255,255,.08)" : "1px solid #ffd9d6";
  const muted = dark ? "rgba(255,255,255,.6)" : "var(--rx-muted)";
  const head = dark ? "#fff" : "var(--rx-charcoal)";
  return (
    <div style={{ background: bg, border, borderRadius: 12, padding: compact ? "10px 12px" : "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: "var(--rx-red)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <RxIcon name="headphones" size={15} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: head, letterSpacing: ".01em" }}>Contact centre</div>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 999, background: "var(--rx-red)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: ".1em" }}>24/7</span>
        </div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>
          <a href="tel:+2347080627051" style={{ color: head, fontWeight: 700, textDecoration: "none" }}>07080627051</a>
          <span style={{ opacity: .5, margin: "0 5px" }}>/</span>
          <a href="tel:+2342012801051" style={{ color: head, fontWeight: 700, textDecoration: "none" }}>02012801051</a>
        </div>
      </div>
    </div>
  );
}

// Full-width footer strip for pages without a sidebar (other-roles previews, etc.)
function RxSupportFooter() {
  return (
    <div style={{ marginTop: 32, padding: "14px 18px", borderRadius: 14, background: "var(--rx-charcoal)", color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "center", fontSize: 13 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: .72 }}>
        <RxIcon name="headphones" size={15} color="#fff" />
        Need help? Leadway Health contact centre
      </span>
      <a href="tel:+2347080627051" style={{ color: "#fff", fontWeight: 700, textDecoration: "none", fontVariantNumeric: "tabular-nums" }}>07080627051</a>
      <span style={{ opacity: .4 }}>/</span>
      <a href="tel:+2342012801051" style={{ color: "#fff", fontWeight: 700, textDecoration: "none", fontVariantNumeric: "tabular-nums" }}>02012801051</a>
      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 999, background: "var(--rx-red)", fontSize: 10, fontWeight: 800, letterSpacing: ".1em" }}>24/7</span>
    </div>
  );
}
