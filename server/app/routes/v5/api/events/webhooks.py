"""Generic webhook dispatcher over the shared artifact event store."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.events.webhooks import deliver_events_to_webhook, resolve_webhook_target
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.events.registry import get_artifact_events_config
from app.routes.v5.api.events.types import (
    DispatchWebhookApiRequest,
    DispatchWebhookApiResponse,
)

router = APIRouter()


@router.post("/webhooks", response_model=DispatchWebhookApiResponse)
async def dispatch_webhook_events(
    request: DispatchWebhookApiRequest,
    http_request: Request,
) -> DispatchWebhookApiResponse:
    """Dispatch artifact events to a webhook target resolved from a license key."""
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
                "webhook dispatch."
            ),
        )

    target_url = resolve_webhook_target(request.license_key)
    if target_url is None:
        raise HTTPException(
            status_code=404,
            detail="No webhook target configured for that license key.",
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
    if operation.filter_events is not None:
        events = await operation.filter_events(profile_id, events)

    if events:
        await deliver_events_to_webhook(target_url, events)

    return DispatchWebhookApiResponse(
        success=True,
        delivered_count=len(events),
        target_url=target_url,
        next_cursor=build_event_cursor(events[-1]) if events else request.cursor,
    )
