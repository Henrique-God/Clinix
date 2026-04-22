from __future__ import annotations

from ...appointment_matching import count_cancelable_appointments, resolve_cancel_target
from ..definitions import ChatGraphState


class ChatbotSchedulingFlowModule:
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

        insurance_filter = str(parameters.get("insurance_filter", "all")).lower()
        patient_plan = state.get("patient_insurance_plan")
        insurance_plan_param: str | None = None
        if insurance_filter == "plan" and patient_plan and patient_plan.lower() not in ("none", "nenhum", ""):
            insurance_plan_param = patient_plan

        options = await self._build_patient_schedule_options(
            token=actor.token,
            parameters=lookup_parameters,
            message=message,
            insurance_plan=insurance_plan_param,
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

