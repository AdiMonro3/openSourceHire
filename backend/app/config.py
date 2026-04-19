from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = Field(default="")
    # Point at z.ai (https://api.z.ai/api/anthropic) or any other Anthropic-
    # compatible gateway to use non-Anthropic models (GLM-4.5/4.6, etc.).
    # Empty → official api.anthropic.com.
    anthropic_base_url: str = Field(default="")
    # Model ids are sent straight through to the upstream. For z.ai set
    # e.g. LLM_SONNET_MODEL=glm-4.6, LLM_HAIKU_MODEL=glm-4.5-air.
    llm_sonnet_model: str = Field(default="claude-sonnet-4-6")
    llm_haiku_model: str = Field(default="claude-haiku-4-5-20251001")

    voyage_api_key: str = Field(default="")
    voyage_model: str = Field(default="voyage-3")

    github_client_id: str = Field(default="")
    github_client_secret: str = Field(default="")
    github_oauth_callback_url: str = Field(
        default="http://localhost:8000/auth/github/callback"
    )
    github_service_token: str = Field(default="")

    algora_api_token: str = Field(default="")
    gitcoin_api_token: str = Field(default="")

    database_url: str = Field(
        default="postgresql+psycopg://osh:osh@localhost:5432/osh"
    )
    redis_url: str = Field(default="redis://localhost:6379/0")

    session_secret: str = Field(default="change-me-please")
    backend_cors_origins: str = Field(default="http://localhost:3000")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
