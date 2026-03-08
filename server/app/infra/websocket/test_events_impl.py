"""Test event translators — pure business logic with emit: EmitFn.

Each function receives raw event data and emits a translated event.
"""

from __future__ import annotations

from typing import Any

from app.infra.websocket.socket_event import EmitFn, internal_event


# ---------------------------------------------------------------------------
# test_error_event → test_error
# ---------------------------------------------------------------------------


async def test_error_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate test_error_event → test_error."""
    from app.infra.websocket.test_types import TestErrorData

    invocation_id = data.get("invocation_id") or data.get("chat_id")
    message = data.get("error_message") or data.get("message", "Test error")
    sid = data.get("sid")
    invocation_id_str = str(invocation_id) if invocation_id else None
    rooms = (
        [sid, f"test_{invocation_id_str}"]
        if sid and invocation_id_str
        else ([sid] if sid else [])
    )

    await emit([
        internal_event(
            "test_error",
            TestErrorData(
                sid=sid,
                rooms=rooms,
                invocation_id=invocation_id_str,
                run_id=str(data.get("run_id")) if data.get("run_id") else None,
                message=message,
                error_type=data.get("error_type"),
            ).model_dump(mode="json"),
        )
    ])
