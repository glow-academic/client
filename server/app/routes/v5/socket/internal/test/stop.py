"""Internal handler: test_stop — canonical orchestration entry."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.infra.globals import get_internal_sio
from app.infra.websocket.socket_event import EmitFn, SocketEvent, make_emit
from app.routes.v5.socket.client.types import TestStopPayload

internal_sio = get_internal_sio()


class TestStopInternalResult(BaseModel):
    invocation_id: str
    success: bool
    message: str | None = None


async def test_stop_internal_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn | None = None,
) -> TestStopInternalResult:
    """Run canonical test stop orchestration for any surface."""
    payload = TestStopPayload(**data)
    sid = data.get("sid")

    result = TestStopInternalResult(
        invocation_id=str(payload.invocation_id),
        success=True,
        message="Test execution stopped",
    )
    downstream_emit = emit or make_emit()
    await downstream_emit(
        [
            SocketEvent(
                bus="internal",
                event="test_stopped",
                data={
                    "sid": sid,
                    "rooms": [sid, f"test_{payload.invocation_id}"] if sid else [],
                    "invocation_id": str(payload.invocation_id),
                    "success": True,
                    "message": result.message,
                },
            )
        ]
    )
    return result


@internal_sio.on("test_stop")  # type: ignore
async def test_stop_handler(data: dict[str, Any]) -> None:
    await test_stop_internal_impl(data)
