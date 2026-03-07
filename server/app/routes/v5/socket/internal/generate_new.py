"""Rate limit gate for generation pipeline (new).

Replaces internal/generate.py. Uses requests_per_day from profile context
(resolved at client boundary) + runs count from resolve_runs_context.

Differences from generate.py:
  - requests_per_day already in data (resolved at client boundary)
  - Uses resolve_runs_context directly (not full resolve_common_context)
  - No registry fetcher call
  - Identity context (profile_id, profiles_id, session_id, group_id) always in data
  - Audio session continuation logic unchanged

GAPs:
  - TODO: Audio session continuation stays as-is (low priority refactor).
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.session_store import get_session_by_group_id, rotate_run_id
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


# NOTE: Not registered as @internal_sio.on("generate") yet.
# To activate: import and swap registration.
async def generate_handler_new(data: dict[str, Any]) -> None:
    """Rate limit gate — uses requests_per_day from profile context.

    Expects identity context already in data (resolved by client handler):
      profile_id, profiles_id, session_id, group_id, requests_per_day
    """
    sid = data.get("sid", "")
    if not sid:
        return

    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )

    # Identity context — resolved by client handler
    profile_id_str = data.get("profile_id")
    session_id_str = data.get("session_id")
    group_id = data.get("group_id")

    if not profile_id_str:
        await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
        return

    if not session_id_str:
        await _emit_error(sid, "Session not found. Please reconnect.", artifact_type)
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
    except Exception as e:
        await _emit_error(sid, f"Invalid profile_id: {str(e)}", artifact_type)
        return

    # --- Rate limit check ---
    requests_per_day = data.get("requests_per_day")
    if requests_per_day is not None:
        try:
            from app.infra.runs_context import resolve_runs_context

            async with get_db_connection() as conn:
                runs_ctx = await resolve_runs_context(conn, profile_id=profile_id)

            runs_today = runs_ctx.runs.total_count if runs_ctx and runs_ctx.runs else 0
            if runs_today >= requests_per_day:
                error_msg = (
                    f"Rate limit exceeded ({runs_today}/"
                    f"{requests_per_day} requests today)"
                )
                logger.error(
                    f"{artifact_type.capitalize()} generation rate limit exceeded - "
                    f"profile_id={profile_id}, reason: {error_msg}"
                )

                # Audio continuation: stop session on rate limit
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

    # --- Rate limit passed ---

    # Audio session continuation (existing session on group_id)
    if group_id:
        session = get_session_by_group_id(group_id)
        if session:
            new_run_id = str(uuid.uuid4())
            rotate_run_id(session, new_run_id)
            logger.info(
                f"Audio session continuation - group_id={group_id}, "
                f"new_run_id={new_run_id}"
            )
            return

    # Normal generation — forward to generate_prepare
    # data already contains full identity context — propagates through
    await internal_sio.emit("generate_prepare", data)
