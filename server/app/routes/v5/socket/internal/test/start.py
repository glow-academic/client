"""Internal handler: test_start — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_start_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_start")  # type: ignore
async def test_start_handler_new(data: dict[str, Any]) -> None:
    await test_start_impl(
        data, emit=make_emit(), pool=get_pool(), redis=get_redis_client()
    )
