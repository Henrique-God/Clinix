from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from ....auth import CurrentActor
from .scheduling_parsing_module import ChatbotSchedulingParsingModule


class ChatbotSchedulingPayloadModule:
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
        start_time = ChatbotSchedulingParsingModule._parse_iso_datetime(appointment.get("startTime"))
        if start_time is None:
            return "Convite de consulta criado com sucesso."

        when = ChatbotSchedulingParsingModule._format_slot_datetime(start_time)
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
                detail_text = ChatbotSchedulingPayloadModule._sanitize_service_error_detail(str(detail).strip())
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

