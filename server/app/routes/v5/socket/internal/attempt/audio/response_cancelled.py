"""Internal handler: generate_audio_response_cancelled — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.attempt_events_impl import audio_response_cancelled_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_response_cancelled")  # type: ignore
async def handle_response_cancelled(data: dict[str, Any]) -> None:
    await audio_response_cancelled_impl(data, emit=make_emit())
