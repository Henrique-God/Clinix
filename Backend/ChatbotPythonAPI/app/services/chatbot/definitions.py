from __future__ import annotations

from typing import Any, Literal, TypedDict

from pydantic import BaseModel, Field

from ...auth import CurrentActor

VALID_ACTIONS = {
    "consultations",
    "scheduling",
    "clinical_history",
    "document_ingestion",
    "general_response",
}

PT_WEEKDAYS = [
    "segunda-feira",
    "terca-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sabado",
    "domingo",
]


class OrchestrationPlan(BaseModel):
    intent: str = Field(default="general")
    action: Literal[
        "consultations",
        "scheduling",
        "clinical_history",
        "document_ingestion",
        "general_response",
    ] = "general_response"
    parameters: dict[str, Any] = Field(default_factory=dict)
    response_hint: str = Field(default="")


class ChatGraphState(TypedDict, total=False):
    actor: CurrentActor
    message: str
    patient_id: str | None
    patient_insurance_plan: str | None
    conversation_id: str
    history: list[dict[str, Any]]
    summary: str
    plan: dict[str, Any]
    scheduling_context: dict[str, Any]
    action_result: dict[str, Any]
    reply: str
    invoke_config: dict[str, Any]
