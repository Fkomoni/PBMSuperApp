// Provider login — matches RxHub LoginHub + LoginPanel visual language.
// Hub shows a single "Provider" card (this portal is provider-only).
// Panel: email + password with show/hide.

function ProviderHub({ onContinue }) {
  return (
    <div className="hub">
      <div className="hub__inner">
        <div className="hub__brand">
          <div className="hub__logo"><img src={RX_LOGO} alt="Leadway Health" /></div>
          <h1 className="hub__title">Leadway <span className="rx">RxHub</span></h1>
          <p className="hub__sub">Provider Portal · prescribe, refer, track</p>
        </div>

        <div className="hub__grid" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
          <button className="hub__card hub__card--primary" onClick={onContinue}>
            <div className="hub__icon"><RxIcon name="stethoscope" size={22} /></div>
            <h3>Healthcare Provider</h3>
            <p>Upload prescriptions, look up member cover, and send acute or chronic orders into the Leadway PBM hub.</p>
            <div className="hub__arrow">Sign in <RxIcon name="arrow-right" size={14} /></div>
          </button>
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

function ProviderLogin({ onBack, onSignedIn }) {
  const [email, setEmail] = rxS("");
  const [password, setPassword] = rxS("");
  const [showPw, setShowPw] = rxS(false);
  const [err, setErr] = rxS(null);
  const [loading, setLoading] = rxS(false);

  const canSignIn = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;

  const submit = async () => {
    if (!canSignIn) { setErr("Enter a valid provider email and a password (min 6 characters)"); return; }
    setErr(null); setLoading(true);
    try {
      const data = await providerApi.login({ email: email.trim(), password });
      const provider = (data && data.provider) || providerAuth.getSession() || { email: email.trim() };
      onSignedIn({ role: "provider", ...provider });
    } catch (e) {
      setErr(e.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <aside className="login__hero">
        <button className="login__back" onClick={onBack}><RxIcon name="arrow-left" size={14} /> Back to role picker</button>
        <div>
          <div className="login__quote">Prescribe it.<br /><span className="accent">We'll handle the rest.</span></div>
          <div className="login__testimonial">Leadway RxHub pharmacy network covers 36 states and is fulfilled by vetted partner pharmacies. Your orders are auto-routed to the nearest fulfilment channel.</div>

          <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "grid", gap: 12 }}>
            {[
              { icon: "user-check",    t: "Verify member cover in real time",        s: "Live Prognosis + Leadway HMO lookup" },
              { icon: "route",         t: "Auto-route acute vs chronic orders",      s: "WellaHealth · Leadway PBM · WhatsApp" },
              { icon: "map-pin",       t: "Pick the pharmacy nearest the member",    s: "Partner network across Nigeria" },
              { icon: "shield-check",  t: "Encrypted, audit-logged submissions",     s: "Every Rx stamped with a tracking code" },
            ].map(f => (
              <li key={f.t} style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "rgba(255,255,255,.88)" }}>
                <span style={{
                  flex: "0 0 32px", width: 32, height: 32, borderRadius: 8,
                  background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RxIcon name={f.icon} size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-.005em" }}>{f.t}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.58)", marginTop: 2 }}>{f.s}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,.5)", fontSize: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", overflow: "hidden" }}>
            <img src={RX_LOGO} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          Leadway Health HMO · RxHub Provider v1.0
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>
            <RxIcon name="lock" size={10} /> TLS secured
          </span>
        </div>
      </aside>

      <main className="login__panel">
        <span className="login__role-pill"><RxIcon name="stethoscope" size={13} /> Healthcare Provider</span>
        <h1 className="login__h1">Sign in</h1>
        <p className="login__sub">Use the email registered with the Leadway Provider Network and the password issued by Leadway HMO.</p>

        <RxField label="Work email">
          <input className="rx-input" value={email} placeholder="doctor@clinic.com" inputMode="email" autoComplete="email"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          <div style={{ fontSize: 11.5, color: "var(--rx-muted)", marginTop: 6 }}>Use the email registered with Leadway Provider Network</div>
        </RxField>

        <RxField label="Password">
          <div className="login__pw">
            <input className="rx-input" type={showPw ? "text" : "password"} value={password} placeholder="••••••••"
              autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }} />
            <button type="button" className="login__pw__toggle" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
              <RxIcon name={showPw ? "eye-off" : "eye"} size={15} />
            </button>
          </div>
        </RxField>

        <div className="login__row">
          <a className="login__forgot" style={{ marginLeft: "auto" }}>Forgot password?</a>
        </div>

        {err && <div style={{ marginBottom: 14, fontSize: 13, color: "var(--rx-red)", fontWeight: 600 }}>{err}</div>}

        <button className="rx-btn" onClick={submit} disabled={!canSignIn || loading}>
          {loading ? <><RxIcon name="loader-2" size={16} /> Signing in…</> : <>Sign in <RxIcon name="arrow-right" size={16} /></>}
        </button>

        <div className="login__help" style={{ marginTop: 18 }}>
          Support: <a href="tel:+2347080627051">07080627051</a> / <a href="tel:+2342012801051">02012801051</a> <span className="login__help__pill">24/7</span>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { ProviderHub, ProviderLogin });
