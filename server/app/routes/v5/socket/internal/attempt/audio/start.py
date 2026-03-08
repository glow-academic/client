"""Internal handler: generate_audio_session_start — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.attempt_events_impl import audio_session_start_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_session_start")  # type: ignore
async def handle_audio_session_start(data: dict[str, Any]) -> None:
    await audio_session_start_impl(data, emit=make_emit())
