"""Client-facing attempt_audio_start handler.

Handles: attempt_audio_start — start a voice session for an attempt chat.

Flow:
1. Resolve group_id from attempt_chat_entry
2. Create run + profile link (config created by internal/generate.py)
3. Emit to generate pipeline with modality="audio"
"""

import uuid
from typing import Any

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import AttemptAudioStartPayload
from app.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    GenerateRequestData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start — create run, emit generate with modality=audio."""
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        chat_id = payload.chat_id

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        async with get_db_connection() as conn:
            # Step 1: Resolve group_id + attempt_id from attempt_chat_entry
            row = await conn.fetchrow(
                """SELECT ac.group_id, b.attempt_id
                FROM attempt_chat_entry ac
                JOIN attempt_chat_bridge_entry b ON b.attempt_chat_id = ac.id
                WHERE ac.id = $1
                LIMIT 1""",
                chat_id,
            )

            if not row or not row["group_id"]:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="audio",
                        message="No group found for chat",
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
                return

            group_id = row["group_id"]
            attempt_id = row["attempt_id"]

            # Step 2: Create run + profile link
            run_id = await conn.fetchval(
                """INSERT INTO runs_entry (group_id)
                VALUES ($1) RETURNING id""",
                group_id,
            )

            await conn.execute(
                """INSERT INTO profiles_runs_connection (profiles_id, run_id)
                SELECT ppj.profiles_id, $2
                FROM profile_profiles_junction ppj
                WHERE ppj.profile_id = $1
                LIMIT 1""",
                profile_id,
                run_id,
            )

            # Step 3: Create conversations_entry
            conversation_id = await conn.fetchval(
                """INSERT INTO conversations_entry (chat_id, run_id)
                VALUES ($1, $2) RETURNING id""",
                chat_id,
                run_id,
            )

        # Step 4: Emit to generate pipeline with modality=audio
        resource_types = ["contents", "hints"]

        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=profile_id_str,
                artifact_types=[{"name": "attempt", "operation": "get"}],
                artifact_id=str(attempt_id),
                resource_types=resource_types,
                save=True,
                run_id=str(run_id),
                group_id=str(group_id),
                modality="audio",
                metadata={
                    "attempt_id": str(attempt_id),
                    "chat_id": str(chat_id),
                    "conversation_id": str(conversation_id),
                },
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            pass
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="audio",
                message=f"Failed to start voice session: {e}",
            ).model_dump(mode="json"),
        )
