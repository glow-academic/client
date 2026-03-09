"""Run completion — thin socket handler.

Delegates to run_complete_impl in infra/websocket/.
"""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.websocket.run_complete_impl import run_complete_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_run_complete")  # type: ignore
async def handle_run_complete_new(data: dict[str, Any]) -> None:
    """Thin socket handler — acquires resources, delegates to impl."""
    redis = get_redis_client()
    if not redis:
        return
    await run_complete_impl(data, emit=make_emit(), pool=get_pool(), redis=redis)
