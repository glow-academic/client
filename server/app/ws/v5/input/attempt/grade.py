"""Input: attempt.grade"""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.identity.socket import resolve_socket_identity
from app.socket.v5.internal.attempt.grade import attempt_grade_internal_impl

internal_sio = get_internal_sio()


@sio.on("attempt.grade")  # type: ignore
async def attempt_grade(sid: str, data: dict[str, Any]) -> None:
    identity = await resolve_socket_identity(sid)
    if not identity:
        return

    try:
        await attempt_grade_internal_impl({
            **data,
            "sid": sid,
            "profile_id": str(identity.profile_id),
            "session_id": str(identity.session_id),
        })
    except Exception as e:
        await internal_sio.emit("attempt.grade.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": type(e).__name__,
        })
