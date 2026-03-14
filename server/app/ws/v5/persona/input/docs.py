"""Input: persona.docs"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.docs import docs_persona_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket

internal_sio = get_internal_sio()


class PersonaDocsPayload(BaseModel):
    """Payload for persona.docs socket event."""

    entity_id: UUID | None = Field(None)


@sio.on("persona.docs")  # type: ignore
async def persona_docs(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    profile_id = UUID(profile_id_str)

    try:
        payload = PersonaDocsPayload(**data)
    except Exception as e:
        await internal_sio.emit("persona.docs.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": "validation",
        })
        return

    await internal_sio.emit("persona.docs.started", {
        "sid": sid,
        "rooms": [sid],
    })

    try:
        pool = get_pool()
        redis = get_redis_client()

        result = await docs_persona_impl(
            pool,
            redis,
            profile_id=profile_id,
            entity_id=payload.entity_id,
        )

        await internal_sio.emit("persona.docs.completed", {
            "sid": sid,
            "rooms": [sid],
            **result.model_dump(mode="json"),
        })
    except Exception as e:
        await internal_sio.emit("persona.docs.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": type(e).__name__,
        })
