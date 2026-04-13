from typing import Any

import httpx

from ..config import Settings


class UsersClient:
    def __init__(self, settings: Settings):
        self._base_url = settings.users_api_base_url.rstrip("/")

    @staticmethod
    def _auth_headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    async def get_clinical_entries(self, token: str, patient_id: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self._base_url}/patients/{patient_id}/clinical-record/entries",
                headers=self._auth_headers(token),
            )
            response.raise_for_status()
            return list(response.json())

    async def get_doctors(
        self,
        token: str,
        search: str | None = None,
        specialty: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": max(1, min(limit, 100))}
        if search and search.strip():
            params["search"] = search.strip()
        if specialty and specialty.strip():
            params["specialty"] = specialty.strip()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self._base_url}/directory/doctors",
                headers=self._auth_headers(token),
                params=params,
            )
            response.raise_for_status()
            return list(response.json())

    async def create_document_entry(
        self,
        token: str,
        patient_id: str,
        title: str,
        description: str,
        appointment_id: str | None = None,
        appointment_occurred_at: str | None = None,
        visible_to_patient: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "entryType": 1,
            "title": title,
            "description": description,
            "isVisibleToPatient": visible_to_patient,
        }
        if appointment_id:
            payload["appointmentId"] = appointment_id
        if appointment_occurred_at:
            payload["appointmentOccurredAt"] = appointment_occurred_at

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base_url}/patients/{patient_id}/clinical-record/entries",
                headers=self._auth_headers(token),
                json=payload,
            )
            response.raise_for_status()
            return dict(response.json())

    async def upload_document_to_entry(
        self,
        token: str,
        patient_id: str,
        entry_id: str,
        file_name: str,
        content_type: str,
        file_bytes: bytes,
    ) -> dict[str, Any]:
        files = {
            "file": (file_name, file_bytes, content_type),
        }
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self._base_url}/patients/{patient_id}/clinical-record/entries/{entry_id}/documents",
                headers=self._auth_headers(token),
                files=files,
            )
            response.raise_for_status()
            return dict(response.json())
