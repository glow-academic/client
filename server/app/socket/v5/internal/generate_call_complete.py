"""Call complete — thin socket handler."""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio
from app.infra.stream.socket_bridge import wrap_emit_with_stream_bridge
from app.infra.websocket.generation_events_impl import call_complete_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_call_complete(data: dict[str, Any]) -> None:
    metadata = data.get("metadata", {}) or {}
    entity_id = metadata.get("attempt_id")
    await call_complete_impl(
        data,
        emit=wrap_emit_with_stream_bridge(
            artifact="attempt",
            operation="grade",
            emit=make_emit(),
            entity_id=UUID(str(entity_id)) if entity_id else None,
        ),
    )
