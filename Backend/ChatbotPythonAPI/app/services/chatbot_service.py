from __future__ import annotations

from typing import Any

from langfuse import Langfuse
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI

from ..auth import CurrentActor
from ..config import Settings
from ..models import ChatIntent
from .appointments_client import AppointmentsClient
from .chat_memory_store import ChatMemoryStore
from .rag_service import RagService
from .users_client import UsersClient
from .chatbot.definitions import ChatGraphState, OrchestrationPlan
from .chatbot.modules.action_nodes_module import ChatbotActionNodesMixin
from .chatbot.modules.chains_module import ChatbotChainsMixin
from .chatbot.modules.graph_module import ChatbotGraphMixin
from .chatbot.modules.helpers_module import ChatbotHelpersMixin
from .chatbot.modules.planning_module import ChatbotPlanningMixin
from .chatbot.modules.scheduling_module import ChatbotSchedulingMixin


class ChatbotService(
    ChatbotGraphMixin,
    ChatbotChainsMixin,
    ChatbotActionNodesMixin,
    ChatbotPlanningMixin,
    ChatbotSchedulingMixin,
    ChatbotHelpersMixin,
):
    def __init__(
        self,
        appointments_client: AppointmentsClient,
        users_client: UsersClient,
        rag_service: RagService,
        memory_store: ChatMemoryStore,
        settings: Settings,
    ):
        self._appointments_client = appointments_client
        self._users_client = users_client
        self._rag_service = rag_service
        self._memory_store = memory_store
        self._history_window = settings.chat_memory_window_messages
        self._langfuse_client: Langfuse | None = None
        self._langfuse_public_key: str | None = None
        self._llm = ChatOpenAI(
            model=settings.openai_text_model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=settings.openai_request_timeout_seconds,
            temperature=0,
        )
        if (
            settings.langfuse_enabled
            and settings.langfuse_tracing_enabled
            and settings.langfuse_public_key
            and settings.langfuse_secret_key
        ):
            self._langfuse_client = Langfuse(
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
                base_url=settings.langfuse_base_url,
                environment=settings.langfuse_tracing_environment,
                tracing_enabled=settings.langfuse_tracing_enabled,
            )
            self._langfuse_public_key = settings.langfuse_public_key
        self._planner_parser = JsonOutputParser(pydantic_object=OrchestrationPlan)
        self._planner_chain = self._build_planner_chain()
        self._response_chain = self._build_response_chain()
        self._summary_chain = self._build_summary_chain()
        self._graph = self._build_graph()

    async def handle_message(
        self,
        actor: CurrentActor,
        message: str,
        patient_id: str | None = None,
        conversation_id: str | None = None,
        patient_insurance_plan: str | None = None,
    ) -> tuple[ChatIntent, str, dict[str, Any]]:
        invoke_config = self._build_invoke_config(
            actor=actor,
            patient_id=patient_id,
            conversation_id=conversation_id,
        )
        initial_state: ChatGraphState = {
            "actor": actor,
            "message": message,
            "patient_id": patient_id,
            "patient_insurance_plan": patient_insurance_plan,
            "conversation_id": conversation_id or "",
            "invoke_config": invoke_config,
        }
        try:
            final_state = await self._graph.ainvoke(initial_state, config=invoke_config)
            plan = final_state.get("plan", {})
            intent = self._resolve_intent(plan)
            reply = final_state.get("reply", "Nao consegui responder agora. Tente novamente.")
            metadata = {
                "conversation_id": final_state.get("conversation_id"),
                "action": plan.get("action", "general_response"),
                "parameters": plan.get("parameters", {}),
                "result": final_state.get("action_result", {}),
            }
            return intent, reply, metadata
        finally:
            if self._langfuse_client is not None:
                self._langfuse_client.flush()


__all__ = ["ChatbotService"]

