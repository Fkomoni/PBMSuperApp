from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Leadway RxHub · Provider API"
    api_prefix: str = "/api/v1"
    environment: str = "local"

    # ── JWT (portal sessions) ──────────────────────────────────────────
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 8

    # ── Database ───────────────────────────────────────────────────────
    database_url: str | None = None

    # ── Prognosis (Leadway legacy) ─────────────────────────────────────
    # Base URL + a service-account username/password used for server-to-server
    # calls (e.g. enrollee verify, provider login proxy). Provider sign-in
    # re-uses the same base URL but authenticates with the individual
    # provider's own credentials in the request body.
    prognosis_base_url: str = "https://prognosis-api.leadwayhealth.com"
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
    whatsapp_number_acute_lagos: str = ""
    whatsapp_number_chronic: str = ""

    # ── Anthropic (AI drug classification) ─────────────────────────────
    anthropic_api_key: str | None = None

    # ── Parent-app embed handoff ───────────────────────────────────────
    embed_shared_secret: str | None = None

    # ── Admin bootstrap ────────────────────────────────────────────────
    # Set these two env vars on Render to auto-create (or promote) an
    # admin account on startup. Safe to leave on — the bootstrap is
    # idempotent and only touches the single row whose email matches.
    admin_bootstrap_email: str | None = None
    admin_bootstrap_password: str | None = None
    admin_bootstrap_name: str = "RxHub Admin"

    # ── CORS ───────────────────────────────────────────────────────────
    cors_origins: str = "*"


settings = Settings()
