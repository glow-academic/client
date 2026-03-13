"""Shared helpers for outbound socket server event delivery."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.infra.stream.hub import publish
from app.infra.stream.types import EventEnvelope


async def publish_live_socket_event(
    *,
    public_event_type: str,
    artifact: str,
    operation: str,
    payload: dict,
    entity_id: UUID | None = None,
) -> None:
    """Publish a socket-originated domain event to the live SSE hub."""
    await publish(
        EventEnvelope(
            id=f"{uuid4()}:{public_event_type}",
            event_type=public_event_type,
            artifact=artifact,
            operation=operation,
            created_at=datetime.now(UTC),
            entity_id=entity_id,
            payload=payload,
        )
    )
