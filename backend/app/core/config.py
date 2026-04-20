from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Values that indicate the sample/default secret was never overridden.
# Fail fast in production so a misconfigured deploy never signs tokens with
# a publicly-known key.
_DEFAULT_JWT_SECRETS = {
    "change-me-in-prod",
    "replace-me-with-32+chars",
}


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

    # ── CORS ───────────────────────────────────────────────────────────
    cors_origins: str = "*"

    @model_validator(mode="after")
    def _validate_production_guardrails(self) -> "Settings":
        # Only enforce in production so local dev / CI can keep using the
        # sample values without raising. These checks are deliberately
        # conservative — a misconfigured deploy fails loud instead of
        # silently minting tokens with a known secret.
        if (self.environment or "").lower() == "production":
            if not self.jwt_secret or self.jwt_secret in _DEFAULT_JWT_SECRETS:
                raise ValueError(
                    "JWT_SECRET must be set to a unique value in production "
                    "(Render's `generateValue: true` creates a safe one)."
                )
            if len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be at least 32 characters in production.")
            if not self.database_url:
                raise ValueError(
                    "DATABASE_URL must be set in production — the SQLite fallback "
                    "would lose data on every restart."
                )
            if (self.cors_origins or "").strip() == "*":
                raise ValueError(
                    "CORS_ORIGINS='*' is not allowed in production. Pin to the "
                    "portal URL (e.g. https://rxhub-provider-portal.onrender.com)."
                )
        return self


settings = Settings()
