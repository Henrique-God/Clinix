from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Any

from ..definitions import ChatGraphState, OrchestrationPlan, VALID_ACTIONS


class ChatbotPlanningMixin:
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

    @staticmethod
    def _extract_specific_date(message: str) -> date | None:
        normalized = ChatbotPlanningMixin._normalize_match_text(message)
        today = datetime.now(timezone(timedelta(hours=-3))).date()

        if "depois de amanha" in normalized:
            return today + timedelta(days=2)

        if "amanha" in normalized:
            return today + timedelta(days=1)

        month_map = {
            "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5,
            "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
            "novembro": 11, "dezembro": 12,
        }
        m = re.search(r"\b(\d{1,2})\s+de\s+(\w+)", normalized)
        if m:
            day, month_str = int(m.group(1)), m.group(2)
            month = month_map.get(month_str)
            if month:
                year = today.year
                if month < today.month or (month == today.month and day < today.day):
                    year += 1
                try:
                    return date(year, month, day)
                except ValueError:
                    pass

        m = re.search(r"\b(\d{1,2})/(\d{1,2})\b", normalized)
        if m:
            day, month = int(m.group(1)), int(m.group(2))
            year = today.year
            if month < today.month or (month == today.month and day < today.day):
                year += 1
            try:
                return date(year, month, day)
            except ValueError:
                pass

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

