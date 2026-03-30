from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ChatIntent(str, Enum):
    CHECK_APPOINTMENTS = "check_appointments"
    SCHEDULE_APPOINTMENT = "schedule_appointment"
    MODIFY_APPOINTMENT = "modify_appointment"
    DELETE_APPOINTMENT = "delete_appointment"
    CLINICAL_EVOLUTION = "clinical_evolution"
    RAG_QUESTION = "rag_question"
    GENERAL = "general"


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    patient_id: str | None = None
    conversation_id: str | None = None
    conversation_context: str | None = None


class ChatMessageResponse(BaseModel):
    reply: str
    intent: ChatIntent
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class RagQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    patient_id: str = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=15)


class RagQueryResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]] = Field(default_factory=list)
    timestamp: datetime


class DocumentIngestResponse(BaseModel):
    ingestion_id: str
    status: str
    message: str


class IngestionStatusResponse(BaseModel):
    ingestion_id: str
    status: str
    detail: str | None = None
    result: dict[str, Any] | None = None
