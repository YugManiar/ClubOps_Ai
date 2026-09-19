from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"
    # Must output 768 dims to match vector(768) in supabase/schema.sql.
    gemini_embedding_model: str = "models/gemini-embedding-001"
    embedding_dim: int = 768

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
