from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import psycopg
from psycopg import sql


class ChatMemoryStore:
    def __init__(self, postgres_dsn: str, history_window: int = 12, schema: str = "chatbot"):
        self._postgres_dsn = self._normalize_dsn(postgres_dsn)
        self._history_window = history_window
        self._schema = (schema or "").strip() or "chatbot"
        self._prepare_database()

    def resolve_conversation_id(self, conversation_id: str | None) -> str:
        if conversation_id and conversation_id.strip():
            return conversation_id.strip()
        return str(uuid4())

    def ensure_conversation(self, conversation_id: str, user_id: str, patient_id: str | None) -> None:
        now = self._utc_now()
        with self._connect() as conn:
            conn.execute(
                sql.SQL(
                    """
                INSERT INTO {chat_conversations} (conversation_id, user_id, patient_id, summary, created_at, updated_at)
                VALUES (%s, %s, %s, '', %s, %s)
                ON CONFLICT(conversation_id) DO UPDATE SET
                    user_id=EXCLUDED.user_id,
                    patient_id=COALESCE(EXCLUDED.patient_id, {chat_conversations}.patient_id),
                    updated_at=EXCLUDED.updated_at
                    """
                ).format(chat_conversations=self._chat_conversations()),
                (conversation_id, user_id, patient_id, now, now),
            )

    def get_history(self, conversation_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        current_limit = limit or self._history_window
        with self._connect() as conn:
            rows = conn.execute(
                sql.SQL(
                    """
                SELECT sender, content, created_at
                FROM {chat_messages}
                WHERE conversation_id = %s
                ORDER BY id DESC
                LIMIT %s
                    """
                ).format(chat_messages=self._chat_messages()),
                (conversation_id, current_limit),
            ).fetchall()
        rows.reverse()
        history: list[dict[str, Any]] = []
        for row in rows:
            created_at = row[2]
            history.append(
                {
                    "sender": row[0],
                    "content": row[1],
                    "created_at": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
                }
            )
        return history

    def append_message(self, conversation_id: str, sender: str, content: str) -> None:
        now = self._utc_now()
        with self._connect() as conn:
            conn.execute(
                sql.SQL(
                    """
                INSERT INTO {chat_messages} (conversation_id, sender, content, created_at)
                VALUES (%s, %s, %s, %s)
                    """
                ).format(chat_messages=self._chat_messages()),
                (conversation_id, sender, content, now),
            )
            conn.execute(
                sql.SQL(
                    """
                UPDATE {chat_conversations}
                SET updated_at = %s
                WHERE conversation_id = %s
                    """
                ).format(chat_conversations=self._chat_conversations()),
                (now, conversation_id),
            )

    def get_summary(self, conversation_id: str) -> str:
        with self._connect() as conn:
            row = conn.execute(
                sql.SQL(
                    """
                SELECT summary
                FROM {chat_conversations}
                WHERE conversation_id = %s
                    """
                ).format(chat_conversations=self._chat_conversations()),
                (conversation_id,),
            ).fetchone()
        if row is None:
            return ""
        return str(row[0] or "")

    def update_summary(self, conversation_id: str, summary: str) -> None:
        now = self._utc_now()
        with self._connect() as conn:
            conn.execute(
                sql.SQL(
                    """
                UPDATE {chat_conversations}
                SET summary = %s, updated_at = %s
                WHERE conversation_id = %s
                    """
                ).format(chat_conversations=self._chat_conversations()),
                (summary, now, conversation_id),
            )

    def _prepare_database(self) -> None:
        with self._connect() as conn:
            conn.execute(
                sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(self._schema))
            )
            conn.execute(
                sql.SQL(
                    """
                CREATE TABLE IF NOT EXISTS {chat_conversations} (
                    conversation_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    patient_id TEXT NULL,
                    summary TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                    """
                ).format(chat_conversations=self._chat_conversations())
            )
            conn.execute(
                sql.SQL(
                    """
                CREATE TABLE IF NOT EXISTS {chat_messages} (
                    id BIGSERIAL PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    CONSTRAINT fk_chat_messages_conversation
                        FOREIGN KEY (conversation_id) REFERENCES {chat_conversations} (conversation_id)
                        ON DELETE CASCADE
                )
                    """
                ).format(
                    chat_messages=self._chat_messages(),
                    chat_conversations=self._chat_conversations(),
                )
            )
            conn.execute(
                sql.SQL(
                    """
                CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
                ON {chat_messages} (conversation_id, id)
                    """
                ).format(chat_messages=self._chat_messages())
            )

    def _chat_conversations(self) -> sql.Composed:
        return sql.SQL("{}.{}").format(sql.Identifier(self._schema), sql.Identifier("chat_conversations"))

    def _chat_messages(self) -> sql.Composed:
        return sql.SQL("{}.{}").format(sql.Identifier(self._schema), sql.Identifier("chat_messages"))

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self._postgres_dsn)

    @staticmethod
    def _normalize_dsn(raw_dsn: str) -> str:
        value = (raw_dsn or "").strip().strip('"').strip("'")
        if not value:
            raise ValueError("CHAT_MEMORY_POSTGRES_DSN or DB_CONNECTION must be configured for ChatMemoryStore.")

        # Accept both PostgreSQL URI and .NET/Npgsql style strings.
        if "://" in value:
            return value

        if ";" not in value:
            return value

        key_map = {
            "host": "host",
            "server": "host",
            "port": "port",
            "database": "dbname",
            "dbname": "dbname",
            "username": "user",
            "userid": "user",
            "user": "user",
            "password": "password",
            "pwd": "password",
            "sslmode": "sslmode",
        }

        tokens: list[str] = []
        for chunk in value.split(";"):
            if "=" not in chunk:
                continue
            key, raw_value = chunk.split("=", 1)
            normalized = key.lower().replace(" ", "").replace("_", "")
            mapped_key = key_map.get(normalized)
            if not mapped_key:
                continue
            clean_value = raw_value.strip()
            if not clean_value:
                continue
            if mapped_key == "sslmode":
                # psycopg/libpq expects lowercase values (e.g. require, disable, prefer).
                clean_value = clean_value.lower()
            tokens.append(f"{mapped_key}={clean_value}")

        if tokens:
            return " ".join(tokens)
        return value

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)
