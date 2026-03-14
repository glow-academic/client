"""Input: persona.draft"""

from typing import Any
from uuid import UUID

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.persona.draft import patch_persona_draft_impl
from app.infra.persona.types import PatchPersonaDraftApiRequest
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket

internal_sio = get_internal_sio()


@sio.on("persona.draft")  # type: ignore
async def persona_draft(sid: str, data: dict[str, Any]) -> None:
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    session_id_str = await find_session_by_socket(sid)

    profile_id = UUID(profile_id_str)
    session_id = UUID(session_id_str) if session_id_str else None

    try:
        payload = PatchPersonaDraftApiRequest(**data)
    except Exception as e:
        await internal_sio.emit("persona.draft.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": str(e),
            "error_type": "validation",
        })
        return

    if session_id is None:
        await internal_sio.emit("persona.draft.failed", {
            "sid": sid,
            "rooms": [sid],
            "message": "Session ID is required for draft operations",
            "error_type": "ValueError",
        })
        return

    pool = get_pool()
    redis = get_redis_client()

    await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="persona",
        operation="draft",
        profile_id=profile_id,
        session_id=session_id,
        sid=sid,
        rooms=[sid],
        runner=lambda: patch_persona_draft_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            request=payload,
        ),
        arguments=payload.model_dump(mode="json"),
    )
