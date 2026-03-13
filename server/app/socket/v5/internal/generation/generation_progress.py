"""Resource/entry progress tracking — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.generation_progress_impl import generation_progress_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_resource_progress_new(data: dict[str, Any]) -> None:
    redis = get_redis_client()
    if not redis:
        return
    await generation_progress_impl(data, emit=make_emit(), redis=redis)
