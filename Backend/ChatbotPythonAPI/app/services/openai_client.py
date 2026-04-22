import base64
from typing import Any

import httpx
from langfuse import observe

from ..config import Settings


class OpenAIClient:
    def __init__(self, settings: Settings):
        self._api_key = settings.openai_api_key
        self._base_url = settings.openai_base_url.rstrip("/")
        self._text_model = settings.openai_text_model
        self._vision_model = settings.openai_vision_model
        self._timeout = settings.openai_request_timeout_seconds

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise ValueError("OPENAI_API_KEY nao configurada.")
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    @observe(name="openai.generate_text", as_type="generation", capture_input=False)
    async def generate_text(self, prompt: str, system: str | None = None) -> str:
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": self._text_model,
            "messages": messages,
            "temperature": 0,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return str(content).strip()

    @observe(name="openai.vision_ocr", as_type="generation", capture_input=False)
    async def vision_ocr(self, image_bytes: bytes, prompt: str) -> str:
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        payload: dict[str, Any] = {
            "model": self._vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_data}"}},
                    ],
                }
            ],
            "temperature": 0,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return str(content).strip()
