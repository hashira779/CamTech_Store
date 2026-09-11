import json
import os
from typing import Any, List
from pydantic import field_validator
from pydantic_settings import BaseSettings

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
    DEFAULT_ORG_ID: str = os.getenv("DEFAULT_ORG_ID", "cmtk8h18o0000vkd0etmdacgw")
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return ["*"]
            if v.startswith("[") and v.endswith("]"):
                inner = v[1:-1].strip()
                if not inner:
                    return ["*"]
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    pass
                return [x.strip().strip("'\"") for x in inner.split(",") if x.strip()]
            return [x.strip().strip("'\"") for x in v.split(",") if x.strip()]
        elif isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return ["*"]

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }


settings = Settings()
