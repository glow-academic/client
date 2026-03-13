"""Canonical live event emission for artifact operations."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.infra.events.store import build_operation_events
from app.infra.stream.hub import publish


async def emit_artifact_operation_events(
    *,
    artifact: str,
    operation: str,
    arguments: dict,
    output: dict,
    entity_id: UUID | None = None,
    call_id: UUID | None = None,
    tool_id: UUID | None = None,
    created_at: datetime | None = None,
) -> None:
    """Project and publish lifecycle + domain events for an artifact operation."""
    events = build_operation_events(
        artifact=artifact,
        operation=operation,
        entity_id=entity_id,
        created_at=created_at or datetime.now(UTC),
        call_id=call_id,
        tool_id=tool_id,
        arguments=arguments,
        output=output,
    )
    for event in events:
        await publish(event)


async def emit_artifact_operation_failure(
    *,
    artifact: str,
    operation: str,
    arguments: dict,
    message: str,
    error_type: str | None = None,
    entity_id: UUID | None = None,
    tool_id: UUID | None = None,
    created_at: datetime | None = None,
) -> None:
    """Publish started + failed lifecycle events for a failed operation."""
    output = {
        "success": False,
        "message": message,
        "error_type": error_type,
        "artifact": artifact,
        "operation": operation,
    }
    await emit_artifact_operation_events(
        artifact=artifact,
        operation=operation,
        arguments=arguments,
        output=output,
        entity_id=entity_id,
        call_id=None,
        tool_id=tool_id,
        created_at=created_at,
    )
