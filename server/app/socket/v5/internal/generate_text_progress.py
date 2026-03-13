"""Text progress — thin socket handler."""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio
from app.infra.stream.socket_bridge import wrap_emit_with_stream_bridge
from app.infra.websocket.generation_events_impl import text_progress_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_text_progress(data: dict[str, Any]) -> None:
    entity_id = data.get("metadata", {}).get("chat_id")
    await text_progress_impl(
        data,
        emit=wrap_emit_with_stream_bridge(
            artifact="attempt",
            operation="message",
            emit=make_emit(),
            entity_id=UUID(str(entity_id)) if entity_id else None,
        ),
    )
