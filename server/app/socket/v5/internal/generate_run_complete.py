"""Run completion — thin socket handler.

Delegates to run_complete_impl in infra/websocket/.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.stream.socket_bridge import wrap_emit_with_stream_bridge
from app.infra.websocket.run_complete_impl import run_complete_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_run_complete")  # type: ignore
async def handle_run_complete_new(data: dict[str, Any]) -> None:
    """Thin socket handler — acquires resources, delegates to impl."""
    redis = get_redis_client()
    if not redis:
        return
    metadata = data.get("metadata", {}) or {}
    operation = None
    entity_id = None
    if metadata.get("grade_id"):
        operation = "grade"
        entity_id = metadata.get("attempt_id")
    elif metadata.get("attempt_chat_id"):
        operation = "start"
        entity_id = metadata.get("attempt_id")

    emit = make_emit()
    if operation is not None:
        emit = wrap_emit_with_stream_bridge(
            artifact="attempt",
            operation=operation,
            emit=emit,
            entity_id=UUID(str(entity_id)) if entity_id else None,
        )
    pool = get_pool()
    async with pool.acquire() as conn:
        await run_complete_impl(data, emit=emit, conn=conn, redis=redis)
