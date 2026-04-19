from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Leadway RxHub · Provider API"
    api_prefix: str = "/api/v1"
    environment: str = "local"

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 8

    database_url: str | None = None

    prognosis_base_url: str = "https://prognosis-api.leadwayhealth.com"
    prognosis_api_key: str | None = None

    wellahealth_base_url: str = "https://staging.wellahealth.com/v1"
    wellahealth_api_key: str | None = None

    google_maps_api_key: str | None = None

    whatsapp_bot_url: str = "https://leadway-whatsapp-bot.onrender.com/api"
    whatsapp_number_acute_lagos: str = ""
    whatsapp_number_chronic: str = ""

    anthropic_api_key: str | None = None

    # Parent-app handoff (see /auth/session-exchange). Leave blank to disable.
    embed_shared_secret: str | None = None

    cors_origins: str = "*"


settings = Settings()
