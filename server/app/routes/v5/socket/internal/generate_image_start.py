"""Image start — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_events_impl import image_start_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_image_start")  # type: ignore
async def handle_image_start(data: dict[str, Any]) -> None:
    await image_start_impl(data, emit=make_emit())
