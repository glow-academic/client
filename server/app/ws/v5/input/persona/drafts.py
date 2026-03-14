"""Input: persona.drafts"""

from typing import Any
from uuid import UUID

from app.infra.events.audit import run_artifact_operation_with_audit
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

    pool = get_pool()
    redis = get_redis_client()

    await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="persona",
        operation="drafts",
        profile_id=profile_id,
        sid=sid,
        rooms=[sid],
        runner=lambda: list_persona_drafts_impl(
            pool,
            redis,
            profile_id=profile_id,
        ),
        arguments={},
    )
