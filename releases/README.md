# Azure Deployment Packages

Pre-packaged zips your IT team can upload directly to Azure. No build
step required — everything is ready to drop into place.

## Files

| File | What to do with it |
|---|---|
| `backend-azure-deploy.zip` | Upload to Azure App Service (Python 3.11 Linux) |
| `frontend-azure-deploy.zip` | Upload to Azure Static Web App |

## How IT uses them

1. Unzip both packages locally
2. Open the `DEPLOY.txt` file inside each — step-by-step instructions
3. Fill in the `.env` file in the backend package (real passwords + API keys)
4. Edit one line in `config.js` in the frontend package (the backend URL)
5. Upload to Azure using the instructions in `DEPLOY.txt`

## Rebuilding

If the source code changes and you need fresh packages:

```bash
bash scripts/build-azure-packages.sh
```

This regenerates both zips from the current `backend/` and `frontend/`
folders.
