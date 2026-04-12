import os
from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentActor, get_current_actor
from .dependencies import (
    get_chatbot_service,
    get_document_processor,
    get_ingestion_store,
    get_rag_service,
)
from .models import (
    ChatMessageRequest,
    ChatMessageResponse,
    DocumentIngestResponse,
    IngestionStatusResponse,
    RagQueryRequest,
    RagQueryResponse,
)
from .services.chatbot_service import ChatbotService
from .services.document_processor import DocumentProcessor
from .services.ingestion_store import IngestionStore
from .services.rag_service import RagService

app = FastAPI(title="Clinix Chatbot Python API", version="1.0.0")

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins or default_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chatbot/message", response_model=ChatMessageResponse)
async def send_chat_message(
    request: ChatMessageRequest,
    actor: CurrentActor = Depends(get_current_actor),
    chatbot_service: ChatbotService = Depends(get_chatbot_service),
) -> ChatMessageResponse:
    intent, reply, metadata = await chatbot_service.handle_message(
        actor=actor,
        message=request.message,
        patient_id=request.patient_id,
        conversation_id=request.conversation_id,
    )
    return ChatMessageResponse(
        reply=reply,
        intent=intent,
        timestamp=datetime.now(timezone.utc),
        metadata=metadata,
    )


@app.post("/rag/query", response_model=RagQueryResponse)
async def rag_query(
    request: RagQueryRequest,
    actor: CurrentActor = Depends(get_current_actor),
    rag_service: RagService = Depends(get_rag_service),
) -> RagQueryResponse:
    response = await rag_service.ask(
        token=actor.token,
        patient_id=request.patient_id,
        query=request.query,
        top_k=request.top_k,
    )
    return RagQueryResponse(
        answer=response["answer"],
        sources=response["sources"],
        timestamp=datetime.now(timezone.utc),
    )


@app.post("/documents/ingest", response_model=DocumentIngestResponse)
async def ingest_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    appointment_id: str | None = Form(default=None),
    actor: CurrentActor = Depends(get_current_actor),
    processor: DocumentProcessor = Depends(get_document_processor),
    ingestion_store: IngestionStore = Depends(get_ingestion_store),
) -> DocumentIngestResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file is not allowed.")

    ingestion_id = ingestion_store.create()

    async def _run_ingestion() -> None:
        try:
            result = await processor.process_and_store(
                token=actor.token,
                patient_id=patient_id,
                file_name=file.filename or "document",
                content_type=file.content_type or "application/octet-stream",
                file_bytes=file_bytes,
                appointment_id=appointment_id,
            )
            ingestion_store.update(
                ingestion_id=ingestion_id,
                status="completed",
                detail="Document ingested successfully.",
                result=result,
            )
        except Exception as exc:
            ingestion_store.update(
                ingestion_id=ingestion_id,
                status="failed",
                detail=str(exc),
                result=None,
            )

    background_tasks.add_task(_run_ingestion)

    return DocumentIngestResponse(
        ingestion_id=ingestion_id,
        status="processing",
        message="Document ingestion started.",
    )


@app.get("/documents/{ingestion_id}/status", response_model=IngestionStatusResponse)
def ingestion_status(
    ingestion_id: str,
    _actor: CurrentActor = Depends(get_current_actor),
    ingestion_store: IngestionStore = Depends(get_ingestion_store),
) -> IngestionStatusResponse:
    data = ingestion_store.get(ingestion_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Ingestion ID not found.")
    return IngestionStatusResponse(
        ingestion_id=ingestion_id,
        status=str(data["status"]),
        detail=data.get("detail"),
        result=data.get("result"),
    )
