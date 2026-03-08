"""Image complete — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_events_impl import image_complete_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_image_complete")  # type: ignore
async def handle_image_complete(data: dict[str, Any]) -> None:
    await image_complete_impl(data, emit=make_emit())
