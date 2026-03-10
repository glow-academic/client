"""Generic polling endpoint for artifact event streams."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.events.registry import get_artifact_events_config
from app.routes.v5.api.events.types import PollEventsApiRequest, PollEventsApiResponse

router = APIRouter()


@router.post("/poll", response_model=PollEventsApiResponse)
async def poll_events(
    request: PollEventsApiRequest,
    http_request: Request,
) -> PollEventsApiResponse:
    """Validate an artifact event subscription and reserve the delivery shape.

    TODO: Read persisted call/domain events from the canonical store once wired.
    """
    config = get_artifact_events_config(request.artifact)
    if config is None:
        raise HTTPException(
            status_code=404,
            detail=f"No event registry found for artifact '{request.artifact}'.",
        )

    operation = config.get_operation(request.operation)
    if operation is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No event operation '{request.operation}' registered for "
                f"artifact '{request.artifact}'."
            ),
        )

    if operation.scope == "entity" and request.entity_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"entity_id is required for {request.artifact}.{request.operation} "
                "event polling."
            ),
        )

    if request.types:
        invalid = [event_type for event_type in request.types if event_type not in config.event_types]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported event types for {request.artifact}: "
                    + ", ".join(invalid)
                ),
            )

    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    if not profile_id:
        raise HTTPException(
            status_code=401,
            detail="Profile ID is required. Please sign in again.",
        )

    allowed = await operation.can_subscribe(
        get_pool(),
        get_redis_client(),
        profile_id=profile_id,
        entity_id=request.entity_id,
        session_id=session_id,
        event_types=request.types,
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=(
                f"You don't have access to {request.artifact}.{request.operation} "
                "events."
            ),
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
    if operation.filter_events is not None:
        filtered = await operation.filter_events(profile_id, events)

    next_cursor = build_event_cursor(filtered[-1]) if filtered else request.cursor

    return PollEventsApiResponse(
        events=filtered,
        next_cursor=next_cursor,
        previous_cursor=request.cursor,
    )
