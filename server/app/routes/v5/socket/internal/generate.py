"""Rate limit gate for the generation pipeline.

Handles: @internal_sio.on("generate") — the canonical entrypoint for all
generation requests (from client handlers and audio continuation).

Pipeline position:
  "generate" → generate.py (this file, rate limit gate)
    → "generate_prepare" → generate_prepare.py (fetch, render, dispatch)
      → "generate_artifact" → generate_artifact.py (token factory)
        → "generate_run_complete" → generate_complete.py (pricing, save, cleanup)

For audio session continuations (detected by existing session on group_id),
the gate checks the rate limit and rotates the run_id on the session without
emitting "generate_prepare" — the session is already live.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.session_store import get_session_by_group_id, rotate_run_id
from app.routes.v5.socket.client.registry import REGISTRY
from app.routes.v5.socket.client.types import GeneratePayload
from app.routes.v5.socket.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
    *,
    group_id: str | None = None,
) -> None:
    await internal_sio.emit(
        "generate_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            group_id=group_id,
        ).model_dump(),
    )


@internal_sio.on("generate")  # type: ignore
async def generate_handler(data: dict[str, Any]) -> None:
    """Rate limit gate — checks daily limit, then forwards to generate_prepare.

    For audio continuations (existing session on group_id), rotates run_id
    on the session without re-entering the full generation pipeline.
    """
    sid = data.get("sid", "")

    # Derive artifact_type from artifact_types[0].name (canonical path)
    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )

    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePayload(**data)
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
        return

    group_id = data.get("group_id")

    # --- Rate limit check ---

    config = REGISTRY.get(artifact_type)
    if not config or not config.fetcher:
        # No registry config — pass through, generate_prepare will handle the error
        await internal_sio.emit("generate_prepare", data)
        return

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        result: Any = await config.fetcher(
            profile_id, payload.artifact_id, payload.draft_id, pool
        )

        # Extract rate limit values from cached fetcher result
        result_artifacts = getattr(result, "artifacts", None)
        config_profile_list = (
            getattr(result_artifacts, "profile", None) if result_artifacts else None
        )
        config_profile = config_profile_list[0] if config_profile_list else None
        requests_per_day = config_profile.requests_per_day if config_profile else None
        runs_today = (
            result.entries.runs.total_count
            if result.entries and result.entries.runs
            else 0
        )

        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"{artifact_type.capitalize()} generation rate limit exceeded - "
                f"profile_id={profile_id}, reason: {error_msg}"
            )

            # If this is an audio continuation, stop the session
            if group_id:
                session = get_session_by_group_id(group_id)
                if session:
                    await internal_sio.emit(
                        "attempt_error",
                        {
                            "sid": sid,
                            "error_type": "rate_limit",
                            "message": error_msg,
                            "chat_id": session.chat_id,
                        },
                    )
                    await internal_sio.emit(
                        "generate_audio_session_complete",
                        {"group_id": group_id, "sid": sid},
                    )
                    return

            await _emit_error(
                sid,
                f"Failed to prepare {artifact_type} generation: {error_msg}",
                artifact_type,
                group_id=group_id,
            )
            return

    except Exception as e:
        logger.exception(f"Rate limit check failed: {e}")
        # On error, pass through — let generate_prepare handle it
        await internal_sio.emit("generate_prepare", data)
        return

    # --- Rate limit passed ---

    # Check if this is an audio session continuation (existing session on group_id)
    if group_id:
        session = get_session_by_group_id(group_id)
        if session:
            # Audio continuation — rotate run_id, don't re-enter generation pipeline
            new_run_id = str(uuid.uuid4())
            rotate_run_id(session, new_run_id)

            logger.info(
                f"Audio session continuation - group_id={group_id}, "
                f"new_run_id={new_run_id}"
            )
            return

    # Normal generation — forward to generate_prepare
    await internal_sio.emit("generate_prepare", data)
