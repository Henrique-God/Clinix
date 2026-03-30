from __future__ import annotations

from typing import Any, Literal, TypedDict

from langfuse import Langfuse
from langfuse.langchain import CallbackHandler as LangfuseCallbackHandler
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from ..auth import CurrentActor
from ..config import Settings
from ..models import ChatIntent
from .appointments_client import AppointmentsClient
from .chat_memory_store import ChatMemoryStore
from .rag_service import RagService

VALID_ACTIONS = {
    "consultations",
    "scheduling",
    "clinical_history",
    "document_ingestion",
    "general_response",
}


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
    conversation_id: str
    history: list[dict[str, Any]]
    summary: str
    plan: dict[str, Any]
    action_result: dict[str, Any]
    reply: str
    invoke_config: dict[str, Any]


class ChatbotService:
    def __init__(
        self,
        appointments_client: AppointmentsClient,
        rag_service: RagService,
        memory_store: ChatMemoryStore,
        settings: Settings,
    ):
        self._appointments_client = appointments_client
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

    def _build_graph(self):
        graph = StateGraph(ChatGraphState)
        graph.add_node("load_memory", self._load_memory_node)
        graph.add_node("plan_step", self._plan_node)
        graph.add_node("route_action", self._route_action_node)
        graph.add_node("consultations", self._consultations_node)
        graph.add_node("scheduling", self._scheduling_node)
        graph.add_node("clinical_history", self._clinical_history_node)
        graph.add_node("document_ingestion", self._document_ingestion_node)
        graph.add_node("general_response", self._general_response_node)
        graph.add_node("compose_reply", self._compose_reply_node)
        graph.add_node("save_memory", self._save_memory_node)

        graph.add_edge(START, "load_memory")
        graph.add_edge("load_memory", "plan_step")
        graph.add_edge("plan_step", "route_action")
        graph.add_conditional_edges(
            "route_action",
            self._route_action,
            {
                "consultations": "consultations",
                "scheduling": "scheduling",
                "clinical_history": "clinical_history",
                "document_ingestion": "document_ingestion",
                "general_response": "general_response",
            },
        )
        graph.add_edge("consultations", "compose_reply")
        graph.add_edge("scheduling", "compose_reply")
        graph.add_edge("clinical_history", "compose_reply")
        graph.add_edge("document_ingestion", "compose_reply")
        graph.add_edge("general_response", "compose_reply")
        graph.add_edge("compose_reply", "save_memory")
        graph.add_edge("save_memory", END)
        return graph.compile()

    def _build_planner_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    (
                        "Voce e o roteador do chatbot Clinix.\n"
                        "Retorne JSON com intent, action, parameters e response_hint.\n"
                        "Actions validas: consultations, scheduling, clinical_history, document_ingestion, general_response.\n"
                        "Use consultations para listar/consultar consultas existentes.\n"
                        "Use scheduling para agendar, cancelar, aceitar, rejeitar ou remarcar consulta.\n"
                        "No action scheduling, informe parameters.operation com um destes valores: "
                        "schedule, cancel, accept, reject, modify.\n"
                        "Use clinical_history para perguntas sobre exames, prescricoes e historico clinico. "
                        "Neste fluxo o sistema chamara RAG.\n"
                        "Use document_ingestion para pedidos de envio/leitura/ingestao de laudo, receita, imagem ou PDF.\n"
                        "{format_instructions}"
                    ),
                ),
                (
                    "human",
                    (
                        "Role: {role}\n"
                        "Patient context: {patient_id}\n"
                        "Summary: {summary}\n"
                        "Recent history:\n{history_text}\n\n"
                        "Message: {message}"
                    ),
                ),
            ]
        )
        return prompt | self._llm | self._planner_parser

    def _build_response_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    (
                        "Voce e o assistente Clinix.\n"
                        "Responda em portugues, de forma objetiva e amigavel.\n"
                        "Nao invente informacoes."
                    ),
                ),
                (
                    "human",
                    (
                        "Resumo da conversa: {summary}\n"
                        "Mensagem atual: {message}\n"
                        "Acao executada: {action}\n"
                        "Hint: {response_hint}\n"
                        "Resultado da acao: {action_result}"
                    ),
                ),
            ]
        )
        return prompt | self._llm | StrOutputParser()

    def _build_summary_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Resuma a conversa em ate 6 linhas mantendo o contexto essencial.",
                ),
                ("human", "Historico:\n{history_text}"),
            ]
        )
        return prompt | self._llm | StrOutputParser()

    async def _load_memory_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        conversation_id = self._memory_store.resolve_conversation_id(state.get("conversation_id"))
        patient_id = state.get("patient_id") or actor.user_id
        self._memory_store.ensure_conversation(
            conversation_id=conversation_id,
            user_id=actor.user_id,
            patient_id=patient_id,
        )
        history = self._memory_store.get_history(conversation_id, self._history_window)
        summary = self._memory_store.get_summary(conversation_id)
        return {
            "conversation_id": conversation_id,
            "patient_id": patient_id,
            "history": history,
            "summary": summary,
        }

    async def _plan_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        history_text = self._format_history(state.get("history", []))
        message = state["message"]
        try:
            raw_plan = await self._planner_chain.ainvoke(
                {
                    "role": actor.role,
                    "patient_id": state.get("patient_id", actor.user_id),
                    "summary": state.get("summary", ""),
                    "history_text": history_text,
                    "message": message,
                    "format_instructions": self._planner_parser.get_format_instructions(),
                },
                config=state.get("invoke_config"),
            )
            plan = OrchestrationPlan.model_validate(raw_plan)
        except Exception:
            plan = self._fallback_plan(message)

        plan.action = self._normalize_action(plan.action)
        if plan.action == "scheduling":
            plan.parameters["operation"] = self._normalize_operation(plan.parameters.get("operation"))
        if plan.action not in VALID_ACTIONS:
            plan = self._fallback_plan(message)
        return {"plan": plan.model_dump()}

    async def _route_action_node(self, state: ChatGraphState) -> ChatGraphState:
        return state

    def _route_action(self, state: ChatGraphState) -> str:
        action = str(state.get("plan", {}).get("action", "general_response"))
        if action not in VALID_ACTIONS:
            return "general_response"
        return action

    async def _consultations_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        if actor.role.lower() == "doctor":
            appointments = await self._appointments_client.get_doctor_appointments(actor.token)
        else:
            appointments = await self._appointments_client.get_patient_appointments(actor.token)
        return {"action_result": {"count": len(appointments), "appointments": appointments[:6]}}

    async def _scheduling_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        plan = state.get("plan", {})
        parameters = plan.get("parameters", {})
        operation = str(parameters.get("operation", "")).lower().strip()

        if operation == "cancel":
            appointment_id = parameters.get("appointment_id")
            if not appointment_id:
                return {"action_result": {"error": "Para cancelar, informe o appointment_id (GUID)."}}
            cancelled = await self._appointments_client.cancel_appointment(actor.token, str(appointment_id))
            return {"action_result": {"operation": "cancel", "appointment": cancelled}}

        if operation in {"accept", "reject"}:
            appointment_id = parameters.get("appointment_id")
            if not appointment_id:
                return {"action_result": {"error": "Para responder convite, informe o appointment_id (GUID)."}}
            accepted = operation == "accept"
            response = await self._appointments_client.respond_invitation(
                token=actor.token,
                appointment_id=str(appointment_id),
                accepted=accepted,
                note=str(parameters.get("note", "")) or None,
            )
            return {"action_result": {"operation": operation, "appointment": response}}

        if operation == "schedule":
            if actor.role.lower() != "doctor":
                return {"action_result": {"error": "Somente medicos podem criar convites de consulta."}}
            payload = self._build_invite_payload(parameters)
            if not payload:
                return {
                    "action_result": {
                        "error": (
                            "Para agendar, envie patient_id, start_time, end_time e invitation_expires_at."
                        )
                    }
                }
            appointment = await self._appointments_client.invite_appointment(actor.token, payload)
            return {"action_result": {"operation": "schedule", "appointment": appointment}}

        if operation == "modify":
            return {
                "action_result": {
                    "operation": "modify",
                    "status": "pending",
                    "message": (
                        "Remarcacao ainda nao esta automatizada de ponta a ponta. "
                        "Use o fluxo: cancelar consulta atual e criar novo agendamento."
                    ),
                }
            }

        return {
            "action_result": {
                "error": (
                    "Nao consegui identificar a operacao de agendamento. "
                    "Informe se deseja schedule, cancel, accept, reject ou modify."
                )
            }
        }

    async def _clinical_history_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        patient_id = str(state.get("patient_id") or actor.user_id)
        rag = await self._rag_service.ask(
            token=actor.token,
            patient_id=patient_id,
            query=state["message"],
        )
        return {"action_result": {"rag": rag, "patient_id": patient_id}}

    async def _document_ingestion_node(self, state: ChatGraphState) -> ChatGraphState:
        return {
            "action_result": {
                "flow": "document_ingestion",
                "message": (
                    "Para ingestao documental, envie o arquivo em POST /documents/ingest "
                    "com multipart/form-data: file + patient_id (+ appointment_id opcional)."
                ),
            }
        }

    async def _general_response_node(self, state: ChatGraphState) -> ChatGraphState:
        return {"action_result": {"status": "general"}}

    async def _compose_reply_node(self, state: ChatGraphState) -> ChatGraphState:
        plan = state.get("plan", {})
        action = str(plan.get("action", "general_response"))
        action_result = state.get("action_result", {})

        if "error" in action_result:
            return {"reply": str(action_result["error"])}

        if action == "clinical_history":
            rag_data = action_result.get("rag", {})
            answer = str(rag_data.get("answer", "")).strip()
            if answer:
                return {"reply": answer}
            return {"reply": "Nao encontrei dados suficientes no historico clinico."}

        if action == "document_ingestion":
            return {"reply": str(action_result.get("message", "Use /documents/ingest para enviar documentos."))}

        try:
            reply = await self._response_chain.ainvoke(
                {
                    "summary": state.get("summary", ""),
                    "message": state["message"],
                    "action": action,
                    "response_hint": plan.get("response_hint", ""),
                    "action_result": str(action_result),
                },
                config=state.get("invoke_config"),
            )
            return {"reply": reply}
        except Exception:
            return {"reply": "Nao consegui responder agora. Tente novamente em instantes."}

    async def _save_memory_node(self, state: ChatGraphState) -> ChatGraphState:
        conversation_id = state["conversation_id"]
        self._memory_store.append_message(conversation_id, "user", state["message"])
        self._memory_store.append_message(conversation_id, "assistant", state.get("reply", ""))

        history = self._memory_store.get_history(conversation_id, self._history_window)
        if len(history) >= self._history_window:
            history_text = self._format_history(history)
            try:
                summary = await self._summary_chain.ainvoke(
                    {"history_text": history_text},
                    config=state.get("invoke_config"),
                )
                self._memory_store.update_summary(conversation_id, summary)
            except Exception:
                pass
        return state

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
    def _normalize_action(action: str) -> str:
        value = str(action or "").lower().strip()
        if value in VALID_ACTIONS:
            return value

        aliases = {
            "consulta": "consultations",
            "consultas": "consultations",
            "appointments": "consultations",
            "appointment_query": "consultations",
            "agendamento": "scheduling",
            "agendamentos": "scheduling",
            "scheduling_ops": "scheduling",
            "historico": "clinical_history",
            "historico_clinico": "clinical_history",
            "clinical": "clinical_history",
            "rag": "clinical_history",
            "documento": "document_ingestion",
            "documentos": "document_ingestion",
            "ocr": "document_ingestion",
            "geral": "general_response",
            "general": "general_response",
        }
        return aliases.get(value, "general_response")

    @staticmethod
    def _normalize_operation(operation: Any) -> str:
        value = str(operation or "").lower().strip()
        aliases = {
            "agendar": "schedule",
            "marcar": "schedule",
            "novo": "schedule",
            "cancelar": "cancel",
            "desmarcar": "cancel",
            "aceitar": "accept",
            "confirmar": "accept",
            "rejeitar": "reject",
            "recusar": "reject",
            "remarcar": "modify",
            "reagendar": "modify",
            "editar": "modify",
        }
        return aliases.get(value, value)

    @classmethod
    def _fallback_plan(cls, message: str) -> OrchestrationPlan:
        lowered = (message or "").lower()

        if any(token in lowered for token in ["laudo", "receita", "pdf", "imagem", "documento", "anexo", "ocr"]):
            return OrchestrationPlan(
                intent="document_ingestion",
                action="document_ingestion",
                response_hint="Explique como enviar arquivo pelo endpoint de ingestao.",
            )

        if any(token in lowered for token in ["historico", "prontuario", "exame", "prescricao", "evolucao"]):
            return OrchestrationPlan(
                intent="clinical_history",
                action="clinical_history",
                response_hint="Responder com base no historico clinico e RAG.",
            )

        if any(token in lowered for token in ["cancelar", "desmarcar"]):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "cancel"},
                response_hint="Pedir appointment_id caso nao tenha sido informado.",
            )

        if any(token in lowered for token in ["aceitar", "confirmar convite"]):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "accept"},
            )

        if any(token in lowered for token in ["rejeitar", "recusar convite"]):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "reject"},
            )

        if any(token in lowered for token in ["remarcar", "reagendar", "alterar horario"]):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "modify"},
            )

        if any(token in lowered for token in ["agendar", "marcar consulta", "nova consulta", "criar consulta"]):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "schedule"},
            )

        if any(token in lowered for token in ["consulta", "consultas", "agenda", "horario"]):
            return OrchestrationPlan(
                intent="consultations",
                action="consultations",
                response_hint="Listar consultas existentes.",
            )

        return OrchestrationPlan(
            intent="general",
            action="general_response",
        )

    @staticmethod
    def _build_invite_payload(parameters: dict[str, Any]) -> dict[str, Any] | None:
        required_fields = ["patient_id", "start_time", "end_time", "invitation_expires_at"]
        if not all(parameters.get(field) for field in required_fields):
            return None
        return {
            "patientId": parameters["patient_id"],
            "startTime": parameters["start_time"],
            "endTime": parameters["end_time"],
            "invitationExpiresAt": parameters["invitation_expires_at"],
            "title": parameters.get("title", "Consulta marcada via chatbot"),
            "description": parameters.get("description"),
            "location": parameters.get("location"),
            "invitationMessage": parameters.get("invitation_message"),
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
            if operation == "modify":
                return ChatIntent.MODIFY_APPOINTMENT
            return ChatIntent.GENERAL
        if action == "clinical_history":
            return ChatIntent.CLINICAL_EVOLUTION
        return ChatIntent.GENERAL
