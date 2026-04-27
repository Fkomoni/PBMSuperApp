// Resolved once at startup from the Vite build-time env var.
// In dev the proxy in vite.config.js handles /api/* so this is empty.
// In production (Render) set VITE_API_URL=https://rxhub-pbm-api.onrender.com
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
