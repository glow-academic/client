"""Input: persona.delete"""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.delete import delete_persona_impl
from app.infra.persona.types import DeletePersonaApiRequest
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket

internal_sio = get_internal_sio()


@sio.on("persona.delete")  # type: ignore
async def persona_delete(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    session_id_str = await find_session_by_socket(sid)

    profile_id = UUID(profile_id_str)
    session_id = UUID(session_id_str) if session_id_str else None

    try:
        payload = DeletePersonaApiRequest(**data)
    except Exception as e:
        await internal_sio.emit("persona.delete.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": "validation",
        })
        return

    await internal_sio.emit("persona.delete.started", {
        "sid": sid,
        "rooms": [sid],
    })

    try:
        pool = get_pool()
        redis = get_redis_client()

        result = await delete_persona_impl(
            pool,
            redis,
            profile_id=profile_id,
            persona_ids=payload.persona_ids,
            session_id=session_id,
        )

        await internal_sio.emit("persona.delete.completed", {
            "sid": sid,
            "rooms": [sid],
            **result.model_dump(mode="json"),
        })
    except Exception as e:
        await internal_sio.emit("persona.delete.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": type(e).__name__,
        })
