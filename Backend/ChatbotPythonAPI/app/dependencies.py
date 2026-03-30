from functools import lru_cache

from .config import Settings, get_settings
from .services.appointments_client import AppointmentsClient
from .services.chatbot_service import ChatbotService
from .services.chat_memory_store import ChatMemoryStore
from .services.document_processor import DocumentProcessor
from .services.ingestion_store import IngestionStore
from .services.openai_client import OpenAIClient
from .services.rag_service import RagService
from .services.users_client import UsersClient


@lru_cache
def get_openai_client() -> OpenAIClient:
    settings: Settings = get_settings()
    return OpenAIClient(settings)


@lru_cache
def get_users_client() -> UsersClient:
    settings: Settings = get_settings()
    return UsersClient(settings)


@lru_cache
def get_appointments_client() -> AppointmentsClient:
    settings: Settings = get_settings()
    return AppointmentsClient(settings)


@lru_cache
def get_rag_service() -> RagService:
    settings: Settings = get_settings()
    return RagService(
        settings=settings,
        users_client=get_users_client(),
        openai_client=get_openai_client(),
    )


@lru_cache
def get_chatbot_service() -> ChatbotService:
    settings: Settings = get_settings()
    return ChatbotService(
        appointments_client=get_appointments_client(),
        rag_service=get_rag_service(),
        memory_store=get_chat_memory_store(),
        settings=settings,
    )


@lru_cache
def get_document_processor() -> DocumentProcessor:
    return DocumentProcessor(
        users_client=get_users_client(),
        rag_service=get_rag_service(),
        openai_client=get_openai_client(),
    )


@lru_cache
def get_ingestion_store() -> IngestionStore:
    return IngestionStore()


@lru_cache
def get_chat_memory_store() -> ChatMemoryStore:
    settings: Settings = get_settings()
    return ChatMemoryStore(
        postgres_dsn=settings.chat_memory_postgres_dsn,
        history_window=settings.chat_memory_window_messages,
        schema=settings.chat_memory_schema,
    )
