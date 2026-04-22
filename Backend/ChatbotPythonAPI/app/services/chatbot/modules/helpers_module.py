from __future__ import annotations

from typing import Any

from langfuse.langchain import CallbackHandler as LangfuseCallbackHandler

from ....auth import CurrentActor
from ....models import ChatIntent


class ChatbotHelpersMixin:
    def _build_invoke_config(
        self,
        actor: CurrentActor,
        patient_id: str | None,
        conversation_id: str | None,
    ) -> dict[str, Any]:
        if self._langfuse_client is None or not self._langfuse_public_key:
            return {}

        return {
            "run_name": "chatbot.message",
            "tags": ["clinix", "chatbot"],
            "metadata": {
                "actor_role": actor.role,
                "actor_user_id": actor.user_id,
                "patient_id": patient_id,
                "conversation_id": conversation_id,
            },
            "callbacks": [LangfuseCallbackHandler(public_key=self._langfuse_public_key)],
        }

    @staticmethod
    def _format_history(history: list[dict[str, Any]]) -> str:
        if not history:
            return "- (sem historico)"
        
        lines = []

        for item in history:
            sender = item.get("sender", "unknown")
            content = item.get("content", "")
            lines.append(f"{sender}: {content}")

        return "\n".join(lines)

    @staticmethod
    def _resolve_intent(plan: dict[str, Any]) -> ChatIntent:
        action = str(plan.get("action", "general_response"))
        parameters = plan.get("parameters", {})
        operation = str(parameters.get("operation", "")).lower()

        if action == "consultations":
            return ChatIntent.CHECK_APPOINTMENTS
        if action == "scheduling":
            if operation == "schedule":
                return ChatIntent.SCHEDULE_APPOINTMENT
            if operation == "cancel":
                return ChatIntent.DELETE_APPOINTMENT
            return ChatIntent.GENERAL
        if action == "clinical_history":
            return ChatIntent.CLINICAL_EVOLUTION
        
        return ChatIntent.GENERAL

    @staticmethod
    def _first_param(parameters: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = parameters.get(key)
            if value is not None and str(value).strip():
                return value
        return None

    @staticmethod
    def _is_doctor_role(role: str) -> bool:
        return str(role or "").lower().strip() == "doctor"

    @staticmethod
    def _is_patient_role(role: str) -> bool:
        return str(role or "").lower().strip() in {"user", "patient"}


