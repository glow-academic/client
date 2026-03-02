"""File writer utility — writes content to disk and creates uploads_entry records.

Provides `write_text_file()` and `write_json_file()` that:
1. Write content to UPLOAD_FOLDER/{subdir}/{uuid}.{ext}
2. INSERT INTO uploads_entry with file_path, mime_type, size
3. Return the new upload_id for FK usage
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore

from app.main import UPLOAD_FOLDER

# Sub-directories under UPLOAD_FOLDER
TEXT_FOLDER = UPLOAD_FOLDER / "text"
TEXT_FOLDER.mkdir(parents=True, exist_ok=True)

CALL_FOLDER = UPLOAD_FOLDER / "call"
CALL_FOLDER.mkdir(parents=True, exist_ok=True)

FILE_FOLDER = UPLOAD_FOLDER / "file"
FILE_FOLDER.mkdir(parents=True, exist_ok=True)


async def _create_upload_record(
    conn: asyncpg.Connection,
    relative_path: str,
    mime_type: str,
    size: int,
    session_id: UUID | None = None,
) -> UUID:
    """INSERT INTO uploads_entry and return the new id."""
    row = await conn.fetchrow(
        """
        INSERT INTO uploads_entry (file_path, mime_type, size, session_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        relative_path,
        mime_type,
        size,
        session_id,
    )
    return row["id"]  # type: ignore[index,no-any-return]


def read_text_file(file_path: str) -> str:
    """Read text content from an upload file path."""
    full_path = UPLOAD_FOLDER / file_path
    return full_path.read_text(encoding="utf-8")


async def write_text_file(
    conn: asyncpg.Connection,
    session_id: UUID | None,
    content: str,
) -> UUID:
    """Write a .txt file and create an uploads_entry record.

    Returns the upload_id (uploads_entry.id).
    """
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.txt"
    relative_path = f"text/{filename}"
    full_path = TEXT_FOLDER / filename

    data = content.encode("utf-8")
    full_path.write_bytes(data)

    return await _create_upload_record(
        conn,
        relative_path=relative_path,
        mime_type="text/plain",
        size=len(data),
        session_id=session_id,
    )


async def write_json_file(
    conn: asyncpg.Connection,
    session_id: UUID | None,
    data: dict[str, Any] | list[Any],
    *,
    subdir: str = "call",
) -> UUID:
    """Write a .json file and create an uploads_entry record.

    Args:
        conn: Database connection.
        session_id: Infrastructure session id.
        data: JSON-serializable payload.
        subdir: Sub-directory under UPLOAD_FOLDER (default "call").

    Returns the upload_id (uploads_entry.id).
    """
    folder = UPLOAD_FOLDER / subdir
    folder.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    filename = f"{file_id}.json"
    relative_path = f"{subdir}/{filename}"
    full_path = folder / filename

    raw = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    full_path.write_bytes(raw)

    return await _create_upload_record(
        conn,
        relative_path=relative_path,
        mime_type="application/json",
        size=len(raw),
        session_id=session_id,
    )
