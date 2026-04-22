# Message to the Leadway IT / Dev Team

Before you start, please read this. It addresses the points raised after
receiving the handover zip.

---

## "Send the production build, not the code"

**There is no separate 'production build' for this project.**

This is a Python (FastAPI) + static HTML stack. Neither part has a
compilation step:

| Part | Build process |
|---|---|
| Backend (FastAPI) | **None.** Python is interpreted. The `.py` files IS what runs in production. Azure App Service runs `pip install -r requirements.txt` automatically at startup. |
| Frontend (HTML/JS) | **None.** It's already static HTML + CSS + JavaScript loaded directly by the browser. No webpack, no npm build, no bundler. Just upload the `frontend/` folder as-is. |

Compare to other stacks you may have used:

| Stack | Needs a build? |
|---|---|
| Node.js / React with webpack | ✅ Yes — `npm run build` produces a `dist/` |
| .NET Core | ✅ Yes — `dotnet publish` produces DLLs |
| Java | ✅ Yes — `mvn package` produces JARs |
| **Python + FastAPI (this app)** | ❌ **No — source code IS the deliverable** |
| **Plain static HTML/JS (this frontend)** | ❌ **No — files are ready as-is** |

If you've never deployed a Python web app before, this is the same
pattern Azure's own **"Deploy a Python web app to Azure"** quickstart
uses: https://learn.microsoft.com/en-us/azure/app-service/quickstart-python

---

## "Build the env into it"

**Never bake secrets into code.** This is a well-known security
anti-pattern. Azure App Service provides a **Configuration** panel
specifically to keep secrets outside the code:

1. Azure portal → your App Service → **Settings → Configuration**
2. Click **+ New application setting** once per variable
3. Save — Azure restarts the app and injects them as environment
   variables

A template of every variable you need is in `backend/.env.example`.
Just open it, copy each line's name and value into the Azure
Configuration panel. Do **not** upload `.env.example` into the web
server directory — it's just a reference.

---

## What's in the zip — plain language

```
rxhub-handover/
├── backend/                  ← The API (Python/FastAPI)
│   ├── app/                    • Application code
│   ├── requirements.txt        • Dependencies — Azure installs these
│   ├── .env.example            • Template for environment variables
│   └── seed_provider.py        • Optional admin seeder (not needed if
│                                 you use ADMIN_BOOTSTRAP_* env vars)
│
├── frontend/                 ← The UI (plain HTML/JS, no build step)
│   ├── index.html              • Entry point
│   ├── config.js               • EDIT THIS to point at your API URL
│   ├── staticwebapp.config.json• Azure Static Web Apps config
│   ├── src/                    • React components (loaded via Babel CDN)
│   ├── styles/                 • CSS
│   └── assets/                 • Logos, images
│
├── DEPLOYMENT_AZURE.md       ← Step-by-step deployment guide
└── AZURE_IT_PACKAGE.md       ← This file
```

---

## Deployment — the 4 real steps

The full walk-through is in **`DEPLOYMENT_AZURE.md`**. Summary:

### 1. Provision Azure resources

- **Azure Database for PostgreSQL Flexible Server** (tier B1ms is fine)
- **Azure App Service** (Linux, Python 3.11) for the backend
- **Azure Static Web App** (Free tier works) for the frontend

### 2. Deploy the backend

```bash
# From your laptop, one-time:
cd backend
zip -r ../backend-deploy.zip .
cd ..

az login
az webapp deployment source config-zip \
  --resource-group rg-rxhub-prod \
  --name rxhub-api-prod \
  --src backend-deploy.zip
```

Then in the Azure portal:
- **Configuration → General settings → Startup Command:**
  ```
  cd backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- **Configuration → Application settings:** add every variable from
  `backend/.env.example` (replace the `REPLACE_WITH_*` placeholders
  with real values from the project owner)

### 3. Deploy the frontend

```bash
# Edit frontend/config.js first — set window.__API_BASE__ to your
# backend URL + /api/v1
# Example: "https://rxhub-api-prod.azurewebsites.net/api/v1"

cd frontend
npm install -g @azure/static-web-apps-cli
swa deploy . --deployment-token <token-from-azure-portal> --env production
```

### 4. Verify

Open the frontend URL. Sign in with the `ADMIN_BOOTSTRAP_EMAIL` /
`ADMIN_BOOTSTRAP_PASSWORD` you configured. You should see the portal
and an Admin Console link in the sidebar.

---

## What to ask the project owner for

Before you start, confirm you have **the filled-in values** for every
`REPLACE_WITH_*` in `backend/.env.example`. Specifically:

- `JWT_SECRET` (they generate a 64-char random string)
- `PROGNOSIS_USERNAME` / `PROGNOSIS_PASSWORD`
- `WELLAHEALTH_CLIENT_ID` / `WELLAHEALTH_CLIENT_SECRET` / `WELLAHEALTH_PARTNER_CODE`
- `WHATSAPP_API_KEY`
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (they choose)
- `EMBED_SHARED_SECRET` (they generate; also given to the existing portal team)
- `GOOGLE_MAPS_API_KEY`

Azure provides:
- `DATABASE_URL` (you build it from the PostgreSQL you create)
- `PUBLIC_BASE_URL` (your backend App Service URL)
- `CORS_ORIGINS` (your frontend Static Web App URL)

---

## Still stuck?

If anything in this guide is unclear, point at the specific step number
in `DEPLOYMENT_AZURE.md` and ask the project owner to clarify that step
— they can explain the reasoning behind any choice there.
