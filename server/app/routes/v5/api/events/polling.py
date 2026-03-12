"""Generic polling endpoint for artifact event streams."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.events.shared import resolve_subscription
from app.routes.v5.api.events.types import PollEventsApiRequest, PollEventsApiResponse

router = APIRouter()


@router.post("/poll", response_model=PollEventsApiResponse)
async def poll_events(
    request: PollEventsApiRequest,
    http_request: Request,
) -> PollEventsApiResponse:
    """Poll for artifact events from the canonical event store."""
    _, operation_config = await resolve_subscription(
        artifact=request.artifact,
        operation=request.operation,
        entity_id=request.entity_id,
        profile_id=http_request.state.profile_id,
        session_id=http_request.state.session_id,
        event_types=request.types,
    )

    events = await read_artifact_events(
        get_pool(),
        get_redis_client(),
        artifact=request.artifact,
        operation=request.operation,
        entity_id=request.entity_id,
        cursor=request.cursor,
        event_types=request.types,
        limit=request.limit,
    )

    filtered = events
    if operation_config.filter_events is not None:
        filtered = await operation_config.filter_events(
            http_request.state.profile_id, events
        )

    next_cursor = build_event_cursor(filtered[-1]) if filtered else request.cursor

    return PollEventsApiResponse(
        events=filtered,
        next_cursor=next_cursor,
        previous_cursor=request.cursor,
    )
