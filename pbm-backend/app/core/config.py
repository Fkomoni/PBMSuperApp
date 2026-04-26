from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "pbm-leadway-super-secret-key-2026-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 hours

    class Config:
        env_file = ".env"


settings = Settings()
