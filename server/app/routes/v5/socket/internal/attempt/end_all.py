"""Internal handler: attempt_end_all — canonical orchestration entry."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.socket_event import EmitFn, SocketEvent, make_emit
from app.routes.v5.socket.client.types import AttemptEndAllPayload
from app.routes.v5.socket.internal.attempt.proceed import attempt_proceed_internal_impl

internal_sio = get_internal_sio()


class AttemptEndAllInternalResult(BaseModel):
    attempt_id: str
    success: bool
    all_scenarios_complete: bool = False
    message: str | None = None


async def attempt_end_all_internal_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn | None = None,
) -> AttemptEndAllInternalResult:
    """Run canonical attempt end-all orchestration for any surface."""
    sid = data.get("sid", "")
    payload = AttemptEndAllPayload(**data)

    profile_id = data.get("profile_id") or (
        await find_profile_by_socket(sid) if sid else None
    )
    if not profile_id:
        raise ValueError("Missing profile_id for attempt_end_all")

    session_id = data.get("session_id") or (
        await find_session_by_socket(sid) if sid else None
    )
    if not session_id:
        raise ValueError("Missing session_id for attempt_end_all")

    identity = await resolve_profile_identity_context(
        get_pool(),
        UUID(profile_id),
        get_redis_client(),
        session_id=UUID(session_id),
        attempt_id=payload.attempt_id,
    )
    group_id = identity.group_id if identity else None
    if group_id is None:
        raise ValueError(f"Group not found for attempt {payload.attempt_id}")

    downstream_emit = emit or make_emit()
    recorded: list[SocketEvent] = []

    async def _emit(events: list[SocketEvent]) -> None:
        recorded.extend(events)
        await downstream_emit(events)

    await attempt_proceed_internal_impl(
        {
            "sid": sid,
            "profile_id": profile_id,
            "session_id": session_id,
            "attempt_id": str(payload.attempt_id),
            "group_id": str(group_id),
            "complete_all": True,
        },
        emit=_emit,
    )

    for event in recorded:
        if event.bus != "internal":
            continue
        if event.event == "attempt_ended":
            return AttemptEndAllInternalResult(
                attempt_id=event.data.get("attempt_id", ""),
                success=bool(event.data.get("success", False)),
                all_scenarios_complete=bool(
                    event.data.get("all_scenarios_complete", False)
                ),
                message=event.data.get("message"),
            )
        if event.event == "attempt_error":
            raise ValueError(event.data.get("message", "Failed to end attempt"))

    raise ValueError("Attempt end-all completed without a terminal event")


@internal_sio.on("attempt_end_all")  # type: ignore
async def attempt_end_all_handler(data: dict[str, Any]) -> None:
    await attempt_end_all_internal_impl(data)
