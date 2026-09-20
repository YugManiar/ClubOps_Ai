from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str  # sb_secret_... key; bypasses RLS
    supabase_jwks_url: str = ""
    gemini_api_key: str

    # gemini-2.5-* and 1.5-* are closed to new keys; override in .env if your
    # quota allows a stronger model (e.g. a -pro variant) for planning.
    gemini_model: str = "gemini-3.5-flash"          # agent loop
    gemini_plan_model: str = "gemini-3.5-flash"      # POST /api/events/plan
    gemini_feedback_model: str = "gemini-3.1-flash-lite"  # POST /api/feedback/submit
    gemini_embedding_model: str = "gemini-embedding-001"  # RAG
    embedding_dim: int = 768  # must match club_documents.embedding vector(768)

    # Seeded demo club (supabase/seed.sql); default target for RAG ingestion.
    default_club_id: str = "11111111-1111-1111-1111-111111111111"

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
