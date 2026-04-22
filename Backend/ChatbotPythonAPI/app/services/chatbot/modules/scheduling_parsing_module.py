from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from ..definitions import PT_WEEKDAYS


class ChatbotSchedulingParsingModule:
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

