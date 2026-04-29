# PBM Super App — Leadway RxHub (Provider Portal)

Implementation of the **Leadway RxHub** design from the Claude Design handoff,
focused on the **provider journey** (healthcare providers, clinics) signing in,
looking up members, and sending prescription orders into the Leadway PBM hub.

This repo owns its own backend (FastAPI + Postgres) — you do **not** reuse the
existing `leadway-rx-api` service. Deploy once from `render.yaml` and you get
a DB, API, and static frontend.

## Layout

```
PBMSuperApp/
├─ render.yaml                       # One-click Render blueprint (DB + API + static site)
├─ rxhub-provider-frontend/                         # Static React-via-Babel app
│  ├─ index.html                     # Loads config.js → backend URL
│  ├─ config.js                      # EDIT per environment: window.__API_BASE__ = "..."
│  ├─ styles/
│  │  ├─ tokens.css  app.css  rxhub.css  provider.css
│  ├─ src/rx/
│  │  ├─ rxhub-ui.jsx                # Shared primitives (RxIcon, RxBadge, …)
│  │  ├─ provider-api.js             # Fetch client
│  │  ├─ provider-login.jsx          # Hub + email/password login
│  │  ├─ provider-shell.jsx          # Sidebar + topbar + mobile nav
│  │  ├─ provider-dashboard.jsx      # Stats + recent requests + routing rules
│  │  ├─ provider-enrollee.jsx       # Member lookup + cover detail
│  │  ├─ provider-new-request.jsx    # 4-step wizard (member → dx → meds → review)
│  │  ├─ provider-requests.jsx       # List + tracking drawer
│  │  └─ provider-main.jsx           # Router
│  └─ serve.py                       # `python serve.py 5173` for local dev
└─ rxhub-provider-backend/                           # FastAPI + SQLAlchemy
   ├─ requirements.txt
   ├─ .env.example
   ├─ seed_provider.py               # CLI to create/reset a provider account
   └─ app/
      ├─ main.py                     # FastAPI + CORS + lifespan (init_db)
      ├─ models.py                   # SQLAlchemy: Provider, MedicationRequest, Item, TrackingEvent
      ├─ core/
      │  ├─ config.py                # pydantic-settings (JWT, DB, integrations)
      │  ├─ db.py                    # Engine + SessionLocal + Base + init_db
      │  ├─ passwords.py             # bcrypt hash / verify
      │  ├─ routing.py               # Acute/chronic · Lagos/outside routing matrix
      │  └─ security.py              # JWT create/verify + current_provider dep
      ├─ schemas/provider.py         # Pydantic request/response shapes
      ├─ services/
      │  ├─ icd10.py                 # Standard ICD-10 catalog (~250 codes) + search
      │  └─ places.py                # Google Places / Geocoding proxy w/ dev stubs
      └─ api/
         ├─ auth.py                  # POST /login  +  POST /providers/register
         ├─ lookup.py                # /lookup/enrollee · /lookup/diagnoses · /lookup/address-*
         ├─ medications.py           # /medications/search
         └─ requests.py              # /medication-requests  (submit · list · tracking)
```

## API surface (prefix `/api/v1`)

```
POST /login                              → { token, expires_in, provider }
POST /providers/register                 → { provider_id, name, email, … }   (gate in prod)

GET  /lookup/enrollee?enrollee_id=       → member cover + medications
GET  /lookup/diagnoses?q=[&limit=]       → [{ code, name }]   ICD-10 catalog
GET  /lookup/address-autocomplete?input= → [{ place_id, description, main_text, … }]
GET  /lookup/address-details?place_id=   → { formatted_address, lat, lng, … }

GET  /medications/search?q=              → [{ drug_id, name, generic, unit_price, classification }]

POST /medication-requests                → submits a prescription, returns { id, status, route, … }
GET  /medication-requests                → your recent requests (provider-scoped)
GET  /medication-requests/{id}/tracking  → { request_id, events: [{ label, at, kind, icon, note }] }
```

