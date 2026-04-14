from typing import Any

import httpx

from ..config import Settings


class AppointmentsClient:
    def __init__(self, settings: Settings):
        self._base_url = settings.appointments_api_base_url.rstrip("/")

    @staticmethod
    def _auth_headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    async def get_patient_appointments(self, token: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self._base_url}/appointments/patient",
                headers=self._auth_headers(token),
            )
            response.raise_for_status()
            return list(response.json())

    async def get_doctor_appointments(self, token: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self._base_url}/appointments/doctor",
                headers=self._auth_headers(token),
            )
            response.raise_for_status()
            return list(response.json())

    async def cancel_appointment(self, token: str, appointment_id: str, reason: str | None = None) -> dict[str, Any]:
        payload = {"reason": reason or "Cancellation requested via chatbot."}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base_url}/appointments/{appointment_id}/cancel",
                headers=self._auth_headers(token),
                json=payload,
            )
            response.raise_for_status()
            return dict(response.json())

    async def respond_invitation(self, token: str, appointment_id: str, accepted: bool, note: str | None = None) -> dict[str, Any]:
        endpoint = "accept" if accepted else "reject"
        payload = {"note": note or "Processed by chatbot"}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base_url}/appointments/{appointment_id}/{endpoint}",
                headers=self._auth_headers(token),
                json=payload,
            )
            response.raise_for_status()
            return dict(response.json())

    async def invite_appointment(self, token: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base_url}/appointments/invite",
                headers=self._auth_headers(token),
                json=payload,
            )
            response.raise_for_status()
            return dict(response.json())

    async def get_available_slots(
        self,
        token: str,
        doctor_id: str,
        from_utc: str,
        to_utc: str,
        duration_minutes: int = 30,
        insurance_plan: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "FromUtc": from_utc,
            "ToUtc": to_utc,
            "DurationMinutes": duration_minutes,
        }
        if insurance_plan:
            params["InsurancePlan"] = insurance_plan
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self._base_url}/doctors/{doctor_id}/available-slots",
                headers=self._auth_headers(token),
                params=params,
            )
            response.raise_for_status()
            return list(response.json())
