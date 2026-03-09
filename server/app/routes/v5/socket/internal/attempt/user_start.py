"""Internal handler: attempt_user_received_start — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.attempt_events_impl import user_start_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("attempt_user_received_start")  # type: ignore
async def handle_user_received_start(data: dict[str, Any]) -> None:
    pool = get_pool()
    await user_start_impl(data, emit=make_emit(), pool=pool)
