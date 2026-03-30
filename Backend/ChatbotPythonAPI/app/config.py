from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _discover_env_files() -> tuple[str, ...]:
    env_files: list[str] = []
    seen: set[str] = set()

    # Search upward from this file so local runs can pick up the repository
    # root `.env` even when uvicorn is started inside Backend/ChatbotPythonAPI.
    for directory in Path(__file__).resolve().parents:
        candidate = directory / ".env"
        if not candidate.is_file():
            continue

        normalized = str(candidate)
        if normalized in seen:
            continue

        env_files.append(normalized)
        seen.add(normalized)

    return tuple(env_files)


ENV_FILES = _discover_env_files()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, env_file=ENV_FILES, extra="ignore")

    app_name: str = "Clinix Chatbot Python API"
    app_env: str = "development"

    jwt_key: str = Field(default="NVTP+fg8XYlZMdUX9og01pJO2lCjddNKs7RYEZYf/PoZm56hG9kk66LOmQoIRGNX/DJHeIQ5zJ2oLQqpLF4jpw==")
    jwt_issuer: str = Field(default="Clinix")
    jwt_audience: str = Field(default="Clinix")
    jwt_allowed_algorithms: str = Field(default="HS512,HS384,HS256")

    appointments_api_base_url: str = Field(default="http://appointments-api:8080")
    users_api_base_url: str = Field(default="http://users-api:8080")

    openai_api_key: str = Field(default="")
    openai_base_url: str = Field(default="https://api.openai.com/v1")
    openai_text_model: str = Field(default="gpt-4o-mini")
    openai_vision_model: str = Field(default="gpt-4o")
    openai_request_timeout_seconds: int = Field(default=120)
    langfuse_enabled: bool = Field(default=True)
    langfuse_public_key: str = Field(default="")
    langfuse_secret_key: str = Field(default="")
    langfuse_base_url: str = Field(default="https://cloud.langfuse.com")
    langfuse_tracing_environment: str = Field(default="development")
    langfuse_tracing_enabled: bool = Field(default=True)

    chroma_persist_path: str = Field(default="/data/chroma")
    chroma_collection_name: str = Field(default="clinical_documents")
    embedding_model_name: str = Field(default="intfloat/multilingual-e5-base")
    rag_top_k: int = Field(default=4)
    rag_chunk_size: int = Field(default=1000)
    rag_chunk_overlap: int = Field(default=180)

    chat_memory_postgres_dsn: str = Field(
        default="",
        validation_alias=AliasChoices("CHAT_MEMORY_POSTGRES_DSN", "DB_CONNECTION"),
    )
    chat_memory_schema: str = Field(default="chatbot")
    chat_memory_window_messages: int = Field(default=12)


@lru_cache
def get_settings() -> Settings:
    return Settings()
