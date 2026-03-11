"""Internal handler: test_start — canonical orchestration entry."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.socket_event import EmitFn, SocketEvent, make_emit
from app.infra.websocket.test_types import TestErrorData
from app.infra.websocket.test_events_impl import test_start_impl
from app.routes.v5.socket.client.types import TestStartPayload
from app.routes.v5.socket.internal.test.proceed import test_proceed_internal_impl

internal_sio = get_internal_sio()


class TestStartInternalResult(BaseModel):
    test_id: str
    invocation_id: str | None = None
    success: bool = True


async def test_start_internal_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn | None = None,
) -> TestStartInternalResult:
    """Run canonical test start orchestration for any surface."""
    payload = TestStartPayload(**data)
    del payload

    profile_id = data.get("profile_id")
    if not profile_id:
        raise ValueError("Missing profile_id for test_start")
    session_id = data.get("session_id")
    if not session_id:
        raise ValueError("Missing session_id for test_start")

    identity = await resolve_profile_identity_context(
        get_pool(),
        UUID(profile_id),
        get_redis_client(),
        session_id=UUID(session_id),
    )
    if not identity or not identity.profiles_id:
        raise ValueError("Profile context not found for test_start")

    downstream_emit = emit or make_emit()
    recorded: list[SocketEvent] = []

    async def _emit(events: list[SocketEvent]) -> None:
        recorded.extend(events)
        await downstream_emit(events)

    await test_start_impl(
        {
            **data,
            "profiles_id": str(identity.profiles_id),
        },
        emit=_emit,
        pool=get_pool(),
        redis=get_redis_client(),
    )

    proceed_events = [
        event
        for event in recorded
        if event.bus == "internal" and event.event == "test_proceed"
    ]
    for event in proceed_events:
        await test_proceed_internal_impl(event.data, emit=_emit)

    for event in recorded:
        if event.bus != "internal":
            continue
        if event.event == "test_started":
            return TestStartInternalResult(
                test_id=event.data.get("test_id", ""),
                invocation_id=event.data.get("invocation_entry_id"),
            )
        if event.event == "test_invocation_started":
            return TestStartInternalResult(
                test_id=event.data.get("test_id", ""),
                invocation_id=event.data.get("test_invocation_id"),
            )
        if event.event == "test_ended":
            return TestStartInternalResult(
                test_id=event.data.get("test_id", ""),
                success=bool(event.data.get("success", True)),
            )
        if event.event == "test_error":
            error = TestErrorData(**event.data)
            raise ValueError(error.message)

    raise ValueError("Test start completed without a terminal event")


@internal_sio.on("test_start")  # type: ignore
async def test_start_handler_new(data: dict[str, Any]) -> None:
    await test_start_internal_impl(data)
