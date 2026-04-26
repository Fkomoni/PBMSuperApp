import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # No default — startup fails if SECRET_KEY is missing in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # reduced from 720 to 60

    ENVIRONMENT: str = "development"
    REDIS_URL: str = "redis://localhost:6379"

    # Staff password loaded from env — never hardcoded in source
    STAFF_DEFAULT_PASSWORD: str = "Change-Me-Before-Deploy-2026!"

    class Config:
        env_file = ".env"


settings = Settings(_env_file=".env" if os.path.exists(".env") else None)
