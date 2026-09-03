import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://camtech:camtech123@localhost:5432/camtechStore"
    )
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", 
        "dev-only-change-me-please-use-a-long-random-string-0123456789"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # 7 days
    ENCRYPTION_KEY: str = os.getenv(
        "ENCRYPTION_KEY",
        "mystore-default-32-byte-secret-key-ok!"
    )
    PORT: int = int(os.getenv("PORT", 4000))
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }


settings = Settings()
