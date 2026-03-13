"""Generation error — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_events_impl import generation_error_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
@internal_sio.on("generate_error")  # type: ignore
async def handle_generation_error(data: dict[str, Any]) -> None:
    await generation_error_impl(data, emit=make_emit())
