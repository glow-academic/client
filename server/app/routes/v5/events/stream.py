"""Generic SSE event stream over the shared artifact event store."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.events.shared import resolve_subscription

router = APIRouter()


@router.get("/")
async def stream_events(
    http_request: Request,
    artifact: str = Query(...),
    operation: str = Query(...),
    entity_id: UUID | None = Query(default=None),
    cursor: str | None = Query(default=None),
    types: list[str] | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> StreamingResponse:
    """Stream artifact events via SSE using the centralized declaration registry."""
    _, operation_config = await resolve_subscription(
        artifact=artifact,
        operation=operation,
        entity_id=entity_id,
        profile_id=http_request.state.profile_id,
        session_id=http_request.state.session_id,
        event_types=types,
    )

    profile_id = http_request.state.profile_id

    async def _gen():
        current_cursor = cursor
        while True:
            events = await read_artifact_events(
                get_pool(),
                get_redis_client(),
                artifact=artifact,
                operation=operation,
                entity_id=entity_id,
                cursor=current_cursor,
                event_types=types,
                limit=limit,
            )
            if operation_config.filter_events is not None:
                events = await operation_config.filter_events(profile_id, events)

            if events:
                for event in events:
                    current_cursor = build_event_cursor(event)
                    yield f"id: {event.id}\n"
                    yield f"event: {event.event_type}\n"
                    yield f"data: {event.model_dump_json()}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(1.0)

    return StreamingResponse(_gen(), media_type="text/event-stream")
