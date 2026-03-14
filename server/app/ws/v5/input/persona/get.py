"""Input: persona.get"""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.get import get_persona_impl
from app.infra.persona.types import GetPersonaApiRequest
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket

internal_sio = get_internal_sio()


@sio.on("persona.get")  # type: ignore
async def persona_get(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    session_id_str = await find_session_by_socket(sid)

    profile_id = UUID(profile_id_str)
    session_id = UUID(session_id_str) if session_id_str else None

    try:
        payload = GetPersonaApiRequest(**data)
    except Exception as e:
        await internal_sio.emit("persona.get.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": "validation",
        })
        return

    await internal_sio.emit("persona.get.started", {
        "sid": sid,
        "rooms": [sid],
        **payload.model_dump(mode="json"),
    })

    try:
        pool = get_pool()
        redis = get_redis_client()

        result = await get_persona_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            persona_id=payload.persona_id,
            draft_id=payload.draft_id,
            parameter_ids=[UUID(pid) for pid in payload.parameter_ids]
            if payload.parameter_ids
            else None,
            color_search=payload.color_search,
            icon_search=payload.icon_search,
            descriptions_search=payload.descriptions_search,
            instructions_search=payload.instructions_search,
            color_show_selected=payload.color_show_selected,
            icon_show_selected=payload.icon_show_selected,
        )

        await internal_sio.emit("persona.get.completed", {
            "sid": sid,
            "rooms": [sid],
            **result.model_dump(mode="json"),
        })
    except Exception as e:
        await internal_sio.emit("persona.get.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": type(e).__name__,
        })
