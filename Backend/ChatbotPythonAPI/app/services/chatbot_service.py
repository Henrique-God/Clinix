from __future__ import annotations

import asyncio
import re
import unicodedata
from datetime import datetime, timedelta, timezone
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
from .appointment_matching import count_cancelable_appointments, resolve_cancel_target
from .appointments_client import AppointmentsClient
from .chat_memory_store import ChatMemoryStore
from .rag_service import RagService
from .users_client import UsersClient

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
    conversation_id: str
    history: list[dict[str, Any]]
    summary: str
    plan: dict[str, Any]
    scheduling_context: dict[str, Any]
    action_result: dict[str, Any]
    reply: str
    invoke_config: dict[str, Any]


class ChatbotService:
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
        graph.add_node("scheduling_prepare", self._scheduling_prepare_node)
        graph.add_node("scheduling_ask_specialty", self._scheduling_ask_specialty_node)
        graph.add_node("scheduling_show_options", self._scheduling_show_options_node)
        graph.add_node("scheduling_create", self._scheduling_create_node)
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
                "scheduling": "scheduling_prepare",
                "clinical_history": "clinical_history",
                "document_ingestion": "document_ingestion",
                "general_response": "general_response",
            },
        )
        graph.add_edge("consultations", "compose_reply")
        graph.add_conditional_edges(
            "scheduling_prepare",
            self._route_scheduling_step,
            {
                "ask_specialty": "scheduling_ask_specialty",
                "show_options": "scheduling_show_options",
                "create": "scheduling_create",
                "compose_reply": "compose_reply",
            },
        )
        graph.add_edge("scheduling_ask_specialty", "compose_reply")
        graph.add_conditional_edges(
            "scheduling_show_options",
            self._route_scheduling_step,
            {
                "create": "scheduling_create",
                "compose_reply": "compose_reply",
            },
        )
        graph.add_edge("scheduling_create", "compose_reply")
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
                        "schedule, cancel, accept, reject.\n"
                        "Para scheduling com operation=schedule quando Role for User: "
                        "primeiro ofereca opcoes de medicos e horarios proximos disponiveis. "
                        "Nao peca nomes de variaveis tecnicas.\n"
                        "Para scheduling com operation=schedule quando Role for Doctor: "
                        "extraia patient_id ou patient_name e start_time quando existirem. "
                        "Se faltar horario, o chatbot vai perguntar depois.\n"
                        "Quando Role for Doctor e o usuario perguntar pelos horarios disponiveis, "
                        "use scheduling com operation=schedule e ask_availability=true.\n"
                        "Se o usuario escolher uma opcao numerada, use parameters.option_index.\n"
                        "Se o usuario informar medico + horario de inicio diretamente, use doctor_id/doctor_name e start_time.\n"
                        "Nao solicite horario de termino para o paciente.\n"
                        "Se o usuario pedir para editar/remarcar consulta, oriente a cancelar a atual e criar um novo agendamento.\n"
                        "Use clinical_history para perguntas sobre exames, prescricoes e historico clinico. "
                        "Neste fluxo o sistema chamara RAG.\n"
                        "Use document_ingestion para pedidos de envio/leitura/ingestao de laudo, receita, imagem ou PDF.\n"
                        "Quando o usuario perguntar por especialidades disponiveis, use scheduling com operation=schedule.\n"
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
                        "Você é o assistente virtual da Clinix, uma plataforma digital inovadora de gestão de saúde e atividades físicas! "
                        "Sua missão é facilitar a vida dos pacientes, integrando informações clínicas e acompanhamentos de forma ágil, acolhedora e segura.\n\n"
                        
                        "SUAS CAPACIDADES:\n"
                        "1. Consultas: Você pode agendar, verificar, editar e cancelar compromissos médicos.\n"
                        "2. Histórico Clínico: Você pode buscar informações precisas em prontuários e exames anteriores do paciente.\n"
                        "3. Leitura de Documentos: Você é especialista em extrair dados de laudos e receitas médicas.\n\n"

                        "REGRAS DE INTERFACE (UX):\n"
                        "Se o paciente quiser enviar um documento, laudo ou receita, oriente-o de forma amigável a clicar no ícone de clipe de papel (ou botão de anexo) localizado perto do campo de digitação.\n\n"
                        
                        "SEU TOM E COMPORTAMENTO:\n"
                        "- Seja sempre entusiasta, caloroso e muito educado! Demonstre que você está genuinamente feliz em ajudar a cuidar da saúde do paciente.\n"
                        "- Seja altamente proativo: nunca deixe a conversa em um 'beco sem saída'. Se o paciente cancelar uma consulta, ofereça opções para reagendar. Se ele perguntar sobre um exame, pergunte se ele precisa de ajuda para marcar um retorno com o médico.\n"
                        "- Seja objetivo nas respostas, sem textos gigantes, para facilitar a leitura no celular ou computador.\n\n"
                        
                        "REGRAS DE SEGURANÇA E ÉTICA (CRÍTICO):\n"
                        "- NUNCA invente ou presuma informações (sem alucinações). Baseie-se APENAS nos dados retornados pelas ferramentas, APIs e histórico do paciente.\n"
                        "- Você NÃO é médico. Nunca forneça diagnósticos, não recomende novos medicamentos e não altere dosagens. Limite-se a ler o que está prescrito.\n"
                        "- Proteja a privacidade: NUNCA exiba IDs internos do banco de dados (como UUIDs), senhas, tokens ou dados sensíveis de outros pacientes."
                    )
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
        if self._is_doctor_role(actor.role) and self._contains_doctor_availability_intent(message):
            plan.action = "scheduling"
            plan.parameters["operation"] = "schedule"
            plan.parameters["ask_availability"] = True
        elif self._is_patient_role(actor.role) and self._is_specialty_catalog_request(message):
            plan.action = "scheduling"
            plan.parameters["operation"] = "schedule"
            plan.parameters["list_specialties"] = True
        elif plan.action == "scheduling":
            plan.parameters["operation"] = self._normalize_operation(plan.parameters.get("operation"))
            if plan.parameters["operation"] not in {"schedule", "cancel", "accept", "reject", "modify"}:
                option_index = self._extract_option_index(plan.parameters, message)
                if option_index is not None:
                    plan.parameters["operation"] = "schedule"
                    plan.parameters["option_index"] = option_index
                elif self._contains_schedule_intent(message):
                    plan.parameters["operation"] = "schedule"
        elif self._is_patient_role(actor.role) and self._was_waiting_for_specialty(state.get("history", [])):
            specialty_hint = self._extract_specialty_hint(message)
            if specialty_hint:
                plan.action = "scheduling"
                plan.parameters["operation"] = "schedule"
                plan.parameters["specialty"] = specialty_hint
        elif self._is_doctor_role(actor.role) and self._was_waiting_for_doctor_scheduling_details(state.get("history", [])):
            plan.action = "scheduling"
            plan.parameters["operation"] = "schedule"
        else:
            option_index = self._extract_option_index({}, message)
            if option_index is not None:
                plan.action = "scheduling"
                plan.parameters["operation"] = "schedule"
                plan.parameters["option_index"] = option_index
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

    def _route_scheduling_step(self, state: ChatGraphState) -> str:
        context = state.get("scheduling_context", {})
        step = str(context.get("next_step", "compose_reply"))
        if step not in {"ask_specialty", "show_options", "create", "compose_reply"}:
            return "compose_reply"
        return step

    async def _consultations_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]

        if self._is_doctor_role(actor.role):
            appointments = await self._appointments_client.get_doctor_appointments(actor.token)
        elif self._is_patient_role(actor.role):
            appointments = await self._appointments_client.get_patient_appointments(actor.token)
        else:
            return {"action_result": {"error": "Somente medicos e pacientes podem consultar agenda."}}

        return {"action_result": {"count": len(appointments), "appointments": appointments[:6]}}

    async def _scheduling_prepare_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        plan = state.get("plan", {})
        parameters = plan.get("parameters", {})
        message = state.get("message", "")
        history = state.get("history", [])
        operation = self._normalize_operation(parameters.get("operation"))
        if operation not in {"schedule", "cancel", "accept", "reject", "modify"}:
            option_index = self._extract_option_index(parameters, message)
            if option_index is not None:
                operation = "schedule"
                parameters["option_index"] = option_index
            elif self._contains_schedule_intent(message):
                operation = "schedule"

        if operation == "cancel":
            appointment_id = parameters.get("appointment_id")
            if not appointment_id:
                appointments = (
                    await self._appointments_client.get_doctor_appointments(actor.token)
                    if actor.role.lower() == "doctor"
                    else await self._appointments_client.get_patient_appointments(actor.token)
                )
                matched_appointment = resolve_cancel_target(appointments, state["message"])

                if matched_appointment is None:
                    cancellable_count = count_cancelable_appointments(appointments)
                    if cancellable_count == 0:
                        return {
                            "action_result": {
                                "error": "Não encontrei consultas futuras que possam ser canceladas neste momento."
                            }
                        }

                    return {
                        "action_result": {
                            "error": (
                                "Encontrei mais de uma consulta que pode ser cancelada. "
                                "Me diga o nome da consulta ou a data e o horário desejados."
                            )
                        }
                    }

                appointment_id = matched_appointment.get("id")

            try:
                cancelled = await self._appointments_client.cancel_appointment(actor.token, str(appointment_id))
            except Exception as exc:
                return {
                    "action_result": {"error": self._format_service_error("Nao consegui cancelar a consulta.", exc)},
                    "scheduling_context": {"next_step": "compose_reply"},
                }
            return {
                "action_result": {"operation": "cancel", "appointment": cancelled},
                "scheduling_context": {"next_step": "compose_reply"},
            }

        if operation in {"accept", "reject"}:
            appointment_id = parameters.get("appointment_id")
            if not appointment_id:
                return {
                    "action_result": {"error": "Para responder ao convite, me diga qual consulta voce quer confirmar ou recusar."},
                    "scheduling_context": {"next_step": "compose_reply"},
                }

            accepted = operation == "accept"
            try:
                response = await self._appointments_client.respond_invitation(
                    token=actor.token,
                    appointment_id=str(appointment_id),
                    accepted=accepted,
                    note=str(parameters.get("note", "")) or None,
                )
            except Exception as exc:
                return {
                    "action_result": {"error": self._format_service_error("Nao consegui responder ao convite.", exc)},
                    "scheduling_context": {"next_step": "compose_reply"},
                }
            return {
                "action_result": {
                    "operation": operation,
                    "appointment": response,
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        if operation == "modify":
            return {
                "action_result": {
                    "operation": "modify",
                    "message": (
                        "Para alterar uma consulta, voce precisa cancelar a consulta atual "
                        "e depois marcar uma nova. Se quiser, eu te ajudo com isso agora."
                    ),
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        if operation != "schedule":
            return {
                "action_result": {
                    "error": (
                        "Nao consegui identificar a operacao de agendamento. "
                        "Me diga se voce quer agendar, cancelar, aceitar ou recusar convite."
                    )
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        if self._is_patient_role(actor.role):
            context = self._build_patient_scheduling_context(actor, parameters, message, history)
            if bool(context.get("list_specialties")):
                context["next_step"] = "ask_specialty"
                return {"scheduling_context": context}

            if context.get("direct_payload") is not None or context.get("selected_from_history") is not None:
                context["next_step"] = "create"
                return {"scheduling_context": context}

            if not context.get("specialty") and not context.get("doctor_name") and not context.get("option_index"):
                context["next_step"] = "ask_specialty"
                return {"scheduling_context": context}

            if context.get("specialty") and not context.get("doctor_name") and not context.get("option_index"):
                available_specialties = await self._list_available_specialties(actor.token)
                matched_specialty = self._match_specialty_from_catalog(str(context["specialty"]), available_specialties)
                if matched_specialty is None:
                    return {
                        "action_result": {
                            "operation": "schedule",
                            "status": "needs_specialty",
                            "message": self._format_unknown_specialty_message(str(context["specialty"]), available_specialties),
                        },
                        "scheduling_context": {"next_step": "compose_reply"},
                    }
                context["specialty"] = matched_specialty

            context["next_step"] = "show_options"
            return {"scheduling_context": context}

        if self._is_doctor_role(actor.role):
            doctor_context = await self._build_doctor_scheduling_context(
                actor=actor,
                parameters=parameters,
                message=message,
                history=history,
            )
            if doctor_context.get("next_step") != "create":
                return {
                    "action_result": {
                        "operation": "schedule",
                        "status": doctor_context.get("status", "needs_input"),
                        "message": doctor_context.get(
                            "message",
                            "Para agendar, me informe o paciente e o horario da consulta.",
                        ),
                    },
                    "scheduling_context": {"next_step": "compose_reply"},
                }

            return {"scheduling_context": doctor_context}

        return {
            "action_result": {"error": "Somente medicos e pacientes podem criar convites de consulta."},
            "scheduling_context": {"next_step": "compose_reply"},
        }

    async def _scheduling_ask_specialty_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        context = state.get("scheduling_context", {})
        if bool(context.get("list_specialties")):
            specialties = await self._list_available_specialties(actor.token)
            return {
                "action_result": {
                    "operation": "schedule",
                    "status": "specialties_listed",
                    "message": self._format_specialties_message(specialties),
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        return {
            "action_result": {
                "operation": "schedule",
                "status": "needs_specialty",
                "message": "Claro. Antes de te mostrar os horarios disponiveis, qual especialidade voce procura?",
            },
            "scheduling_context": {"next_step": "compose_reply"},
        }

    async def _scheduling_show_options_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        context = dict(state.get("scheduling_context", {}))
        parameters = context.get("parameters", {})
        message = str(context.get("message", ""))

        lookup_parameters = dict(parameters)
        if context.get("specialty"):
            lookup_parameters["specialty"] = context["specialty"]
        if context.get("doctor_name"):
            lookup_parameters["doctor_name"] = context["doctor_name"]

        options = await self._build_patient_schedule_options(
            token=actor.token,
            parameters=lookup_parameters,
            message=message,
        )
        if not options:
            return {
                "action_result": {
                    "operation": "schedule",
                    "status": "unavailable",
                    "message": (
                        "No momento nao encontrei horarios para essa escolha especifica. "
                        "Se quiser, eu te mostro novas opcoes de horarios mais proximos."
                    ),
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        option_index = context.get("option_index")
        if option_index:
            selected = next((item for item in options if item["option_index"] == int(option_index)), None)
            if selected is None:
                return {
                    "action_result": {
                        "operation": "schedule",
                        "status": "needs_selection",
                        "message": self._format_schedule_options_message(options, invalid_option=int(option_index)),
                    },
                    "scheduling_context": {"next_step": "compose_reply"},
                }

            context["selected_option"] = selected
            context["next_step"] = "create"
            return {"scheduling_context": context}

        return {
            "action_result": {
                "operation": "schedule",
                "status": "needs_selection",
                "message": self._format_schedule_options_message(options),
            },
            "scheduling_context": {"next_step": "compose_reply"},
        }

    async def _scheduling_create_node(self, state: ChatGraphState) -> ChatGraphState:
        actor = state["actor"]
        context = state.get("scheduling_context", {})
        payload = context.get("payload")
        parameters = context.get("parameters", {})

        if payload is None and context.get("selected_from_history") is not None:
            payload = await self._build_patient_invite_payload_from_history_option(
                actor=actor,
                option=context["selected_from_history"],
                duration_minutes=int(context.get("duration_minutes", 30)),
                parameters=parameters,
            )
            if payload is None:
                return {
                    "action_result": {
                        "operation": "schedule",
                        "status": "slot_unavailable",
                        "message": (
                            "Esse horario acabou de ficar indisponivel. "
                            "Posso te mostrar os horarios mais proximos atualizados."
                        ),
                    },
                    "scheduling_context": {"next_step": "compose_reply"},
                }

        if payload is None and context.get("selected_option") is not None:
            payload = self._build_patient_invite_payload_from_option(
                actor=actor,
                option=context["selected_option"],
                parameters=parameters,
            )

        if payload is None and context.get("direct_payload") is not None:
            payload = context["direct_payload"]

        if payload is None:
            return {
                "action_result": {
                    "error": "Nao consegui preparar o agendamento com os dados informados.",
                },
                "scheduling_context": {"next_step": "compose_reply"},
            }

        try:
            appointment = await self._appointments_client.invite_appointment(actor.token, dict(payload))
        except Exception as exc:
            return {
                "action_result": {"error": self._format_service_error("Nao consegui concluir o agendamento.", exc)},
                "scheduling_context": {"next_step": "compose_reply"},
            }
        return {
            "action_result": {
                "operation": "schedule",
                "status": "created",
                "message": self._format_schedule_success_message(appointment),
            },
            "scheduling_context": {"next_step": "compose_reply"},
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
                    "Para me enviar uma receita médica ou um laudo do seu exame, é muito simples!"
                    "Basta clicar no ícone de clipe de papel, ao lado do campo de mensagem, e selecionar o arquivo que deseja me enviar."
                    "Assim que você mandar, eu vou ler o documento automaticamente, guardar as informações importantes no seu histórico e você já poderá me fazer perguntas sobre ele!"
                    "Se tiver alguma dúvida ou precisar de ajuda, é só me chamar."
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

        if action == "scheduling" and action_result.get("message"):
            return {"reply": str(action_result["message"])}

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

    @staticmethod
    def _contains_schedule_intent(message: str) -> bool:
        lowered = str(message or "").lower()
        return any(
            token in lowered
            for token in [
                "agendar",
                "marcar consulta",
                "marcar uma consulta",
                "nova consulta",
                "quero consulta",
                "quero marcar",
                "agendamento",
            ]
        )

    @staticmethod
    def _contains_doctor_availability_intent(message: str) -> bool:
        lowered = str(message or "").lower()
        return any(
            token in lowered
            for token in [
                "horarios disponiveis",
                "horários disponíveis",
                "horario disponivel",
                "horário disponível",
                "horarios livres",
                "horários livres",
                "horario livre",
                "horário livre",
                "agenda livre",
                "tenho de horario",
                "tenho de horário",
                "tem algum horario",
                "tem algum horário",
                "tem horario",
                "tem horário",
            ]
        )

    @staticmethod
    def _contains_more_availability_intent(message: str) -> bool:
        lowered = str(message or "").lower()
        return any(
            token in lowered
            for token in [
                "outros horarios",
                "outros horários",
                "outras opcoes",
                "outras opções",
                "mais horarios",
                "mais horários",
                "alem desses",
                "além desses",
                "alem dos que voce mostrou",
                "além dos que você mostrou",
                "outro dia",
                "outra data",
                "sem ser",
            ]
        )

    @staticmethod
    def _weekday_token_map() -> dict[str, int]:
        return {
            "segunda feira": 0,
            "segunda": 0,
            "terca feira": 1,
            "terca": 1,
            "terça feira": 1,
            "terça": 1,
            "quarta feira": 2,
            "quarta": 2,
            "quinta feira": 3,
            "quinta": 3,
            "sexta feira": 4,
            "sexta": 4,
            "sabado": 5,
            "sábado": 5,
            "domingo": 6,
        }

    @classmethod
    def _extract_weekday_filter(cls, message: str) -> int | None:
        normalized = cls._normalize_match_text(message)
        if not normalized:
            return None

        ordered_tokens = sorted(cls._weekday_token_map().items(), key=lambda item: len(item[0]), reverse=True)

        explicit_pattern = re.compile(
            r"\b(?:na|no|para|em)\s+(segunda feira|segunda|terca feira|terca|terça feira|terça|quarta feira|quarta|quinta feira|quinta|sexta feira|sexta|sabado|sábado|domingo)\b"
        )
        explicit_match = explicit_pattern.search(normalized)
        if explicit_match:
            explicit_token = explicit_match.group(1).strip()
            mapped = cls._weekday_token_map().get(explicit_token)
            if mapped is not None:
                return mapped

        for token, weekday in ordered_tokens:
            if re.search(rf"\b{re.escape(token)}\b", normalized):
                return weekday

        return None

    @classmethod
    def _extract_excluded_weekday(cls, message: str) -> int | None:
        normalized = cls._normalize_match_text(message)
        if not normalized:
            return None

        for token, weekday in sorted(cls._weekday_token_map().items(), key=lambda item: len(item[0]), reverse=True):
            if (
                f"sem ser na {token}" in normalized
                or f"sem ser no {token}" in normalized
                or f"sem ser {token}" in normalized
                or f"exceto {token}" in normalized
                or f"menos {token}" in normalized
            ):
                return weekday

        return None

    @classmethod
    def _fallback_plan(cls, message: str) -> OrchestrationPlan:
        lowered = (message or "").lower()
        option_match = re.search(r"(?:opcao|opcao n|opcao numero|opção|opção n|opção número)\s*(\d{1,2})", lowered)

        if option_match:
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "schedule", "option_index": int(option_match.group(1))},
                response_hint="Usar a opcao escolhida para confirmar o agendamento.",
            )

        stripped = lowered.strip()
        if stripped.isdigit() and 1 <= int(stripped) <= 12:
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "schedule", "option_index": int(stripped)},
                response_hint="Usar a opcao escolhida para confirmar o agendamento.",
            )

        if cls._is_specialty_catalog_request(message):
            return OrchestrationPlan(
                intent="scheduling",
                action="scheduling",
                parameters={"operation": "schedule", "list_specialties": True},
                response_hint="Listar especialidades disponiveis antes de sugerir horarios.",
            )

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

    def _build_patient_scheduling_context(
        self,
        actor: CurrentActor,
        parameters: dict[str, Any],
        message: str,
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        context: dict[str, Any] = {
            "operation": "schedule",
            "role": "user",
            "parameters": dict(parameters),
            "message": message,
            "history": history,
            "list_specialties": bool(parameters.get("list_specialties")) or self._is_specialty_catalog_request(message),
        }

        duration_minutes = self._coerce_duration_minutes(
            self._first_param(parameters, "duration_minutes", "durationMinutes"),
            default_value=30,
        )
        context["duration_minutes"] = duration_minutes

        option_index = self._extract_option_index(parameters, message)
        context["option_index"] = option_index

        specialty = self._first_param(parameters, "specialty", "especialidade")
        if not specialty:
            specialty = self._extract_specialty_hint(message)
        if not specialty and option_index is not None:
            specialty = self._infer_recent_specialty_from_history(history)
        context["specialty"] = specialty

        doctor_name = self._first_param(parameters, "doctor_name", "doctor", "search")
        if not doctor_name:
            doctor_name = self._extract_doctor_name_hint(message)
        context["doctor_name"] = doctor_name

        selected_from_history = self._select_recent_option_from_history(history, message, option_index)
        if selected_from_history is not None:
            context["selected_from_history"] = selected_from_history

        direct_payload = self._build_patient_direct_payload(actor=actor, parameters=parameters)
        if direct_payload is not None:
            context["direct_payload"] = direct_payload

        return context

    async def _build_doctor_scheduling_context(
        self,
        actor: CurrentActor,
        parameters: dict[str, Any],
        message: str,
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        duration_minutes = self._coerce_duration_minutes(
            self._first_param(parameters, "duration_minutes", "durationMinutes"),
            default_value=30,
        )
        option_index = self._extract_option_index(parameters, message)
        recent_options = self._parse_recent_doctor_availability_options_from_history(history)
        selected_from_history = self._select_recent_doctor_availability_option_from_history(
            history=history,
            message=message,
            option_index=option_index,
        )
        selected_start_time = selected_from_history.get("start_time") if selected_from_history else None

        patient_id = self._first_param(parameters, "patient_id", "patientId")
        patient_name = self._first_param(parameters, "patient_name", "patientName", "patient")
        if not patient_name:
            patient_name = self._extract_patient_name_hint(message)
        if not patient_name:
            patient_name = self._infer_recent_patient_name_from_history(history)

        asks_more_availability = self._contains_more_availability_intent(message)
        asks_availability = (
            bool(parameters.get("ask_availability"))
            or self._contains_doctor_availability_intent(message)
            or asks_more_availability
        )
        excluded_weekday = self._extract_excluded_weekday(message)
        weekday_filter = self._extract_weekday_filter(message)
        if excluded_weekday is not None and weekday_filter == excluded_weekday:
            weekday_filter = None

        # If the doctor selected a listed option, trust that slot over planner-generated timestamps.
        if isinstance(selected_start_time, datetime):
            start_time = selected_start_time
        else:
            # Prefer explicit time from the user message over planner-proposed timestamps.
            start_time = self._extract_start_time_from_text(message)
            if start_time is None and not asks_availability and not recent_options:
                start_time = self._parse_iso_datetime(self._first_param(parameters, "start_time", "startTime"))

        if option_index is not None and recent_options and selected_from_history is None:
            return {
                "next_step": "compose_reply",
                "status": "availability_invalid_option",
                "message": self._format_doctor_availability_message(recent_options, invalid_option=option_index),
            }

        if start_time is not None:
            min_future = datetime.now(timezone.utc) + timedelta(minutes=1)
            if start_time <= min_future:
                return {
                    "next_step": "compose_reply",
                    "status": "past_start_time",
                    "message": (
                        "Esse horario ja passou. Me informe um horario futuro "
                        "ou escolha uma das opcoes de horarios disponiveis."
                    ),
                }

        if start_time is None and asks_availability:
            try:
                from_utc: datetime | None = None
                if asks_more_availability and recent_options:
                    last_start = max(
                        (
                            item.get("start_time")
                            for item in recent_options
                            if isinstance(item.get("start_time"), datetime)
                        ),
                        default=None,
                    )
                    if isinstance(last_start, datetime):
                        from_utc = last_start + timedelta(minutes=1)

                options = await self._build_doctor_availability_options(
                    token=actor.token,
                    doctor_id=actor.user_id,
                    duration_minutes=duration_minutes,
                    from_utc=from_utc,
                    weekday_filter=weekday_filter,
                    excluded_weekday=excluded_weekday,
                )
            except Exception as exc:
                return {
                    "next_step": "compose_reply",
                    "status": "availability_error",
                    "message": self._format_service_error("Nao consegui consultar seus horarios disponiveis.", exc),
                }

            if not options:
                if weekday_filter is not None:
                    requested_day = PT_WEEKDAYS[weekday_filter]
                    return {
                        "next_step": "compose_reply",
                        "status": "availability_day_unavailable",
                        "message": (
                            f"No momento nao encontrei horarios disponiveis para {requested_day}. "
                            "Se quiser, posso mostrar outros dias."
                        ),
                    }
                if asks_more_availability:
                    return {
                        "next_step": "compose_reply",
                        "status": "availability_no_more",
                        "message": (
                            "No momento nao encontrei outros horarios alem dos que ja te mostrei. "
                            "Se quiser, posso tentar novamente mais tarde."
                        ),
                    }
                return {
                    "next_step": "compose_reply",
                    "status": "availability_unavailable",
                    "message": (
                        "No momento nao encontrei horarios disponiveis na sua agenda para os proximos dias."
                    ),
                }

            return {
                "next_step": "compose_reply",
                "status": "availability_listed",
                "message": self._format_doctor_availability_message(options),
            }

        if not patient_id and not patient_name:
            return {
                "next_step": "compose_reply",
                "status": "needs_patient",
                "message": "Para agendar, me diga o nome completo do paciente.",
            }

        resolved_patient_name = str(patient_name or "").strip()
        if not patient_id:
            try:
                matches = await self._users_client.get_patients(
                    token=actor.token,
                    search=resolved_patient_name,
                    limit=5,
                )
            except Exception as exc:
                return {
                    "next_step": "compose_reply",
                    "status": "patient_lookup_error",
                    "message": self._format_service_error("Nao consegui buscar o paciente agora.", exc),
                }
            if not matches:
                return {
                    "next_step": "compose_reply",
                    "status": "patient_not_found",
                    "message": (
                        f"Nao encontrei paciente com o nome \"{resolved_patient_name}\". "
                        "Me informe o nome completo para eu tentar novamente."
                    ),
                }

            selected_patient = self._select_patient_match_by_name(resolved_patient_name, matches)
            if selected_patient is None:
                suggestions = [
                    f"- {str(item.get('name', '')).strip()} ({str(item.get('email', '')).strip()})"
                    for item in matches[:3]
                    if str(item.get("name", "")).strip()
                ]
                if not suggestions:
                    suggestions = [
                        f"- {str(item.get('name', '')).strip()}"
                        for item in matches[:3]
                        if str(item.get("name", "")).strip()
                    ]
                suggestion_text = "\n".join(suggestions)
                return {
                    "next_step": "compose_reply",
                    "status": "patient_ambiguous",
                    "message": (
                        "Encontrei mais de um paciente com nome parecido. "
                        "Me diga o nome completo do paciente para confirmar.\n"
                        f"{suggestion_text}"
                    ),
                }

            patient_id = str(selected_patient.get("userId", "")).strip()
            resolved_patient_name = str(selected_patient.get("name", "")).strip() or resolved_patient_name

        if start_time is None:
            patient_reference = resolved_patient_name or "esse paciente"
            return {
                "next_step": "compose_reply",
                "status": "needs_start_time",
                "message": (
                    f"Perfeito. Qual a data e horario de inicio da consulta para {patient_reference}? "
                    "Se puder, me envie no formato AAAA-MM-DD HH:MM."
                ),
            }

        normalized_parameters = dict(parameters)
        normalized_parameters["patient_id"] = str(patient_id)
        normalized_parameters["start_time"] = self._to_utc_iso(start_time)
        normalized_parameters["duration_minutes"] = duration_minutes
        payload = self._build_invite_payload(normalized_parameters, actor)
        if payload is None:
            return {
                "next_step": "compose_reply",
                "status": "invalid_schedule_data",
                "message": (
                    "Nao consegui validar os dados do agendamento. "
                    "Me confirme o nome do paciente e o horario de inicio."
                ),
            }

        return {
            "next_step": "create",
            "operation": "schedule",
            "role": actor.role,
            "payload": payload,
            "parameters": normalized_parameters,
        }

    async def _build_patient_schedule_options(
        self,
        token: str,
        parameters: dict[str, Any],
        message: str,
    ) -> list[dict[str, Any]]:
        search = self._first_param(parameters, "doctor_name", "doctor", "search")
        specialty = self._first_param(parameters, "specialty", "especialidade")
        if not search:
            extracted_name = self._extract_doctor_name_hint(message)
            if extracted_name:
                search = extracted_name

        duration_minutes = self._coerce_duration_minutes(
            self._first_param(parameters, "duration_minutes", "durationMinutes"),
            default_value=30,
        )

        doctors = await self._users_client.get_doctors(
            token=token,
            search=str(search) if search else None,
            specialty=str(specialty) if specialty else None,
            limit=8,
        )
        if not doctors:
            return []

        from_utc = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        to_utc = from_utc + timedelta(days=21)
        from_utc_iso = self._to_utc_iso(from_utc)
        to_utc_iso = self._to_utc_iso(to_utc)

        slot_tasks = []
        valid_doctors: list[dict[str, Any]] = []
        for doctor in doctors:
            doctor_id = str(doctor.get("userId", "")).strip()
            if not doctor_id:
                continue
            valid_doctors.append(doctor)
            slot_tasks.append(
                self._appointments_client.get_available_slots(
                    token=token,
                    doctor_id=doctor_id,
                    from_utc=from_utc_iso,
                    to_utc=to_utc_iso,
                    duration_minutes=duration_minutes,
                )
            )

        if not slot_tasks:
            return []

        slot_results = await asyncio.gather(*slot_tasks, return_exceptions=True)
        candidates: list[dict[str, Any]] = []
        for doctor, result in zip(valid_doctors, slot_results):
            if isinstance(result, Exception):
                continue

            doctor_id = str(doctor.get("userId", "")).strip()
            doctor_name = str(doctor.get("name", "")).strip() or "Medico"
            raw_specialties = doctor.get("specialties") or []
            if not isinstance(raw_specialties, list):
                raw_specialties = []
            specialties = [str(item).strip() for item in raw_specialties if str(item).strip()]
            sorted_slots = sorted(result, key=lambda item: str(item.get("startTime", "")))

            for rank, slot in enumerate(sorted_slots[:4]):
                start_time = self._parse_iso_datetime(slot.get("startTime"))
                end_time = self._parse_iso_datetime(slot.get("endTime"))
                if not start_time or not end_time or end_time <= start_time:
                    continue

                candidates.append(
                    {
                        "doctor_id": doctor_id,
                        "doctor_name": doctor_name,
                        "specialties": specialties,
                        "start_time": start_time,
                        "end_time": end_time,
                        "doctor_slot_rank": rank,
                    }
                )

        if not candidates:
            return []

        candidates = sorted(candidates, key=lambda item: (item["doctor_slot_rank"], item["start_time"]))
        closest_days: list[Any] = []
        selected: list[dict[str, Any]] = []
        for candidate in candidates:
            slot_day = candidate["start_time"].date()
            if slot_day not in closest_days:
                if len(closest_days) >= 3:
                    continue
                closest_days.append(slot_day)

            selected.append(candidate)
            if len(selected) >= 8:
                break

        for index, option in enumerate(selected, start=1):
            option["option_index"] = index

        return selected

    async def _build_doctor_availability_options(
        self,
        token: str,
        doctor_id: str,
        duration_minutes: int,
        from_utc: datetime | None = None,
        weekday_filter: int | None = None,
        excluded_weekday: int | None = None,
    ) -> list[dict[str, Any]]:
        window_start = (from_utc or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
        now_utc = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        if window_start < now_utc:
            window_start = now_utc
        to_utc = window_start + timedelta(days=21)
        slots = await self._appointments_client.get_available_slots(
            token=token,
            doctor_id=doctor_id,
            from_utc=self._to_utc_iso(window_start),
            to_utc=self._to_utc_iso(to_utc),
            duration_minutes=duration_minutes,
        )

        candidates: list[dict[str, Any]] = []
        for slot in slots:
            start_time = self._parse_iso_datetime(slot.get("startTime"))
            end_time = self._parse_iso_datetime(slot.get("endTime"))
            if not start_time or not end_time or end_time <= start_time:
                continue
            local_weekday = start_time.astimezone(timezone(timedelta(hours=-3))).weekday()
            if weekday_filter is not None and local_weekday != weekday_filter:
                continue
            if excluded_weekday is not None and local_weekday == excluded_weekday:
                continue
            candidates.append({"start_time": start_time, "end_time": end_time})

        if not candidates:
            return []

        candidates = sorted(candidates, key=lambda item: item["start_time"])
        closest_days: list[Any] = []
        selected: list[dict[str, Any]] = []
        for candidate in candidates:
            slot_day = candidate["start_time"].date()
            if slot_day not in closest_days:
                if len(closest_days) >= 3:
                    continue
                closest_days.append(slot_day)

            selected.append(candidate)
            if len(selected) >= 8:
                break

        for index, option in enumerate(selected, start=1):
            option["option_index"] = index

        return selected

    def _format_doctor_availability_message(
        self,
        options: list[dict[str, Any]],
        invalid_option: int | None = None,
    ) -> str:
        lines: list[str] = []
        if invalid_option is not None:
            lines.append(f"Nao encontrei a opcao {invalid_option}.")
            lines.append("")

        lines.append("Encontrei seus horarios disponiveis mais proximos:")
        for option in options:
            lines.append(f"{option['option_index']}. {self._format_slot_datetime(option['start_time'])}")

        lines.append("")
        lines.append("Me diga o numero da opcao e o nome do paciente para eu agendar.")
        return "\n".join(lines)

    async def _list_available_specialties(self, token: str) -> list[str]:
        doctors = await self._users_client.get_doctors(token=token, limit=100)
        specialties: set[str] = set()

        for doctor in doctors:
            raw_specialties = doctor.get("specialties") or []
            if not isinstance(raw_specialties, list):
                continue

            for specialty in raw_specialties:
                normalized = str(specialty).strip()
                if normalized:
                    specialties.add(normalized)

        return sorted(specialties, key=lambda item: item.lower())

    async def _build_patient_invite_payload_from_history_option(
        self,
        actor: CurrentActor,
        option: dict[str, Any],
        duration_minutes: int,
        parameters: dict[str, Any],
    ) -> dict[str, Any] | None:
        doctor_name = str(option.get("doctor_name", "")).strip()
        specialty = str(option.get("specialty", "")).strip()
        start_time = option.get("start_time")
        if not doctor_name or not isinstance(start_time, datetime):
            return None

        doctors = await self._users_client.get_doctors(
            token=actor.token,
            search=doctor_name,
            specialty=specialty or None,
            limit=8,
        )
        if not doctors and specialty:
            doctors = await self._users_client.get_doctors(
                token=actor.token,
                search=doctor_name,
                specialty=None,
                limit=8,
            )
        if not doctors:
            return None

        search_from = start_time - timedelta(hours=2)
        search_to = start_time + timedelta(hours=2)

        for doctor in doctors:
            doctor_id = str(doctor.get("userId", "")).strip()
            if not doctor_id:
                continue

            try:
                slots = await self._appointments_client.get_available_slots(
                    token=actor.token,
                    doctor_id=doctor_id,
                    from_utc=self._to_utc_iso(search_from),
                    to_utc=self._to_utc_iso(search_to),
                    duration_minutes=duration_minutes,
                )
            except Exception:
                continue

            matched_slot = next(
                (
                    slot
                    for slot in slots
                    if self._parse_iso_datetime(slot.get("startTime")) == start_time
                ),
                None,
            )
            if matched_slot is None:
                continue

            matched_end_time = self._parse_iso_datetime(matched_slot.get("endTime"))
            if matched_end_time is None or matched_end_time <= start_time:
                matched_end_time = start_time + timedelta(minutes=duration_minutes)

            invitation_expires_at = self._compute_invitation_expiration(
                start_time=start_time,
                utc_now=datetime.now(timezone.utc),
            )
            if not invitation_expires_at:
                return None

            return {
                "doctorId": doctor_id,
                "patientId": actor.user_id,
                "startTime": self._to_utc_iso(start_time),
                "endTime": self._to_utc_iso(matched_end_time),
                "invitationExpiresAt": self._to_utc_iso(invitation_expires_at),
                "title": self._first_param(parameters, "title") or f"Consulta com {doctor_name}",
                "description": self._first_param(parameters, "description"),
                "location": self._first_param(parameters, "location"),
                "invitationMessage": self._first_param(parameters, "invitation_message", "invitationMessage"),
            }

        return None

    def _build_patient_direct_payload(self, actor: CurrentActor, parameters: dict[str, Any]) -> dict[str, Any] | None:
        doctor_id = self._first_param(parameters, "doctor_id", "doctorId")
        start_time = self._parse_iso_datetime(self._first_param(parameters, "start_time", "startTime"))
        if not doctor_id or not start_time:
            return None

        duration_minutes = self._coerce_duration_minutes(
            self._first_param(parameters, "duration_minutes", "durationMinutes"),
            default_value=30,
        )
        explicit_end_time = self._parse_iso_datetime(self._first_param(parameters, "end_time", "endTime"))
        end_time = explicit_end_time or (start_time + timedelta(minutes=duration_minutes))
        if end_time <= start_time:
            return None

        invitation_expires_at = self._parse_iso_datetime(
            self._first_param(parameters, "invitation_expires_at", "invitationExpiresAt")
        )
        if not invitation_expires_at:
            invitation_expires_at = self._compute_invitation_expiration(start_time=start_time, utc_now=datetime.now(timezone.utc))
        if not invitation_expires_at:
            return None

        return {
            "doctorId": str(doctor_id),
            "patientId": actor.user_id,
            "startTime": self._to_utc_iso(start_time),
            "endTime": self._to_utc_iso(end_time),
            "invitationExpiresAt": self._to_utc_iso(invitation_expires_at),
            "title": self._first_param(parameters, "title") or "Consulta marcada via chatbot",
            "description": self._first_param(parameters, "description"),
            "location": self._first_param(parameters, "location"),
            "invitationMessage": self._first_param(parameters, "invitation_message", "invitationMessage"),
        }

    def _build_patient_invite_payload_from_option(
        self,
        actor: CurrentActor,
        option: dict[str, Any],
        parameters: dict[str, Any],
    ) -> dict[str, Any] | None:
        start_time = option.get("start_time")
        end_time = option.get("end_time")
        doctor_id = str(option.get("doctor_id", "")).strip()
        doctor_name = str(option.get("doctor_name", "")).strip() or "medico"

        if not doctor_id or not isinstance(start_time, datetime) or not isinstance(end_time, datetime):
            return None

        invitation_expires_at = self._compute_invitation_expiration(start_time=start_time, utc_now=datetime.now(timezone.utc))
        if not invitation_expires_at:
            return None

        return {
            "doctorId": doctor_id,
            "patientId": actor.user_id,
            "startTime": self._to_utc_iso(start_time),
            "endTime": self._to_utc_iso(end_time),
            "invitationExpiresAt": self._to_utc_iso(invitation_expires_at),
            "title": self._first_param(parameters, "title") or f"Consulta com {doctor_name}",
            "description": self._first_param(parameters, "description"),
            "location": self._first_param(parameters, "location"),
            "invitationMessage": self._first_param(parameters, "invitation_message", "invitationMessage"),
        }

    @staticmethod
    def _compute_invitation_expiration(start_time: datetime, utc_now: datetime) -> datetime | None:
        suggested_expiration = start_time - timedelta(minutes=15)
        minimum_future = utc_now + timedelta(minutes=1)
        expiration = suggested_expiration if suggested_expiration > minimum_future else minimum_future

        if expiration >= start_time:
            fallback = start_time - timedelta(minutes=1)
            if fallback <= utc_now:
                return None
            expiration = fallback

        return expiration

    def _format_schedule_options_message(self, options: list[dict[str, Any]], invalid_option: int | None = None) -> str:
        lines: list[str] = []
        if invalid_option is not None:
            lines.append(f"Nao encontrei a opcao {invalid_option}.")
            lines.append("")

        lines.append("Encontrei os horarios mais proximos disponiveis:")
        for option in options:
            specialties = option.get("specialties") or []
            specialty = str(specialties[0]) if specialties else "Consulta"
            lines.append(
                (
                    f"{option['option_index']}. {option['doctor_name']} ({specialty}) - "
                    f"{self._format_slot_datetime(option['start_time'])}"
                )
            )

        lines.append("")
        lines.append("Me diga o numero da opcao que voce prefere e eu agendo para voce.")
        return "\n".join(lines)

    @staticmethod
    def _format_specialties_message(specialties: list[str]) -> str:
        if not specialties:
            return (
                "No momento nao encontrei especialidades disponiveis para agendamento. "
                "Tente novamente em alguns minutos, por favor."
            )

        limited = specialties[:12]
        lines = ["As especialidades disponiveis no momento sao:"]
        for specialty in limited:
            lines.append(f"- {specialty}")

        if len(specialties) > len(limited):
            lines.append("- ...")

        lines.append("")
        lines.append("Me diga qual especialidade voce quer e eu te mostro os horarios mais proximos.")
        return "\n".join(lines)

    @staticmethod
    def _format_unknown_specialty_message(requested_specialty: str, available_specialties: list[str]) -> str:
        header = f"Nao reconheci a especialidade \"{requested_specialty}\"."
        if not available_specialties:
            return (
                f"{header} No momento nao encontrei especialidades disponiveis para agendamento. "
                "Tente novamente em alguns minutos, por favor."
            )

        lines = [header, "", "Estas sao as especialidades disponiveis agora:"]
        for specialty in available_specialties[:12]:
            lines.append(f"- {specialty}")

        if len(available_specialties) > 12:
            lines.append("- ...")

        lines.append("")
        lines.append("Me diga qual especialidade voce prefere e eu te mostro os horarios.")
        return "\n".join(lines)

    @staticmethod
    def _format_schedule_success_message(appointment: dict[str, Any]) -> str:
        start_time = ChatbotService._parse_iso_datetime(appointment.get("startTime"))
        if start_time is None:
            return "Convite de consulta criado com sucesso."

        when = ChatbotService._format_slot_datetime(start_time)
        status = str(appointment.get("status", "")).strip().lower()
        if status == "pendingacceptance":
            status_note = "Convite enviado e aguardando confirmacao."
        elif status == "accepted":
            status_note = "Consulta confirmada."
        else:
            status_note = "Agendamento registrado."

        return f"Pronto. Sua solicitacao para {when} foi registrada. {status_note}"

    @staticmethod
    def _format_service_error(prefix: str, exc: Exception) -> str:
        response = getattr(exc, "response", None)
        if response is not None:
            status_code = getattr(response, "status_code", None)
            detail = None
            try:
                payload = response.json()
                if isinstance(payload, dict):
                    detail = payload.get("message") or payload.get("detail") or payload.get("error")
                elif isinstance(payload, list) and payload:
                    detail = str(payload[0])
            except Exception:
                detail = None

            if not detail:
                text = str(getattr(response, "text", "")).strip()
                if text:
                    detail = text

            if detail:
                detail_text = ChatbotService._sanitize_service_error_detail(str(detail).strip())
                if len(detail_text) > 220:
                    detail_text = detail_text[:217] + "..."
                return f"{prefix} {detail_text}"

            if status_code is not None:
                return f"{prefix} O servico retornou status {status_code}."

        return f"{prefix} Tente novamente em instantes."

    @staticmethod
    def _sanitize_service_error_detail(detail: str) -> str:
        normalized = str(detail or "").strip()
        lowered = normalized.lower()

        if "patient profile was not found" in lowered or "patient was not found" in lowered:
            return "Nao encontrei o cadastro do paciente informado."
        if "doctor profile was not found" in lowered or "doctor was not found" in lowered:
            return "Nao encontrei o cadastro do medico informado."

        sanitized = re.sub(r"\busersapi\b", "cadastro de usuarios", normalized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\bappointmentsapi\b", "agenda", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\s{2,}", " ", sanitized).strip(" .")
        return sanitized or "Nao foi possivel concluir a operacao."

    def _select_recent_option_from_history(
        self,
        history: list[dict[str, Any]],
        message: str,
        option_index: int | None,
    ) -> dict[str, Any] | None:
        options = self._parse_recent_schedule_options_from_history(history)
        if not options:
            return None

        if option_index is not None:
            return next((item for item in options if item["option_index"] == option_index), None)

        message_lower = str(message or "").lower()
        matched = [item for item in options if self._message_mentions_schedule_option(message_lower, item)]
        if len(matched) == 1:
            return matched[0]

        return None

    def _select_recent_doctor_availability_option_from_history(
        self,
        history: list[dict[str, Any]],
        message: str,
        option_index: int | None,
    ) -> dict[str, Any] | None:
        options = self._parse_recent_doctor_availability_options_from_history(history)
        if not options:
            return None

        if option_index is not None:
            return next((item for item in options if item["option_index"] == option_index), None)

        parsed_start = self._extract_start_time_from_text(message)
        if parsed_start is None:
            return None

        return next((item for item in options if item.get("start_time") == parsed_start), None)

    def _parse_recent_schedule_options_from_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "assistant":
                continue

            content = str(item.get("content", ""))
            if "Encontrei os horarios mais proximos disponiveis:" not in content:
                continue

            parsed_options: list[dict[str, Any]] = []
            for line in content.splitlines():
                match = re.match(
                    r"^\s*(\d{1,2})\.\s*(.+?)\s+\((.+?)\)\s*-\s*(.+?)\s*$",
                    line.strip(),
                    flags=re.IGNORECASE,
                )
                if not match:
                    continue

                parsed_start = self._parse_display_slot_datetime(match.group(4))
                if parsed_start is None:
                    continue

                parsed_options.append(
                    {
                        "option_index": int(match.group(1)),
                        "doctor_name": match.group(2).strip(),
                        "specialty": match.group(3).strip(),
                        "start_time": parsed_start,
                    }
                )

            if parsed_options:
                return parsed_options

        return []

    def _parse_recent_doctor_availability_options_from_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "assistant":
                continue

            content = str(item.get("content", ""))
            if "Encontrei seus horarios disponiveis mais proximos:" not in content:
                continue

            parsed_options: list[dict[str, Any]] = []
            for line in content.splitlines():
                match = re.match(
                    r"^\s*(\d{1,2})\.\s*(.+?)\s*$",
                    line.strip(),
                    flags=re.IGNORECASE,
                )
                if not match:
                    continue

                parsed_start = self._parse_display_slot_datetime(match.group(2))
                if parsed_start is None:
                    continue

                parsed_options.append(
                    {
                        "option_index": int(match.group(1)),
                        "start_time": parsed_start,
                    }
                )

            if parsed_options:
                return parsed_options

        return []

    @staticmethod
    def _message_mentions_schedule_option(message_lower: str, option: dict[str, Any]) -> bool:
        doctor_name = str(option.get("doctor_name", "")).strip().lower()
        start_time = option.get("start_time")
        if not doctor_name or not isinstance(start_time, datetime):
            return False

        local_start = start_time.astimezone(timezone(timedelta(hours=-3)))
        time_token = local_start.strftime("%H:%M")
        date_token = local_start.strftime("%d/%m")
        return doctor_name in message_lower and (time_token in message_lower or date_token in message_lower)

    @staticmethod
    def _parse_display_slot_datetime(value: str) -> datetime | None:
        match = re.search(r"(\d{2})/(\d{2})\s+as\s+(\d{2}):(\d{2})", str(value or ""), flags=re.IGNORECASE)
        if not match:
            return None

        day = int(match.group(1))
        month = int(match.group(2))
        hour = int(match.group(3))
        minute = int(match.group(4))

        local_tz = timezone(timedelta(hours=-3))
        now_local = datetime.now(local_tz)

        try:
            local_candidate = datetime(now_local.year, month, day, hour, minute, tzinfo=local_tz)
        except ValueError:
            return None

        if local_candidate < now_local - timedelta(days=1):
            try:
                local_candidate = datetime(now_local.year + 1, month, day, hour, minute, tzinfo=local_tz)
            except ValueError:
                return None

        return local_candidate.astimezone(timezone.utc)

    def _extract_option_index(self, parameters: dict[str, Any], message: str) -> int | None:
        option_value = self._first_param(parameters, "option_index", "optionIndex", "opcao", "opção")
        if option_value is not None:
            try:
                parsed = int(str(option_value).strip())
                if 1 <= parsed <= 12:
                    return parsed
            except ValueError:
                pass

        lowered = (message or "").lower()
        option_match = re.search(r"(?:opcao|opcao n|opcao numero|opção|opção n|opção número)\s*(\d{1,2})", lowered)
        if option_match:
            parsed = int(option_match.group(1))
            if 1 <= parsed <= 12:
                return parsed

        stripped = lowered.strip()
        if stripped.isdigit():
            parsed = int(stripped)
            if 1 <= parsed <= 12:
                return parsed

        return None

    @staticmethod
    def _extract_doctor_name_hint(message: str) -> str | None:
        match = re.search(r"\bdr\.?\s+([a-zA-ZÀ-ÿ' ]{3,40})", message or "")
        if not match:
            return None
        return match.group(1).strip()

    @staticmethod
    def _extract_patient_name_hint(message: str) -> str | None:
        text = re.sub(r"\s+", " ", str(message or "")).strip()
        if not text:
            return None

        patterns = [
            r"(?:paciente)\s+([a-zA-ZÀ-ÿ' ]{3,80})",
            r"(?:para\s+o\s+paciente|para\s+a\s+paciente|para\s+paciente)\s+([a-zA-ZÀ-ÿ' ]{3,80})",
            r"(?:opcao\s*\d+\s*para|opção\s*\d+\s*para|para\s+o|para\s+a)\s+([a-zA-ZÀ-ÿ' ]{3,80})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1).strip(" .,:;!?")
                candidate = re.sub(r"\b(hoje|amanha|amanhã|as|às)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
                candidate = re.sub(r"\d.*$", "", candidate).strip()
                candidate = re.sub(r"\b(eu|agendar|marcar|consulta)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
                normalized = re.sub(r"\s+", " ", candidate)
                if normalized and not any(char.isdigit() for char in normalized):
                    return normalized

        bare_candidate = text.strip(" .,:;!?")
        if re.fullmatch(r"[a-zA-ZÀ-ÿ' ]{3,80}", bare_candidate):
            lowered = bare_candidate.lower()
            blocked = {"agendar", "consulta", "marcar", "horario", "hoje", "amanha", "amanhã"}
            if all(token not in lowered for token in blocked):
                return re.sub(r"\s+", " ", bare_candidate)

        return None

    def _infer_recent_patient_name_from_history(self, history: list[dict[str, Any]]) -> str | None:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "user":
                continue

            candidate = self._extract_patient_name_hint(str(item.get("content", "")))
            if candidate:
                return candidate

        return None

    @classmethod
    def _select_patient_match_by_name(
        cls,
        requested_name: str,
        matches: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        if not matches:
            return None
        if len(matches) == 1:
            return matches[0]

        requested_normalized = cls._normalize_match_text(requested_name)
        exact_matches = [
            item
            for item in matches
            if cls._normalize_match_text(str(item.get("name", ""))) == requested_normalized
        ]
        if len(exact_matches) == 1:
            return exact_matches[0]

        return None

    @staticmethod
    def _extract_start_time_from_text(message: str) -> datetime | None:
        text = str(message or "").strip()
        if not text:
            return None

        local_tz = timezone(timedelta(hours=-3))
        now_local = datetime.now(local_tz)
        normalized = text.replace("às", "as").replace("ÀS", "as")

        iso_match = re.search(r"(\d{4})-(\d{2})-(\d{2})[ tT](\d{2}):(\d{2})", normalized)
        if iso_match:
            year = int(iso_match.group(1))
            month = int(iso_match.group(2))
            day = int(iso_match.group(3))
            hour = int(iso_match.group(4))
            minute = int(iso_match.group(5))
            try:
                local_value = datetime(year, month, day, hour, minute, tzinfo=local_tz)
            except ValueError:
                return None
            return local_value.astimezone(timezone.utc)

        relative_match = re.search(r"\b(hoje|amanha|amanhã)\b.*?(\d{1,2})(?::(\d{2}))?\s*(h)?", normalized, flags=re.IGNORECASE)
        if relative_match:
            keyword = relative_match.group(1).lower()
            hour = int(relative_match.group(2))
            minute = int(relative_match.group(3) or "00")
            if hour > 23 or minute > 59:
                return None
            day_offset = 1 if keyword in {"amanha", "amanhã"} else 0
            local_date = (now_local + timedelta(days=day_offset)).date()
            local_value = datetime(
                local_date.year,
                local_date.month,
                local_date.day,
                hour,
                minute,
                tzinfo=local_tz,
            )
            return local_value.astimezone(timezone.utc)

        date_time_match = re.search(
            r"(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\s*(?:as|a)?\s*(\d{1,2})(?::(\d{2}))?\s*(h)?",
            normalized,
            flags=re.IGNORECASE,
        )
        if not date_time_match:
            return None

        day = int(date_time_match.group(1))
        month = int(date_time_match.group(2))
        year = int(date_time_match.group(3)) if date_time_match.group(3) else now_local.year
        hour = int(date_time_match.group(4))
        minute = int(date_time_match.group(5) or "00")
        if hour > 23 or minute > 59:
            return None

        try:
            local_value = datetime(year, month, day, hour, minute, tzinfo=local_tz)
        except ValueError:
            return None

        if not date_time_match.group(3) and local_value < now_local - timedelta(days=1):
            try:
                local_value = datetime(year + 1, month, day, hour, minute, tzinfo=local_tz)
            except ValueError:
                return None

        return local_value.astimezone(timezone.utc)

    @staticmethod
    def _is_specialty_catalog_request(message: str) -> bool:
        lowered = str(message or "").lower()
        asks_specialties = "especialidade" in lowered or "especialidades" in lowered
        asks_listing = any(
            token in lowered
            for token in [
                "quais",
                "qual",
                "lista",
                "mostrar",
                "dispon",
                "tem",
                "têm",
                "exist",
            ]
        )
        return asks_specialties and asks_listing

    @staticmethod
    def _normalize_match_text(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", str(value or "").lower())
        without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
        without_symbols = re.sub(r"[^a-z0-9\s]", " ", without_accents)
        compacted = re.sub(r"\s+", " ", without_symbols).strip()
        return compacted

    @classmethod
    def _match_specialty_from_catalog(cls, requested_specialty: str, available_specialties: list[str]) -> str | None:
        requested = cls._normalize_match_text(requested_specialty)
        if not requested:
            return None

        catalog = [
            (specialty, cls._normalize_match_text(specialty))
            for specialty in available_specialties
            if str(specialty).strip()
        ]
        if not catalog:
            return None

        for specialty, normalized in catalog:
            if normalized == requested:
                return specialty

        contains_matches = [
            specialty
            for specialty, normalized in catalog
            if requested in normalized or normalized in requested
        ]
        if len(contains_matches) == 1:
            return contains_matches[0]

        requested_tokens = set(requested.split())
        if requested_tokens:
            token_matches = []
            for specialty, normalized in catalog:
                normalized_tokens = set(normalized.split())
                if requested_tokens.issubset(normalized_tokens):
                    token_matches.append(specialty)

            if len(token_matches) == 1:
                return token_matches[0]

        return None

    @staticmethod
    def _extract_specialty_hint(message: str) -> str | None:
        raw = re.sub(r"\s+", " ", str(message or "")).strip()
        if not raw:
            return None

        lowered = raw.lower().strip(" .,:;!?")
        if not lowered or lowered.isdigit():
            return None

        if re.search(r"\b(dr\.?|dra\.?|doutor|doutora)\b", lowered):
            return None

        tokens = re.findall(r"[a-zA-ZÀ-ÿ]+", lowered)
        if not tokens:
            return None

        stopwords = {
            "quero",
            "gostaria",
            "preciso",
            "agendar",
            "marcar",
            "consulta",
            "consultas",
            "especialidade",
            "especialidades",
            "horario",
            "horarios",
            "disponivel",
            "disponiveis",
            "disponíveis",
            "por",
            "favor",
            "para",
            "de",
            "do",
            "da",
            "dos",
            "das",
            "em",
            "na",
            "no",
            "com",
            "um",
            "uma",
            "o",
            "a",
            "me",
            "mostrar",
            "busco",
            "procuro",
            "seria",
            "pode",
            "poderia",
            "hoje",
            "amanha",
            "amanhã",
            "semana",
            "mes",
            "mês",
            "quais",
            "qual",
            "sao",
            "são",
            "tem",
            "têm",
            "existem",
            "existe",
            "temos",
            "vocês",
            "voces",
            "clinix",
            "ola",
            "olá",
            "oi",
            "eai",
            "e",
            "ai",
            "aí",
            "bom",
            "boa",
            "dia",
            "tarde",
            "noite",
            "tudo",
            "bem",
        }
        filtered_tokens = [token for token in tokens if token not in stopwords]
        if not filtered_tokens:
            return None

        normalized = " ".join(filtered_tokens).strip()

        if len(normalized) < 3 or len(normalized) > 40:
            return None
        if any(char.isdigit() for char in normalized):
            return None

        return normalized

    def _infer_recent_specialty_from_history(self, history: list[dict[str, Any]]) -> str | None:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "user":
                continue
            specialty = self._extract_specialty_hint(str(item.get("content", "")))
            if specialty:
                return specialty
        return None

    @staticmethod
    def _was_waiting_for_specialty(history: list[dict[str, Any]]) -> bool:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "assistant":
                continue

            content = str(item.get("content", "")).lower()
            return "qual especialidade" in content and "horarios disponiveis" in content

        return False

    @staticmethod
    def _was_waiting_for_doctor_scheduling_details(history: list[dict[str, Any]]) -> bool:
        for item in reversed(history or []):
            if str(item.get("sender", "")).lower() != "assistant":
                continue

            content = str(item.get("content", "")).lower()
            if "nome completo do paciente" in content:
                return True
            if "data e horario de inicio da consulta" in content:
                return True
            if "numero da opcao e o nome do paciente" in content:
                return True
            if "esse horario ja passou" in content:
                return True
            return False

        return False

    @staticmethod
    def _coerce_duration_minutes(value: Any, default_value: int) -> int:
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError):
            return default_value

        if parsed < 15:
            return 15
        if parsed > 240:
            return 240
        return parsed

    @staticmethod
    def _to_utc_iso(value: datetime) -> str:
        utc_value = value.astimezone(timezone.utc).replace(microsecond=0)
        return utc_value.isoformat().replace("+00:00", "Z")

    @staticmethod
    def _parse_iso_datetime(value: Any) -> datetime | None:
        if value is None:
            return None

        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)

        raw = str(value).strip()
        if not raw:
            return None

        normalized = raw
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"

        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _format_slot_datetime(value: datetime) -> str:
        local = value.astimezone(timezone(timedelta(hours=-3)))
        weekday = PT_WEEKDAYS[local.weekday()]
        return f"{weekday}, {local.day:02d}/{local.month:02d} as {local.hour:02d}:{local.minute:02d}"

    def _build_invite_payload(self, parameters: dict[str, Any], actor: CurrentActor) -> dict[str, Any] | None:
        start_time = self._parse_iso_datetime(self._first_param(parameters, "start_time", "startTime"))
        if not start_time:
            return None

        duration_minutes = self._coerce_duration_minutes(
            self._first_param(parameters, "duration_minutes", "durationMinutes"),
            default_value=30,
        )
        end_time = self._parse_iso_datetime(self._first_param(parameters, "end_time", "endTime")) or (
            start_time + timedelta(minutes=duration_minutes)
        )
        if end_time <= start_time:
            return None

        invitation_expires_at = self._parse_iso_datetime(
            self._first_param(parameters, "invitation_expires_at", "invitationExpiresAt")
        ) or self._compute_invitation_expiration(start_time=start_time, utc_now=datetime.now(timezone.utc))
        if not invitation_expires_at:
            return None

        if self._is_doctor_role(actor.role):
            doctor_id = actor.user_id
            patient_id = self._first_param(parameters, "patient_id", "patientId")
        elif self._is_patient_role(actor.role):
            doctor_id = self._first_param(parameters, "doctor_id", "doctorId")
            patient_id = actor.user_id
        else:
            return None

        if not doctor_id or not patient_id:
            return None

        return {
            "doctorId": doctor_id,
            "patientId": patient_id,
            "startTime": self._to_utc_iso(start_time),
            "endTime": self._to_utc_iso(end_time),
            "invitationExpiresAt": self._to_utc_iso(invitation_expires_at),
            "title": self._first_param(parameters, "title") or "Consulta marcada via chatbot",
            "description": self._first_param(parameters, "description"),
            "location": self._first_param(parameters, "location"),
            "invitationMessage": self._first_param(parameters, "invitation_message", "invitationMessage"),
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
