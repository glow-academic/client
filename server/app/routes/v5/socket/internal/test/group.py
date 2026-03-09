"""Internal handler: test_group — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_group_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_group")  # type: ignore
async def test_group_handler(data: dict[str, Any]) -> None:
    await test_group_impl(data, emit=make_emit(), pool=get_pool())
