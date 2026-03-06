"""Persist a message for a run — composes existing black-box entry creators.

Chain: write file → create_upload → create_text → create_text_upload
     → create_message → create_message_upload → mark complete.

Replaces the monolith's write_text_file + create_message_with_text_complete.sql
with properly decomposed black boxes.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.message_uploads.create import create_message_upload
from app.routes.v5.tools.entries.messages.create import create_message
from app.routes.v5.tools.entries.messages_completions.create import (
    create_messages_completions_entry_internal,
)
from app.routes.v5.tools.entries.text_uploads.create import create_text_upload
from app.routes.v5.tools.entries.texts.create import create_text
from app.routes.v5.tools.entries.uploads.create import create_upload


async def persist_message(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    session_id: UUID,
    role: str,
    content: str,
    upload_folder: Path | None = None,
) -> UUID:
    """Persist a single message (system/developer/user) for a run.

    Composes black-box entry creators in the correct chain.
    Returns the message_id.

    When upload_folder is None, resolves from globals (production path).
    Pass explicitly for testing.
    """
    if upload_folder is None:
        from app.infra.globals import UPLOAD_FOLDER

        upload_folder = UPLOAD_FOLDER

    # 1. Write text content to disk
    text_dir = upload_folder / "text"
    text_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    filename = f"{file_id}.txt"
    relative_path = f"text/{filename}"
    full_path = text_dir / filename

    data = content.encode("utf-8")
    full_path.write_bytes(data)

    # 2. Create upload record (uploads_entry)
    upload_result = await create_upload(
        conn,
        session_id=session_id,
        file_path=relative_path,
        mime_type="text/plain",
        size=len(data),
    )

    # 3. Create text entry (texts_entry)
    text_result = await create_text(conn, session_id=session_id)

    # 4. Link text ↔ upload (text_uploads_entry)
    await create_text_upload(
        conn,
        text_id=text_result.id,
        upload_id=upload_result.id,
        session_id=session_id,
    )

    # 5. Create message (messages_entry)
    message_result = await create_message(conn, run_id=run_id, role=role)

    # 6. Link message ↔ upload (message_uploads_entry)
    await create_message_upload(
        conn,
        message_id=message_result.id,
        upload_id=upload_result.id,
        session_id=session_id,
    )

    # 7. Mark message as completed (input messages are immediately complete)
    await create_messages_completions_entry_internal(
        conn, message_id=message_result.id, session_id=session_id
    )

    return message_result.id
