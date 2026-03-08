"""Internal handler: generate_audio_error — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.attempt_events_impl import audio_error_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_error")  # type: ignore
async def handle_audio_error(data: dict[str, Any]) -> None:
    await audio_error_impl(data, emit=make_emit())
