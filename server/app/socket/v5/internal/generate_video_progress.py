"""Video progress — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_events_impl import video_progress_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_video_progress")  # type: ignore
async def handle_video_progress(data: dict[str, Any]) -> None:
    await video_progress_impl(data, emit=make_emit())
