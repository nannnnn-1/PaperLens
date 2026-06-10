"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pydantic settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_QUEUE_NAME: str = "parse:queue"
    REDIS_JOB_KEY_PREFIX: str = "parse:job"

    # Nest.js callback
    NEST_API_URL: str = "http://localhost:3000"
    NEST_CALLBACK_PATH: str = "/api/v1/parse/callback"

    # OpenAI-compatible LLM (chat / translation / extraction)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # OpenAI-compatible Embedding (can be different provider)
    OPENAI_EMBEDDING_API_KEY: str = ""
    OPENAI_EMBEDDING_BASE_URL: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Timeouts
    LLM_TIMEOUT: int = 60
    LLM_MAX_RETRIES: int = 3
    PDF_DOWNLOAD_TIMEOUT: int = 120

    # Worker
    WORKER_ENABLED: bool = True
    WORKER_CONCURRENCY: int = 2
    WORKER_BRPOP_TIMEOUT: int = 5

    # Parsing
    MAX_PDF_PAGES: int = 100
    MAX_PDF_SIZE_MB: int = 50


settings = Settings()
