from __future__ import annotations

from datetime import datetime, timezone
import re
import unicodedata
from typing import Any


def is_cancelable_appointment(appointment: dict[str, Any], now: datetime | None = None) -> bool:
    status = str(appointment.get("status", "")).strip().lower()
    if status not in {"pendingacceptance", "accepted"}:
        return False

    start_time = _parse_iso_datetime(appointment.get("startTime"))
    reference = now or datetime.now(timezone.utc)
    if start_time is None:
        return True

    return start_time >= reference


def resolve_cancel_target(
    appointments: list[dict[str, Any]],
    message: str,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    cancellable = [appointment for appointment in appointments if is_cancelable_appointment(appointment, now)]
    if len(cancellable) == 1:
        return cancellable[0]

    normalized_message = _normalize(message)
    if not normalized_message:
        return None

    for appointment in cancellable:
        match_candidates = [
            _normalize(str(appointment.get("title", ""))),
            _normalize(str(appointment.get("location", ""))),
            _normalize(str(appointment.get("description", ""))),
            _normalize(_format_datetime_hint(appointment.get("startTime"))),
        ]
        if any(candidate and candidate in normalized_message for candidate in match_candidates):
            return appointment
        if any(_message_contains_candidate_tokens(normalized_message, candidate) for candidate in match_candidates):
            return appointment
        combined = " ".join(candidate for candidate in match_candidates if candidate)
        if combined and normalized_message in combined:
            return appointment

    return None


def count_cancelable_appointments(
    appointments: list[dict[str, Any]],
    now: datetime | None = None,
) -> int:
    return len([appointment for appointment in appointments if is_cancelable_appointment(appointment, now)])


def _parse_iso_datetime(raw_value: Any) -> datetime | None:
    if not raw_value:
        return None

    text = str(raw_value).strip()
    if not text:
        return None

    if text.endswith("Z"):
        text = text.replace("Z", "+00:00")

    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _format_datetime_hint(raw_value: Any) -> str:
    parsed = _parse_iso_datetime(raw_value)
    if parsed is None:
        return ""

    local = parsed.astimezone(timezone.utc)
    return f"{local.day:02d}/{local.month:02d}/{local.year} {local.hour:02d}:{local.minute:02d}"


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    only_words = re.sub(r"[^a-zA-Z0-9\s]", " ", without_accents.lower())
    return " ".join(only_words.split())


def _message_contains_candidate_tokens(message: str, candidate: str) -> bool:
    if not candidate:
        return False

    message_tokens = set(message.split())
    candidate_tokens = [token for token in candidate.split() if len(token) > 2]
    if not candidate_tokens:
        return False

    return all(token in message_tokens for token in candidate_tokens)
