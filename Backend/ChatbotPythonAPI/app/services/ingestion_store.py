from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class IngestionStore:
    def __init__(self):
        self._items: dict[str, dict[str, Any]] = {}

    def create(self) -> str:
        ingestion_id = str(uuid4())
        self._items[ingestion_id] = {
            "status": "processing",
            "detail": "Document ingestion started.",
            "result": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        return ingestion_id

    def update(self, ingestion_id: str, status: str, detail: str | None = None, result: dict[str, Any] | None = None) -> None:
        if ingestion_id not in self._items:
            return
        self._items[ingestion_id]["status"] = status
        self._items[ingestion_id]["detail"] = detail
        self._items[ingestion_id]["result"] = result
        self._items[ingestion_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    def get(self, ingestion_id: str) -> dict[str, Any] | None:
        return self._items.get(ingestion_id)