All endpoints except `/login` and `/providers/register` require
`Authorization: Bearer <JWT>`.

## Routing matrix

| Classification | Location | Channel |
| --- | --- | --- |
| Acute | any | WellaHealth |
| Chronic | Lagos | Leadway PBM WhatsApp #2 |
| Chronic | Outside Lagos | Leadway PBM WhatsApp #2 |
| Mixed (acute + chronic) | any | Leadway PBM WhatsApp #1 |
| Hormonal · Cancer · Autoimmune · Fertility | Lagos | Leadway PBM WhatsApp #1 |
| Hormonal · Cancer · Autoimmune · Fertility | Outside Lagos | Leadway PBM WhatsApp #2 |

Matrix lives in `rxhub-provider-backend/app/core/routing.py` (backend enforcement) and
`rxhub-provider-frontend/src/rx/provider-new-request.jsx::previewRoute` (step-4 preview).

## ICD-10 diagnosis catalog

Embedded in `rxhub-provider-backend/app/services/icd10.py` — ~250 standard ICD-10 codes
covering infectious, neoplasms, endocrine/metabolic (incl. all common diabetes
codes), mental health, neurology, circulatory, respiratory, digestive, skin,
musculoskeletal, renal, obstetrics, symptoms (R-codes), and Z-codes.
`GET /lookup/diagnoses?q=<query>&limit=<n>` ranks exact-code → prefix-code →
substring matches. Swap in the full WHO catalog (~70k codes) later by loading
from a CSV into a `diagnoses` table.

## Running locally

```bash
# 1. Backend
cd rxhub-provider-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit if you want Google/Prognosis/Wella keys
python seed_provider.py doctor@clinic.com "Dr Jane Doe" "somePw123!"
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd rxhub-provider-frontend
python serve.py 5173
```

Open <http://localhost:5173>, click **Sign in**, use `doctor@clinic.com` /
`somePw123!`. `rxhub-provider-frontend/config.js` defaults to `http://localhost:8000/api/v1`
when run locally.

## Deploying to Render (one click from `render.yaml`)

1. Push this repo; make sure `render.yaml` is on the deployable branch.
2. Render dashboard → **Blueprints → New Blueprint Instance** → pick this repo.
3. Render provisions:
   - `rxhub-db` (Postgres)
   - `rxhub-provider-api` (FastAPI — auto-creates tables on first boot)
   - `rxhub-provider-portal` (static site)
4. In the API service's **Environment**, fill in the keys marked `sync: false`
   (Google Maps, Prognosis, WellaHealth, WhatsApp numbers, Anthropic) once you
   have them. The API boots without them — integrations that need them fall
   back to stubs.
5. In the API service's **Shell**, create the first provider account:
   ```bash
   python seed_provider.py doctor@clinic.com "Dr Jane Doe" "somePw123!"
   ```
   Or hit `POST /api/v1/providers/register` once, then gate the endpoint.
6. Edit `rxhub-provider-frontend/config.js` so `window.__API_BASE__` points at the deployed
   API (`https://rxhub-provider-api.onrender.com/api/v1`), push, and the
   static site redeploys automatically.
7. Update `CORS_ORIGINS` on the API service to the static site's URL (e.g.
   `https://rxhub-provider-portal.onrender.com`) — pre-set in `render.yaml`
   but you can widen to `*` in staging.

## Provider login link

Once deployed, providers go to:

```
https://rxhub-provider-portal.onrender.com/
```

Click **Sign in**, enter the email + password set by the PBM admin (via
`seed_provider.py` or a gated `/providers/register` call).

## Environment variables the backend reads

