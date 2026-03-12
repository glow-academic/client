"""Generic webhook dispatcher over the shared artifact event store."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.events.webhooks import deliver_events_to_webhook, resolve_webhook_target
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.events.shared import resolve_subscription
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
    target_url = resolve_webhook_target(request.license_key)
    if target_url is None:
        raise HTTPException(
            status_code=404,
            detail="No webhook target configured for that license key.",
        )

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
    if operation_config.filter_events is not None:
        events = await operation_config.filter_events(
            http_request.state.profile_id, events
        )

    if events:
        await deliver_events_to_webhook(target_url, events)

    return DispatchWebhookApiResponse(
        success=True,
        delivered_count=len(events),
        target_url=target_url,
        next_cursor=build_event_cursor(events[-1]) if events else request.cursor,
    )
