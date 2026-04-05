import json
from io import BytesIO
from typing import Any

import fitz
from pypdf import PdfReader

from .openai_client import OpenAIClient
from .rag_service import RagService
from .users_client import UsersClient


class DocumentProcessor:
    def __init__(self, users_client: UsersClient, rag_service: RagService, openai_client: OpenAIClient):
        self._users_client = users_client
        self._rag_service = rag_service
        self._openai_client = openai_client

    async def process_and_store(
        self,
        token: str,
        patient_id: str,
        file_name: str,
        content_type: str,
        file_bytes: bytes,
        appointment_id: str | None = None,
    ) -> dict[str, Any]:
        raw_text = await self._extract_text(file_name, content_type, file_bytes)
        structured = await self._extract_structured_information(raw_text)
        entry_title = structured.get("title") or f"Documento: {file_name}"
        entry_description = structured.get("summary") or raw_text[:1200]

        entry = await self._users_client.create_document_entry(
            token=token,
            patient_id=patient_id,
            title=entry_title[:240],
            description=entry_description[:3900],
            appointment_id=appointment_id,
            visible_to_patient=True,
        )

        uploaded_document = await self._users_client.upload_document_to_entry(
            token=token,
            patient_id=patient_id,
            entry_id=str(entry["id"]),
            file_name=file_name,
            content_type=content_type,
            file_bytes=file_bytes,
        )

        chunk_count = self._rag_service.index_text(
            patient_id=patient_id,
            source_id=str(uploaded_document["id"]),
            source_type="clinical_document",
            text=raw_text,
            metadata={
                "entry_id": str(entry["id"]),
                "file_name": file_name,
                "content_type": content_type,
            },
        )

        return {
            "entry_id": str(entry["id"]),
            "document_id": str(uploaded_document["id"]),
            "chunk_count": chunk_count,
            "summary": structured.get("summary"),
            "key_findings": structured.get("key_findings", []),
        }

    async def _extract_text(self, file_name: str, content_type: str, file_bytes: bytes) -> str:
        lowered = file_name.lower()
        if content_type == "application/pdf" or lowered.endswith(".pdf"):
            extracted = self._extract_pdf_text(file_bytes)
            if len(extracted.strip()) >= 120:
                return extracted
            return await self._ocr_pdf_with_vision(file_bytes)

        if content_type.startswith("image/") or lowered.endswith((".png", ".jpg", ".jpeg", ".webp")):
            prompt = (
                "Extraia o texto do documento medico da imagem. "
                "Preserve o maximo de informacoes numericas e termos clinicos."
            )
            return await self._openai_client.vision_ocr(file_bytes, prompt)

        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return "Nao foi possivel extrair texto deste formato de arquivo."

    @staticmethod
    def _extract_pdf_text(file_bytes: bytes) -> str:
        reader = PdfReader(BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages)

    async def _ocr_pdf_with_vision(self, file_bytes: bytes) -> str:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages_text: list[str] = []
        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
            image_bytes = pix.tobytes("png")
            prompt = (
                "Extraia todo o texto medico visivel desta pagina de PDF digitalizado. "
                "Mantenha nomes de medicamentos, dosagens, datas e resultados."
            )
            page_text = await self._openai_client.vision_ocr(image_bytes, prompt)
            pages_text.append(page_text)
        return "\n".join(pages_text)

    async def _extract_structured_information(self, raw_text: str) -> dict[str, Any]:
        prompt = (
            "Transforme o texto medico em JSON.\n"
            "Formato exato:\n"
            '{"title":"", "summary":"", "key_findings":[""], "document_type":"prescription|exam|report|other"}\n\n'
            f"Texto:\n{raw_text[:8000]}"
        )
        response = await self._openai_client.generate_text(prompt)
        parsed = self._parse_json(response)
        if parsed:
            return parsed
        return {
            "title": "Documento clinico",
            "summary": raw_text[:1200],
            "key_findings": [],
            "document_type": "other",
        }

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any] | None:
        text = text.strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end < start:
            return None
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
        return data if isinstance(data, dict) else None
