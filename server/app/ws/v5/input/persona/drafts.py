"""Input: persona.drafts"""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.drafts import list_persona_drafts_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket

internal_sio = get_internal_sio()


@sio.on("persona.drafts")  # type: ignore
async def persona_drafts(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    profile_id = UUID(profile_id_str)

    await internal_sio.emit("persona.drafts.started", {
        "sid": sid,
        "rooms": [sid],
    })

    try:
        pool = get_pool()
        redis = get_redis_client()

        context = await list_persona_drafts_impl(
            pool,
            redis,
            profile_id=profile_id,
        )

        output = context.model_dump(mode="json") if hasattr(context, "model_dump") else {}

        await internal_sio.emit("persona.drafts.completed", {
            "sid": sid,
            "rooms": [sid],
            **output,
        })
    except Exception as e:
        await internal_sio.emit("persona.drafts.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": type(e).__name__,
        })
