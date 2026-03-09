"""Internal handler: test_run — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_run_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_run")  # type: ignore
async def test_run_handler(data: dict[str, Any]) -> None:
    await test_run_impl(data, emit=make_emit(), pool=get_pool())
