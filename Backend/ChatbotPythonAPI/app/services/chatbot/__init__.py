from __future__ import annotations

from typing import Any


__all__ = ["ChatbotService"]


def __getattr__(name: str) -> Any:
    if name == "ChatbotService":
        from ..chatbot_service import ChatbotService

        return ChatbotService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
