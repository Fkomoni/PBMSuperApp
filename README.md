# PBM Super App — Leadway RxHub (Provider Portal)

Implementation of the **Leadway RxHub** design from the Claude Design handoff,
focused on the **provider journey** (healthcare providers, clinics) signing in,
looking up members, and sending prescription orders into the Leadway PBM hub.

## What's in this repo

```
PBMSuperApp/
├─ frontend/                  # Static React-via-Babel app (matches RxHub design)
│  ├─ index.html              # Entry — imports tokens.css + rxhub.css + provider.css
│  ├─ styles/
│  │  ├─ tokens.css           # Ported from Leadway design manual
│  │  ├─ app.css              # PBM staff portal styles (shared)
│  │  ├─ rxhub.css            # Softer consumer-facing RxHub shell
│  │  └─ provider.css         # Provider-specific additions (stepper, drug row, drawer)
│  ├─ src/rx/
│  │  ├─ rxhub-ui.jsx         # Shared primitives: RxIcon, RxBadge, RxSeg, RxField, RxBanner, RxSupport
│  │  ├─ provider-api.js      # Thin fetch client for the backend endpoints
│  │  ├─ provider-login.jsx   # Hub + email/password login (matches RxHub LoginPanel)
│  │  ├─ provider-shell.jsx   # Sidebar + topbar + mobile bottom nav
│  │  ├─ provider-dashboard.jsx  # Stats + recent requests + routing rules
│  │  ├─ provider-enrollee.jsx   # Member lookup + cover detail
│  │  ├─ provider-new-request.jsx # 4-step wizard: member → diagnosis → meds → review
│  │  ├─ provider-requests.jsx    # List + tracking drawer
│  │  └─ provider-main.jsx        # Top-level router
│  ├─ assets/leadway-logo.jpg
│  └─ serve.py                # `python serve.py 5173` for local dev
└─ backend/                    # FastAPI skeleton with the full API surface the frontend calls
   ├─ requirements.txt
   ├─ .env.example
   └─ app/
      ├─ main.py               # FastAPI app + CORS + router wiring (prefix /api/v1)
      ├─ core/
      │  ├─ config.py          # pydantic-settings (Prognosis, WellaHealth, GMaps, JWT)
      │  ├─ security.py        # JWT create/verify + current_provider dep
      │  └─ routing.py         # Acute/chronic · Lagos/outside routing matrix
      ├─ schemas/provider.py
      └─ api/
         ├─ auth.py            # POST /login  (TODO: proxy Prognosis ProviderLogIn)
         ├─ lookup.py          # enrollee, diagnoses, address autocomplete/details
         ├─ medications.py     # drug search (TODO: wire WellaHealth tariff + drug_master)
         └─ requests.py        # submit + list + tracking (in-memory store for now)
```

## Routing rules implemented

Both the frontend's **Routing preview** (step 4 of the new-request wizard) and
the backend's `core/routing.py` share the same matrix:

| Classification | Location | Time | Channel |
| --- | --- | --- | --- |
| Acute | Lagos | Mon–Fri | Leadway PBM WhatsApp #1 |
| Acute | Lagos | Weekend | WellaHealth |
| Acute | Outside Lagos | any | WellaHealth / partner |
| Chronic | Lagos | any | Leadway PBM WhatsApp #2 |
| Chronic | Outside Lagos | any | Leadway PBM WhatsApp #2 |
| Mixed (acute + chronic) | any | any | Leadway PBM WhatsApp #1 |
| Hormonal · Cancer · Autoimmune · Fertility | Lagos | any | Leadway PBM WhatsApp #1 |
| Hormonal · Cancer · Autoimmune · Fertility | Outside Lagos | any | Leadway PBM WhatsApp #2 |

## API surface (prefix: `/api/v1`)

Matches the existing Leadway Rx Routing Hub endpoints so the frontend can point
at either backend:

```
POST /login
GET  /lookup/enrollee?enrollee_id=
GET  /lookup/diagnoses?q=
GET  /medications/search?q=
GET  /lookup/address-autocomplete?input=
GET  /lookup/address-details?place_id=
POST /medication-requests
GET  /medication-requests
GET  /medication-requests/{id}/tracking
```

## Running locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Prognosis / WellaHealth / Google / WhatsApp / JWT secrets
uvicorn app.main:app --reload --port 8000
```

Health check: <http://localhost:8000/health> · OpenAPI: <http://localhost:8000/docs>

### Frontend

```bash
cd frontend
python serve.py 5173
```

Open <http://localhost:5173>. The page reads the backend URL from
`window.__API_BASE__`; override it in a small `config.js` before the bundle, or
point at the existing deployment:

```html
<script>window.__API_BASE__ = "https://leadway-rx-api.onrender.com/api/v1";</script>
```

## Wiring TODOs (for production)

1. **Prognosis ProviderLogIn** — `backend/app/api/auth.py` currently accepts any
   6-char password so the UI is exercised end-to-end. Replace `login()` with an
   httpx call to `settings.prognosis_base_url`.
2. **Postgres persistence** — `backend/app/api/requests.py` uses an in-memory
   dict. Swap in SQLAlchemy and the `providers`, `medication_requests`,
   `medication_request_items`, `classification_results`, `routing_decisions`,
   `wellahealth_api_logs`, `whatsapp_dispatch_logs`, `medication_audit_logs`
   tables.
3. **WellaHealth tariff** — `medications.search` should read from the
   `drug_master` table with a WellaHealth fallback (see
   `settings.wellahealth_base_url`).
4. **Google Maps** — `lookup/address-*` endpoints currently return stubs. Proxy
   to Google Places & Geocoding APIs using `settings.google_maps_api_key`.
5. **WhatsApp dispatch** — on request submission, call the WhatsApp bot
   (`settings.whatsapp_bot_url`) using the appropriate routed number.
6. **Anthropic drug classification** — run `classification_hint == "auto"` items
   through Claude to pick acute/chronic.

## Design provenance

The visual language comes directly from the Claude Design handoff bundle
(`Leadway RxHub.html` + `styles/rxhub.css` + `src/rx/rxhub-ui.jsx` +
`src/rx/rxhub-login.jsx`). The provider role in the design was a placeholder
landing (`rxhub-other-roles.jsx`); this repo completes that journey end-to-end.
