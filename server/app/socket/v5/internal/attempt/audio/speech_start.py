"""Internal handler: generate_audio_user_speech_start — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.attempt_events_impl import audio_speech_start_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_start")  # type: ignore
async def handle_user_speech_start(data: dict[str, Any]) -> None:
    await audio_speech_start_impl(data, emit=make_emit())
