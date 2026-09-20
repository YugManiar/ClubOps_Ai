"""
Environment configuration, validated at import time.

The point of the validators below is that a misconfigured deploy must fail to
BOOT, not fail on the first authenticated request. A container that starts
healthy and then 500s on every real call passes a /health-based deploy gate and
looks like an application bug for as long as it takes someone to read a log.
"""

from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: Literal["development", "production"] = "development"

    supabase_url: str = Field(min_length=1)
    supabase_service_key: str = Field(min_length=1)  # sb_secret_... key; bypasses RLS
    supabase_jwks_url: str = Field(min_length=1)     # no default: auth cannot work without it
    gemini_api_key: str = Field(min_length=1)

    # gemini-2.5-* and 1.5-* are closed to new keys; override in .env if your
    # quota allows a stronger model (e.g. a -pro variant) for planning.
    gemini_model: str = "gemini-3.5-flash"                # agent loop
    gemini_plan_model: str = "gemini-3.5-flash"           # POST /api/events/plan
    gemini_feedback_model: str = "gemini-3.1-flash-lite"  # POST /api/feedback/submit
    gemini_embedding_model: str = "gemini-embedding-001"  # RAG
    embedding_dim: int = 768  # must match club_documents.embedding vector(768)

    # Ingestion CLI convenience only (python -m app.services.rag). No default:
    # a demo UUID baked into production config is how tenants get crossed.
    default_club_id: str | None = None

    # --- HTTP surface -------------------------------------------------------
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # Optional: Vercel preview deploys, e.g. r"^https://clubops-ai-[a-z0-9-]+\.vercel\.app$"
    cors_origin_regex: str = ""
    allowed_hosts: list[str] = ["*"]

    # "memory://" is per-process: counters reset on deploy and are not shared
    # between instances. More than one instance => point this at Redis.
    # Must be a SYNC storage URI (no "async+" prefix): see app/limits.py.
    rate_limit_storage_uri: str = "memory://"
    # Pre-auth flood ceiling, applied to every request before routing.
    rate_limit_global: str = "120/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",  # a typo'd SUPABASE_SERVICE_KEY_ must not be silently ignored
    )

    @field_validator("supabase_url")
    @classmethod
    def _https_no_trailing_slash(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("SUPABASE_URL must start with https://")
        return v.rstrip("/")

    @field_validator("supabase_service_key")
    @classmethod
    def _not_the_anon_key(cls, v: str) -> str:
        # Pasting the publishable key here makes every backend write fail
        # against RLS with a confusing 401 that looks like an auth bug.
        if v.startswith(("sb_publishable_", "eyJ")):
            raise ValueError(
                "SUPABASE_SERVICE_KEY looks like an anon/publishable key, not a secret key"
            )
        return v

    @model_validator(mode="after")
    def _jwks_belongs_to_project(self):
        if not self.supabase_jwks_url.startswith(self.supabase_url):
            raise ValueError(
                "SUPABASE_JWKS_URL does not belong to SUPABASE_URL's project "
                f"(expected it to start with {self.supabase_url})"
            )
        return self

    @model_validator(mode="after")
    def _production_is_not_localhost(self):
        if self.environment != "production":
            return self
        if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origins):
            raise ValueError("CORS_ORIGINS still contains localhost in production")
        if self.allowed_hosts == ["*"]:
            raise ValueError("ALLOWED_HOSTS must be set explicitly in production")
        return self


settings = Settings()
