import hashlib
import logging
from typing import Any

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

from ..config import Settings
from .openai_client import OpenAIClient
from .users_client import UsersClient

logger = logging.getLogger(__name__)


class Embedder:
    def __init__(self, model_name: str):
        self._model_name = model_name
        self._model: SentenceTransformer | None = None
        try:
            self._model = SentenceTransformer(model_name)
        except Exception as exc:  # pragma: no cover
            logger.warning("Embedding model fallback enabled: %s", exc)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._model is not None:
            prefixed = [f"passage: {text}" for text in texts]
            encoded = self._model.encode(prefixed, normalize_embeddings=True)
            return [vector.tolist() for vector in encoded]
        return [self._fallback_embedding(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        if self._model is not None:
            encoded = self._model.encode([f"query: {text}"], normalize_embeddings=True)
            return encoded[0].tolist()
        return self._fallback_embedding(text)

    @staticmethod
    def _fallback_embedding(text: str, dimensions: int = 384) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values = []
        for index in range(dimensions):
            byte = digest[index % len(digest)]
            values.append((byte / 255.0) * 2 - 1)
        return values


class RagService:
    def __init__(self, settings: Settings, users_client: UsersClient, openai_client: OpenAIClient):
        self._users_client = users_client
        self._openai_client = openai_client
        self._top_k = settings.rag_top_k
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap,
        )
        self._embedder = Embedder(settings.embedding_model_name)
        client = chromadb.PersistentClient(path=settings.chroma_persist_path)
        self._collection = client.get_or_create_collection(settings.chroma_collection_name)

    def index_text(self, patient_id: str, source_id: str, source_type: str, text: str, metadata: dict[str, Any] | None = None) -> int:
        chunks = self._splitter.split_text(text)
        if not chunks:
            return 0

        embeddings = self._embedder.embed_documents(chunks)
        base_metadata = metadata.copy() if metadata else {}
        base_metadata["patient_id"] = patient_id
        base_metadata["source_id"] = source_id
        base_metadata["source_type"] = source_type

        ids: list[str] = []
        metadatas: list[dict[str, Any]] = []
        for index, _ in enumerate(chunks):
            ids.append(f"{source_id}:{index}")
            current_metadata = base_metadata.copy()
            current_metadata["chunk_index"] = index
            metadatas.append(current_metadata)

        self._collection.upsert(
            ids=ids,
            documents=chunks,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        return len(chunks)

    async def ask(self, token: str, patient_id: str, query: str, top_k: int | None = None) -> dict[str, Any]:
        query_embedding = self._embedder.embed_query(query)
        limit = top_k or self._top_k
        result = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where={"patient_id": patient_id},
        )

        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]

        entries = await self._users_client.get_clinical_entries(token, patient_id)
        structured_context = "\n".join(
            f"- {entry.get('title', 'Sem título')}: {entry.get('description', '')[:220]}"
            for entry in entries[:5]
        )

        unstructured_context = "\n".join(
            f"- {doc}" for doc in documents
        )

        prompt = (
            "Você é um assistente clínico do sistema Clinix.\n"
            "Responda com objetividade e sem inventar informações.\n"
            "Se faltar dado, diga claramente.\n\n"
            f"Pergunta: {query}\n\n"
            f"Contexto estruturado:\n{structured_context or '- (sem dados)'}\n\n"
            f"Contexto RAG:\n{unstructured_context or '- (sem dados)'}\n"
        )
        answer = await self._openai_client.generate_text(prompt=prompt)
        sources = []
        for index, metadata in enumerate(metadatas):
            source = dict(metadata)
            source["excerpt"] = documents[index][:250] if index < len(documents) else ""
            sources.append(source)
        return {"answer": answer, "sources": sources}