See `rxhub-provider-backend/.env.example`. Summary:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | HMAC key for signing provider tokens (auto-generated on Render) |
| `JWT_TTL_HOURS` | Default 8h |
| `DATABASE_URL` | Postgres URL (provisioned by Render) |
| `CORS_ORIGINS` | Comma-separated origins; `*` for dev |
| `GOOGLE_MAPS_API_KEY` | Places autocomplete + geocoding (optional — stubs when empty) |
| `PROGNOSIS_BASE_URL`, `PROGNOSIS_API_KEY` | Future: enrollee lookup |
| `WELLAHEALTH_BASE_URL`, `WELLAHEALTH_API_KEY` | Future: tariff + dispatch |
| `WHATSAPP_BOT_URL`, `WHATSAPP_NUMBER_ACUTE_LAGOS`, `WHATSAPP_NUMBER_CHRONIC` | Future: dispatch on routing |
| `ANTHROPIC_API_KEY` | Future: AI drug classification for `classification: "auto"` |

## Provider authentication

Two modes are supported out of the box:

### 1. Direct login (standalone portal)

`POST /api/v1/login` proxies to Prognosis `ProviderLogIn` via
`rxhub-provider-backend/app/services/prognosis.py`. On success we **upsert** a local
`providers` row from the Prognosis response and mint an 8-hour JWT. Providers
never have a password stored here — Prognosis is the source of truth.

If Prognosis is unreachable, `/login` falls back to the local bcrypt-hashed
provider table, which is what the `seed_provider.py` CLI writes to. Use this
for PBM admin / break-glass accounts only.

**Tell me these three things about your Prognosis API and I'll tighten the
adapter** (they live side by side in `services/prognosis.py`):

| Adapter point | What we need |
| --- | --- |
| `LOGIN_PATH` | The exact path (currently `/api/Provider/ProviderLogIn`) |
| `_build_payload` | Request JSON field names (currently `Email` / `Password`) |
| `_from_response` | Response field names for provider id, name, email, facility |

### 2. Embedded handoff (when the portal lives inside another app)

When a provider already signed into a parent app (e.g. the Leadway Provider
dashboard) and you embed this portal, the parent app redirects / iframes to
the portal with credentials in the query string:

```
https://rxhub-provider-portal.onrender.com/?token=<prognosis-bearer>
```

or, for a simpler email handoff (only safe if the parent app is on the same
security boundary):

```
https://rxhub-provider-portal.onrender.com/?handoff=doctor@clinic.com&secret=<EMBED_SHARED_SECRET>
```

On boot, the portal hits `POST /api/v1/auth/session-exchange`, gets a JWT,
scrubs the credentials from the URL, and drops the provider straight onto
the dashboard. No login screen.

**Status:** the signed-email mode is wired and ready — set
`EMBED_SHARED_SECRET` on the API and the parent app appends the same secret
to the link. The Prognosis-token passthrough returns `501` until you give me
the Prognosis session-verify endpoint (one-line change in
`services/prognosis.py`).

## Next wiring steps (in order)

1. **Prognosis field mapping** — confirm the three adapter points above and
   I'll trim the guesswork.
2. **Prognosis enrollee lookup** — `rxhub-provider-backend/app/api/lookup.py::enrollee` is a
   stub. Replace with an httpx call to `settings.prognosis_base_url`.
3. **WellaHealth tariff feed** — `rxhub-provider-backend/app/api/medications.py::search` is
   a stub. Add a `drug_master` table (or cache) and refresh from WellaHealth.
4. **WhatsApp dispatch** — on `POST /medication-requests` success, fire a
   message to the WhatsApp bot using the channel from `core/routing.py`.
5. **Anthropic auto-classification** — when `classification_hint == "auto"`
   on an item, call Claude to pick `acute`/`chronic` before persisting.

## Design provenance

Visual language is ported verbatim from the Claude Design handoff bundle
(`Leadway RxHub.html`, `styles/rxhub.css`, `src/rx/rxhub-ui.jsx`,
`src/rx/rxhub-login.jsx`). The provider role in the design was a placeholder
landing (`rxhub-other-roles.jsx`); this repo completes the journey end-to-end.
