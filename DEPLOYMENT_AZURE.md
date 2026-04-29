# Leadway RxHub — Azure Deployment Guide

This guide walks your IT team through deploying the RxHub Provider Portal on
Azure from scratch. It assumes:

- You have an **Azure subscription** with permission to create resources
- You have received the project **zip file** with two folders: `backend/` and `frontend/`
- You have received an **environment variables list** from the project owner

No prior FastAPI / Python / React experience is required — just follow the
steps in order. The whole deployment takes about 60–90 minutes.

---

## What you're deploying

The app has three pieces:

| Piece | Azure service | Purpose |
|---|---|---|
| **Database** | Azure Database for PostgreSQL Flexible Server | Stores prescriptions, providers, tracking events |
| **Backend API** | Azure App Service (Python 3.11 Linux) | The "brain" — handles logins, talks to WellaHealth, etc. |
| **Frontend** | Azure Static Web App | The pages providers see in their browser |

Deploy them in that order.

---

## Step 0 — Prerequisites

Before you start, confirm you have:

- [ ] An Azure subscription (log in at https://portal.azure.com)
- [ ] A Resource Group created (or create one: **Resource Groups → Create → Name: `rg-rxhub-prod`**, region: **West Europe** or closest to Nigeria)
- [ ] The project zip file, **unzipped** locally
- [ ] The environment variables list from the project owner (contains all passwords and API keys)
- [ ] The **Azure CLI** installed on your machine (optional but helpful): https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

---

## Step 1 — Create the PostgreSQL database

### 1a. Create the PostgreSQL server

1. In the Azure portal, click **Create a resource**
2. Search for **Azure Database for PostgreSQL Flexible Server** and click **Create**
3. Fill in:
   - **Subscription:** your subscription
   - **Resource group:** `rg-rxhub-prod`
   - **Server name:** `rxhub-db-prod` (must be globally unique — add a suffix if taken)
   - **Region:** same as your resource group
   - **PostgreSQL version:** `16`
   - **Workload type:** Development (cheapest) for testing, Production for live
   - **Compute + storage:** Burstable, B1ms (1 vCore, 2 GiB RAM) — fine for starting out
   - **Admin username:** `rxhubadmin` (write it down)
   - **Password:** generate a strong one (write it down)
4. Click **Next: Networking**
   - **Connectivity method:** Public access
   - **Firewall rules:** check "Allow public access from any Azure service within Azure to this server" (this lets App Service connect)
   - Also add your own IP so you can connect from your laptop if needed
5. Click **Review + create** → **Create**. Wait ~5 minutes.

### 1b. Create the database inside the server

Once the server is ready:

1. Open the PostgreSQL server resource in the portal
2. In the left sidebar, click **Databases**
3. Click **+ Add** → Name: `rxhub` → Save

### 1c. Build the connection string

The connection string goes in the `DATABASE_URL` environment variable later.
Format:
```
postgresql://rxhubadmin:YOUR_PASSWORD@rxhub-db-prod.postgres.database.azure.com:5432/rxhub
```

Replace `YOUR_PASSWORD` with the admin password you set. Save this string —
the project owner needs it too.

---

## Step 2 — Deploy the backend (App Service)

### 2a. Create the App Service

1. Click **Create a resource** → search **Web App** → Create
2. Fill in:
   - **Resource group:** `rg-rxhub-prod`
   - **Name:** `rxhub-api-prod` (this becomes the URL — `https://rxhub-api-prod.azurewebsites.net`)
   - **Publish:** Code
   - **Runtime stack:** Python 3.11
   - **Operating System:** Linux
   - **Region:** same as DB
   - **Pricing plan:** B1 (Basic) is fine for starting out. Upgrade later if needed.
3. Click **Review + create** → **Create**. Wait ~3 minutes.

### 2b. Configure the startup command

1. Open the newly-created App Service
2. Left sidebar → **Settings → Configuration**
3. Click the **General settings** tab
4. **Startup Command:** paste this and click **Save**:
   ```
   cd backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
5. Confirm **Always On** is **On** (so the API doesn't fall asleep)

### 2c. Set environment variables

1. Same page → click the **Application settings** tab
2. Click **+ New application setting** once for each variable from the list the
   project owner sent you. Example for `JWT_SECRET`:
   - Name: `JWT_SECRET`
   - Value: (paste the value)
   - Click OK
3. Repeat for **every** variable in the list. A typical list contains:
   ```
   ENVIRONMENT
   JWT_SECRET
   DATABASE_URL                 ← use the connection string from Step 1c
   CORS_ORIGINS                 ← fill in after frontend is deployed (Step 3)
   PUBLIC_BASE_URL              ← set this to https://rxhub-api-prod.azurewebsites.net
   PROGNOSIS_BASE_URL
   PROGNOSIS_USERNAME
   PROGNOSIS_PASSWORD
   WELLAHEALTH_BASE_URL
   WELLAHEALTH_CLIENT_ID
   WELLAHEALTH_CLIENT_SECRET
   WELLAHEALTH_PARTNER_CODE
   WHATSAPP_BOT_URL
   WHATSAPP_API_KEY
   WHATSAPP_NUMBER_ACUTE_HOURS_LAGOS
   WHATSAPP_NUMBER_LAGOS_NON_ACUTE
   WHATSAPP_NUMBER_OUTSIDE_NON_ACUTE
   ADMIN_BOOTSTRAP_EMAIL
   ADMIN_BOOTSTRAP_PASSWORD
   ADMIN_BOOTSTRAP_NAME
   EMBED_SHARED_SECRET
   GOOGLE_MAPS_API_KEY
   ```
4. Click **Save** at the top. The app will restart automatically.

### 2d. Upload the backend code

**Easiest method — Zip Deploy via Azure CLI:**

On your laptop, open Terminal / Command Prompt, `cd` into the project folder,
then run:

```bash
# Zip just the backend folder (not the entire project)
cd backend
zip -r ../backend-deploy.zip .
cd ..

# Log in to Azure
az login

# Upload
az webapp deployment source config-zip \
  --resource-group rg-rxhub-prod \
  --name rxhub-api-prod \
  --src backend-deploy.zip
```

Wait 3–5 minutes. You'll see "Deployment successful" when done.

**Alternative — Upload via the portal (if Azure CLI isn't available):**

1. Install the **VS Code Azure extension**, sign in, right-click the App Service → **Deploy to Web App** → pick the `backend/` folder
2. Or use FTPS: the App Service → **Deployment Center** → **FTPS credentials** gives you FTP access. Upload the contents of `backend/` to `/site/wwwroot/`.

### 2e. Verify the backend is running

Open in a browser:
```
https://rxhub-api-prod.azurewebsites.net/health
```

You should see: `{"status":"ok"}`

If you see an error, click **Log stream** in the App Service left sidebar to
see what went wrong. The most common issues are:
- Wrong `DATABASE_URL` → database connection fails
- Missing env var → app crashes at startup
- Startup command wrong → see Step 2b

---

## Step 3 — Deploy the frontend (Static Web App)

### 3a. Edit the frontend config

Before uploading, you MUST edit one file so the frontend knows where the
backend is.

Open `frontend/config.js` in a text editor. Change it to:
```js
window.__API_BASE__ = "https://rxhub-api-prod.azurewebsites.net/api/v1";
```
(Use whatever your actual backend URL is from Step 2a. Note the `/api/v1` at the end.)

Save the file.

### 3b. Create the Static Web App

1. Azure portal → **Create a resource** → search **Static Web App** → Create
2. Fill in:
   - **Resource group:** `rg-rxhub-prod`
   - **Name:** `rxhub-portal-prod`
   - **Plan type:** Free (sufficient) or Standard
   - **Region:** same as the others
   - **Deployment source:** **Other** (we'll upload manually)
3. Click **Review + create** → **Create**

### 3c. Get the deployment token

1. Open the Static Web App
2. Left sidebar → **Manage deployment token** → **Copy**. Keep this token safe.

### 3d. Upload the frontend

**Easiest method — using the SWA CLI:**

Install it once:
```bash
npm install -g @azure/static-web-apps-cli
```

Then upload:
```bash
cd frontend
swa deploy . --deployment-token <paste-token-here> --env production
```

Wait 1–2 minutes. You'll see the live URL, e.g.:
```
https://wonderful-ocean-012345.1.azurestaticapps.net
```

**Alternative — GitHub Actions deploy:**

If your team prefers Git-based deployment, link the Static Web App to the
GitHub repo during creation in Step 3b and it auto-deploys on every push to
the main branch. This needs the GitHub access wizard — skip this if you're
uploading manually.

### 3e. Note the frontend URL

Write down the Static Web App URL — you need it for the next step.

---

## Step 4 — Lock down CORS

Now that you know the frontend URL, go back and fix the `CORS_ORIGINS` env var.

1. App Service `rxhub-api-prod` → **Configuration** → **Application settings**
2. Find `CORS_ORIGINS` and click it
3. Set its value to the frontend URL (no trailing slash):
   ```
   https://wonderful-ocean-012345.1.azurestaticapps.net
   ```
   If the existing Leadway provider portal will also embed RxHub, add it too:
   ```
   https://wonderful-ocean-012345.1.azurestaticapps.net,https://providers.leadwayhealth.com
   ```
4. Save. The backend restarts automatically.

---

## Step 5 — First-run verification

1. Open the frontend URL in Chrome
2. Click **Sign in**
3. Log in with the **admin email and password** set in
   `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
4. You should land on the prescription form. Check the left sidebar for an
   **Admin console** link (with a red ADMIN badge)
5. Open the Admin console → you should see an empty "All prescriptions" list.
   No errors means everything is wired up.

### Quick smoke test
1. Create one test prescription:
   - Enter an enrollee ID (any valid Leadway enrollee number)
   - Add a medication from the search box
   - Fill in the delivery address
   - Click Submit
2. Go to **Admin console** → confirm the prescription appears
3. Check the App Service **Log stream** — you should see
   "dispatch successful" or similar

If any of these fail, see the troubleshooting section below.

---

## Step 6 — Attach a custom domain (optional but recommended)

Once the test site works, you probably want `rxhub.leadwayhealth.com` instead
of the auto-generated Azure URL.

### For the frontend (Static Web App):
1. Static Web App → **Custom domains** → **+ Add**
2. Enter `rxhub.leadwayhealth.com`
3. Azure shows you a CNAME record to add to your DNS (ask your domain admin)
4. Once DNS propagates (5–60 min), the domain activates with a free TLS cert

### For the backend (App Service):
1. App Service → **Custom domains** → **+ Add custom domain**
2. Enter `rxhub-api.leadwayhealth.com`
3. Add the CNAME record shown to your DNS
4. Click **Validate** → **Add**
5. Left sidebar → **TLS/SSL settings** → enable **Managed Certificate** (free)

Then update:
- `PUBLIC_BASE_URL` env var to the new backend domain
- `CORS_ORIGINS` env var to the new frontend domain
- `frontend/config.js` to the new backend domain
- Re-deploy the frontend (Step 3d)

---

## Troubleshooting

### "502 Bad Gateway" or the backend never responds

**Look at the log stream first** (App Service → Log stream). The most common
causes:

1. **Startup command wrong** — re-check Step 2b exactly.
2. **Missing environment variable** — the app logs "missing env var X" at
   startup. Add it in Application settings.
3. **Database unreachable** — check the `DATABASE_URL` value and confirm the
   PostgreSQL firewall allows Azure services (Step 1a).
4. **`JWT_SECRET` too short** — in production it must be ≥ 32 characters.

### "CORS error" in the browser console

The frontend URL is not in `CORS_ORIGINS`. Fix it in Step 4. No trailing
slash. Use `https://`, not `http://`.

### Admin user cannot log in

Check the App Service log stream for the boot message:
```
BOOT admin bootstrap: created <email>
```
If you don't see that, the `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` env vars aren't set correctly. Fix them and
restart the App Service.

### "Could not connect to WellaHealth"

Check that all three `WELLAHEALTH_*` env vars match exactly what WellaHealth
issued (including `WELLAHEALTH_PARTNER_CODE`). Re-check the base URL is
`https://api.wellahealth.com` (NOT the docs/staging URL).

### Frontend loads but login does nothing

Open browser **Developer Tools → Network** tab, attempt to log in, and look
at the failing request. If it's going to `http://localhost:8000/api/v1/login`
instead of your Azure backend URL, you forgot to update `frontend/config.js`
in Step 3a. Fix it, re-deploy the frontend (Step 3d).

---

## Ongoing maintenance

### Deploying a code update later
Whenever the project owner sends you a new zip:

1. Backend: re-run the Zip Deploy command in Step 2d
2. Frontend: re-run the SWA deploy in Step 3d
3. No database migration is ever needed — the app auto-migrates at startup

### Rotating a secret
Just edit the env var in App Service → Configuration → Save. The backend
auto-restarts.

### Viewing logs
- **Real-time:** App Service → **Log stream**
- **Historical:** App Service → **Diagnose and solve problems** → **Application Logs**

### Scaling up
If traffic grows: App Service → **Scale up (App Service Plan)** → pick a
bigger tier (e.g. P1v3). No downtime. No code changes.

---

## What to send back to the project owner

After deployment, send them:

1. **Frontend URL:** `https://...azurestaticapps.net` (or the custom domain)
2. **Backend URL:** `https://rxhub-api-prod.azurewebsites.net` (or the custom domain)
3. **Admin login credentials** (only if you set up the admin account yourself)

That's everything they need to start onboarding providers.
