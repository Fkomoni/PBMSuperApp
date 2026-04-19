import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Leadway RxHub · Provider API"
    api_prefix: str = "/api/v1"
    environment: str = "local"

    # ── JWT (portal sessions) ──────────────────────────────────────────
    # No insecure default — must be set via env in any non-local deploy.
    # In local dev we auto-generate a per-process random secret so tokens
    # can't outlive the process and never collide with a well-known value.
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 8
    # Optional JWT claims for stronger binding of tokens to this API.
    jwt_issuer: str = "rxhub-provider-api"
    jwt_audience: str = "rxhub-provider-portal"

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
    whatsapp_number_acute_lagos: str = ""
    whatsapp_number_chronic: str = ""

    # ── Anthropic (AI drug classification) ─────────────────────────────
    anthropic_api_key: str | None = None

    # ── Parent-app embed handoff ───────────────────────────────────────
    embed_shared_secret: str | None = None

    # ── CORS ───────────────────────────────────────────────────────────
    # Empty default — must be set per deploy. Do NOT ship "*" in prod: it
    # combines unsafely with allow_credentials and is overly permissive.
    cors_origins: str = ""


settings = Settings()


def _is_production(env: str | None) -> bool:
    return (env or "").strip().lower() in ("production", "prod", "live")


def _validate_settings() -> None:
    """Fail-fast on misconfiguration in production; auto-heal in local dev."""
    global settings
    if not settings.jwt_secret:
        if _is_production(settings.environment):
            raise RuntimeError(
                "JWT_SECRET is required in production. Refusing to start with "
                "an insecure default."
            )
        # Local dev: per-process random secret, logged length only.
        settings.jwt_secret = secrets.token_urlsafe(48)
    elif len(settings.jwt_secret) < 32 and _is_production(settings.environment):
        raise RuntimeError(
            "JWT_SECRET must be at least 32 characters in production."
        )

    if _is_production(settings.environment):
        if not settings.cors_origins or settings.cors_origins.strip() == "*":
            raise RuntimeError(
                "CORS_ORIGINS must be an explicit list of origins in production; "
                "the wildcard '*' is refused."
            )


_validate_settings()
