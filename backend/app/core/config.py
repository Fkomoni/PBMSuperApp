from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_DEFAULTS = {"change-me-in-prod", "secret", "password", "jwt_secret"}
_JWT_SECRET_MIN_LEN = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Leadway RxHub · Provider API"
    api_prefix: str = "/api/v1"
    environment: str = "local"

    # ── JWT (portal sessions) ──────────────────────────────────────────
    jwt_secret: str = "change-me-in-local-dev-only-set-JWT_SECRET-in-production"
    jwt_ttl_hours: int = 8

    def validate_secrets(self) -> None:
        """Call once at startup. Raises RuntimeError for insecure configs in
        production so a misconfigured deploy crashes loudly rather than
        silently accepting forged tokens.
        """
        if self.environment == "production":
            if self.jwt_secret in _INSECURE_JWT_DEFAULTS:
                raise RuntimeError(
                    "JWT_SECRET is set to a well-known default value. "
                    "Set a strong random secret (>= 32 chars) via the JWT_SECRET env var."
                )
            if len(self.jwt_secret) < _JWT_SECRET_MIN_LEN:
                raise RuntimeError(
                    f"JWT_SECRET must be at least {_JWT_SECRET_MIN_LEN} characters long."
                )
            cors = (self.cors_origins or "").strip()
            if not cors or cors == "*":
                raise RuntimeError(
                    "CORS_ORIGINS must be set to one or more explicit origins in production "
                    "(e.g. https://rxhub-provider-portal.onrender.com). "
                    "A wildcard '*' allows any origin to call the API."
                )

    # ── Database ───────────────────────────────────────────────────────
    database_url: str | None = None

    # ── Redis (JWT revocation blocklist) ───────────────────────────────
    # When set, logout tokens are stored in Redis so revocation survives
    # restarts and works across multiple instances. Falls back to in-memory
    # if unset or if the connection fails.
    redis_url: str | None = None

    # ── Prognosis (Leadway legacy) ─────────────────────────────────────
    # Base URL + a service-account username/password used for server-to-server
    # calls (e.g. enrollee verify, provider login proxy). Provider sign-in
    # re-uses the same base URL but authenticates with the individual
    # provider's own credentials in the request body.
    # Default is empty — set PROGNOSIS_BASE_URL explicitly so a misconfigured
    # dev environment with real credentials does not silently hit production.
    prognosis_base_url: str = ""
    prognosis_username: str | None = None
    prognosis_password: str | None = None
    # Escape hatch — if Prognosis doesn't accept `Basic <base64(user:pass)>`,
    # paste the exact Authorization header value here (e.g. "Bearer eyJ…" or
    # "ApiKey xyz") and it will be used verbatim on every Prognosis call.
    prognosis_auth_header: str | None = None

    # ── WellaHealth (acute fulfilment partner) ─────────────────────────
    # Basic auth with client_id:client_secret + a Partner-Code header.
    wellahealth_base_url: str = "https://api.wellahealth.com"
    wellahealth_client_id: str | None = None
    wellahealth_client_secret: str | None = None
    wellahealth_partner_code: str | None = None

    # ── Google Maps ────────────────────────────────────────────────────
    google_maps_api_key: str | None = None

    # ── WhatsApp bot + routed numbers ──────────────────────────────────
    whatsapp_bot_url: str = "https://leadway-whatsapp-bot.onrender.com/api"
    # POST path appended to the bot base URL (e.g. /send, /send-message,
    # /messages, /send-whatsapp). Depends on your bot — check its code.
    whatsapp_send_path: str = "/send-message"
    # Body field names — Leadway bot expects {phone, message}. Override
    # if your bot expects {to, text} or similar.
    whatsapp_field_phone: str = "phone"
    whatsapp_field_message: str = "message"
    # API key + header name (default X-API-Key, which is the most common).
    whatsapp_api_key: str | None = None
    whatsapp_api_key_header: str = "X-API-Key"

    # Three-number routing scheme:
    #   1. Acute · Lagos · business-hours     → acute-hours Leadway WhatsApp
    #   2. Non-acute (chronic / mixed / special) · Lagos     → Lagos PBM WhatsApp
    #   3. Non-acute (chronic / mixed / special) · outside Lagos  → outside PBM WhatsApp
    # Defaults are the Leadway-supplied production numbers; override via env
    # vars per deployment if any of them rotate.
    whatsapp_number_acute_hours_lagos: str = "+2347011706864"
    whatsapp_number_lagos_non_acute: str = "+234708340602"
    whatsapp_number_outside_non_acute: str = "+234818123382841"

    # Legacy aliases retained so older env-var settings keep working — each
    # falls through to the matching new slot above when the new var is empty.
    whatsapp_number_acute_lagos: str = ""
    whatsapp_number_chronic: str = ""

    # ── Anthropic (AI drug classification) ─────────────────────────────
    anthropic_api_key: str | None = None

    # ── Parent-app embed handoff ───────────────────────────────────────
    embed_shared_secret: str | None = None
    # The public URL of the portal front-end — used by /auth/embed-login
    # to build the `portal_url` it hands back to the parent app. Example:
    # https://rxhub.leadwayhealth.com  (no trailing slash)
    frontend_base_url: str = ""

    # ── Admin bootstrap ────────────────────────────────────────────────
    # Set these two env vars on Render to auto-create (or promote) an
    # admin account on startup. Safe to leave on — the bootstrap is
    # idempotent and only touches the single row whose email matches.
    admin_bootstrap_email: str | None = None
    admin_bootstrap_password: str | None = None
    admin_bootstrap_name: str = "RxHub Admin"

    # ── Public URLs (email branding, attachments, etc.) ────────────────
    # The backend's own public URL — used to compose absolute asset URLs
    # that appear in member emails (e.g. the Leadway logo). Leave empty
    # and the email header falls back to text-only.
    public_base_url: str = ""
    # Optional override — if set, emails use this URL for the brand logo
    # instead of composing {public_base_url}/brand/leadway-logo.jpg.
    email_logo_url: str = ""

    # ── CORS ───────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins. NEVER use "*" in production.
    # Example: https://rxhub-provider-portal.onrender.com,http://localhost:3000
    cors_origins: str = ""


settings = Settings()
