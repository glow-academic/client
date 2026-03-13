"""Internal handler: test_error_event — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_error_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_error_event")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    await test_error_impl(data, emit=make_emit())
