"""Generation resolution finalization — thin socket handler.

Delegates to generation_ended_impl in infra/websocket/.
"""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.generation_ended_impl import generation_ended_impl
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("test_ended")  # type: ignore
async def handle_generation_ended(data: dict[str, Any]) -> None:
    """Thin socket handler — acquires resources, delegates to impl."""
    redis = get_redis_client()
    if not redis:
        return
    async with get_db_connection() as conn:
        await generation_ended_impl(data, emit=make_emit(), conn=conn, redis=redis)
