"""Generic WebSocket event delivery over the shared artifact event store."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.events.shared import resolve_subscription

router = APIRouter()


@router.websocket("/ws")
async def websocket_events(
    websocket: WebSocket,
    artifact: str = Query(...),
    operation: str = Query(...),
    entity_id: UUID | None = Query(default=None),
    cursor: str | None = Query(default=None),
    types: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> None:
    """Deliver artifact events over a persistent WebSocket connection.

    Connects to the same event store as poll/SSE/webhooks but pushes
    events to the client in real time over a single long-lived connection.

    Auth is resolved from query parameters because standard browser
    WebSocket APIs cannot set custom HTTP headers during the handshake.
    """
    await websocket.accept()

    # Browser WebSocket API cannot set custom headers — read auth from
    # query params (same as entity_id / artifact / operation).
    profile_id_raw = websocket.query_params.get("profile_id")
    session_id_raw = websocket.query_params.get("session_id")

    profile_id = UUID(profile_id_raw) if profile_id_raw else None
    session_id = UUID(session_id_raw) if session_id_raw else None
    event_types = types.split(",") if types else None

    try:
        _, operation_config = await resolve_subscription(
            artifact=artifact,
            operation=operation,
            entity_id=entity_id,
            profile_id=profile_id,
            session_id=session_id,
            event_types=event_types,
        )
    except HTTPException as exc:
        await websocket.send_json({"error": exc.detail, "code": exc.status_code})
        await websocket.close(code=1008)
        return

    current_cursor = cursor
    try:
        while True:
            events = await read_artifact_events(
                get_pool(),
                get_redis_client(),
                artifact=artifact,
                operation=operation,
                entity_id=entity_id,
                cursor=current_cursor,
                event_types=event_types,
                limit=limit,
            )
            if operation_config.filter_events is not None:
                events = await operation_config.filter_events(profile_id, events)

            for event in events:
                current_cursor = build_event_cursor(event)
                await websocket.send_json(event.model_dump(mode="json"))

            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
