from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Any

from ....auth import CurrentActor
from ..definitions import PT_WEEKDAYS


class ChatbotSchedulingContextModule:
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
        specific_date = self._extract_specific_date(message)

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
                if asks_more_availability and recent_options and not specific_date:
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
                    specific_date=specific_date,
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
        insurance_plan: str | None = None,
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

        specific_date = self._extract_specific_date(message)
        tz_brasilia = timezone(timedelta(hours=-3))
        if specific_date:
            day_start = datetime(specific_date.year, specific_date.month, specific_date.day, 0, 0, tzinfo=tz_brasilia)
            day_end = datetime(specific_date.year, specific_date.month, specific_date.day, 23, 59, tzinfo=tz_brasilia)
            from_utc = day_start.astimezone(timezone.utc)
            to_utc = day_end.astimezone(timezone.utc)
            max_days = 1
        else:
            from_utc = datetime.now(timezone.utc).replace(second=0, microsecond=0)
            to_utc = from_utc + timedelta(days=21)
            max_days = 3
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
                    insurance_plan=insurance_plan,
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
                if len(closest_days) >= max_days:
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
        specific_date: date | None = None,
    ) -> list[dict[str, Any]]:
        tz_brasilia = timezone(timedelta(hours=-3))
        if specific_date:
            day_start = datetime(specific_date.year, specific_date.month, specific_date.day, 0, 0, tzinfo=tz_brasilia)
            day_end = datetime(specific_date.year, specific_date.month, specific_date.day, 23, 59, tzinfo=tz_brasilia)
            window_start = day_start.astimezone(timezone.utc)
            window_end = day_end.astimezone(timezone.utc)
            max_days = 1
        else:
            window_start = (from_utc or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
            now_utc = datetime.now(timezone.utc).replace(second=0, microsecond=0)
            if window_start < now_utc:
                window_start = now_utc
            window_end = window_start + timedelta(days=21)
            max_days = 3
        slots = await self._appointments_client.get_available_slots(
            token=token,
            doctor_id=doctor_id,
            from_utc=self._to_utc_iso(window_start),
            to_utc=self._to_utc_iso(window_end),
            duration_minutes=duration_minutes,
        )

        candidates: list[dict[str, Any]] = []
        for slot in slots:
            start_time = self._parse_iso_datetime(slot.get("startTime"))
            end_time = self._parse_iso_datetime(slot.get("endTime"))
            if not start_time or not end_time or end_time <= start_time:
                continue
            local_weekday = start_time.astimezone(tz_brasilia).weekday()
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
                if len(closest_days) >= max_days:
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

