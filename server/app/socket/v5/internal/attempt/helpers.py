"""Shared helpers for attempt handlers (proceed)."""

from __future__ import annotations

import uuid

from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import GenerateRequestData


async def emit_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    chat_entry_id: uuid.UUID,
    department_id: uuid.UUID,
    attempt_chat_id: uuid.UUID | None,
    draft_id: uuid.UUID | None = None,
    resource_types: list[str] | None = None,
    user_instructions: list[str] | None = None,
    save: bool = True,
) -> None:
    """Compose with generate by emitting to the internal bus."""
    internal_sio = get_internal_sio()
    resolved_resource_types = resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    await internal_sio.emit(
        "generate",
        GenerateRequestData(
            sid=sid,
            profile_id=str(profile_id),
            artifact_type="chat",
            artifact_id=str(chat_entry_id),
            draft_id=str(draft_id) if draft_id else None,
            resource_types=resolved_resource_types,
            user_instructions=user_instructions,
            save=save,
            attempt_id=str(attempt_id),
            attempt_chat_id=str(attempt_chat_id) if attempt_chat_id else None,
        ).model_dump(mode="json"),
    )
