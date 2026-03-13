"""Internal handler: test_progress_update + test_run_done — thin wrappers."""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio
from app.infra.stream.socket_bridge import wrap_emit_with_stream_bridge
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_progress_impl, test_run_done_impl

internal_sio = get_internal_sio()


def _resolve_invocation_id(data: dict[str, Any]) -> UUID | None:
    raw_invocation_id = data.get("invocation_id") or data.get("chat_id")
    if not raw_invocation_id:
        return None
    return UUID(str(raw_invocation_id))


@internal_sio.on("test_progress_update")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    await test_progress_impl(
        data,
        emit=wrap_emit_with_stream_bridge(
            artifact="test",
            operation="run",
            emit=make_emit(),
            entity_id=_resolve_invocation_id(data),
        ),
    )


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    await test_run_done_impl(
        data,
        emit=wrap_emit_with_stream_bridge(
            artifact="test",
            operation="run",
            emit=make_emit(),
            entity_id=_resolve_invocation_id(data),
        ),
    )
