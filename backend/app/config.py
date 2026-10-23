"""Application configuration, loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fintech"
    aws_region: str = "ap-south-1"
    cognito_user_pool_id: str = ""
    cognito_app_client_id: str = ""
    s3_bucket_name: str = ""
    signed_url_expiration_minutes: int = 15
    upload_url_expiration_minutes: int = 10
    max_upload_size_mb: int = 25
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_financing_pct_of_po: float = 1.00
    initial_disbursement_pct: float = 0.60
    remaining_disbursement_pct: float = 0.40

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
