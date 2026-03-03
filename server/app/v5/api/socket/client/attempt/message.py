"""Client-facing attempt_message handler.

Handles: attempt_message — send a user message in an attempt chat.

Flow:
1. Validate + resolve profile, group_id
2. Create run + profile link
3. Emit attempt_user_received_start (internal handler creates message shell)
4. Emit attempt_user_received_complete (internal handler writes content + marks complete)
   (user_progress not needed for text — full message is known upfront)
5. Create assistant placeholder + emit attempt_assistant_start
6. Emit generate with pre-created run_id/group_id

All attempt_* emits go to internal bus → internal/ handlers (DB) → server/ handlers → client.
"""

import uuid
from typing import Any

from app.v5.api.auth.access import get_access_internal
from app.v5.api.entries.attempt_chat.get import get_attempt_chat_entries_internal
from app.v5.api.entries.attempt_message.refresh import refresh_attempt_message_internal
from app.v5.api.entries.attempt_message_tree.create import (
    create_attempt_message_tree_entry_internal,
)
from app.v5.api.entries.attempt_message_tree.refresh import (
    refresh_attempt_message_tree_internal,
)
from app.v5.api.entries.messages.create import create_messages_entry_internal
from app.v5.api.entries.messages.search import search_messages_entries_internal
from app.v5.api.entries.runs.create import create_runs_entry_internal
from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptMessagePayload
from app.v5.api.socket.internal.attempt.types import (
    AttemptAssistantStartData,
    AttemptErrorData,
    AttemptUserReceivedCompleteData,
    AttemptUserReceivedStartData,
    GenerateRequestData,
)
from app.v5.api.socket.types import MESSAGE_ENTRY_TYPES
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_message — prepare + emit generate."""
    try:
        payload = AttemptMessagePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        attempt_id = payload.attempt_id
        chat_id = payload.chat_id
        message = payload.message

        if not message or not message.strip():
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Missing or empty message",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        rooms = [sid, f"attempt_{chat_id}"]

        async with get_db_connection() as conn:
            # Step 1: Resolve group_id from attempt_chat_entry
            chat_entries = await get_attempt_chat_entries_internal(
                conn, [chat_id], bypass_cache=True
            )

            if not chat_entries:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="send",
                        message="No group found for chat",
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
                return

            group_id = chat_entries[0].get("group_id")
            if group_id and isinstance(group_id, str):
                group_id = uuid.UUID(group_id)

            if not group_id:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="send",
                        message="No group found for chat",
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
                return

            # Step 2: Resolve profiles_id via access internal + create run
            access = await get_access_internal(conn, profile_id)
            profiles_id = access.profiles_id

            run_result = await create_runs_entry_internal(
                conn,
                group_id=group_id,
                profiles_id=profiles_id,
            )
            run_id = run_result.id

        # Step 3: Emit user_received_start → internal handler creates message shell
        await internal_sio.emit(
            "attempt_user_received_start",
            AttemptUserReceivedStartData(
                sid=sid,
                chat_id=str(chat_id),
                run_id=str(run_id),
                profile_id=profile_id_str,
                rooms=rooms,
            ).model_dump(mode="json"),
        )

        # Step 4: Emit user_received_complete → internal handler writes content
        # (user_progress not needed for text — full message known upfront)
        await internal_sio.emit(
            "attempt_user_received_complete",
            AttemptUserReceivedCompleteData(
                sid=sid,
                chat_id=str(chat_id),
                run_id=str(run_id),
                content=message,
                rooms=rooms,
            ).model_dump(mode="json"),
        )

        # Step 5: Create assistant placeholder + emit assistant_start
        async with get_db_connection() as conn:
            assistant_result = await create_messages_entry_internal(
                conn,
                run_id=run_id,
                role="assistant",
                chat_id=chat_id,
            )
            assistant_message_id = assistant_result.id
            created_at = assistant_result.created_at

            # Step 5a: Insert tree edges for message branching
            # Look up the user message_id just created in this run
            messages = await search_messages_entries_internal(
                conn, run_id=run_id, bypass_cache=True
            )
            user_message_id = None
            for msg in messages:
                if msg.get("role") == "user":
                    msg_id = msg.get("id")
                    if msg_id:
                        user_message_id = (
                            uuid.UUID(msg_id) if isinstance(msg_id, str) else msg_id
                        )
                    break

            if user_message_id:
                # If forking from an existing message, link parent -> user
                if payload.parent_message_id:
                    await create_attempt_message_tree_entry_internal(
                        conn,
                        parent_id=payload.parent_message_id,
                        child_id=user_message_id,
                    )

                # Always link user -> assistant
                await create_attempt_message_tree_entry_internal(
                    conn,
                    parent_id=user_message_id,
                    child_id=assistant_message_id,
                )

        await internal_sio.emit(
            "attempt_assistant_start",
            AttemptAssistantStartData(
                sid=sid,
                chat_id=str(chat_id),
                message_id=str(assistant_message_id),
                created_at=created_at.isoformat() if created_at else "",
            ).model_dump(mode="json"),
        )

        # Step 5b: Refresh MVs so generate_prepare sees the new message
        async with get_db_connection() as conn:
            await refresh_attempt_message_internal(conn)
            await refresh_attempt_message_tree_internal(conn)

        # Step 5c: Invalidate attempt caches so generate_prepare fetches fresh data
        await invalidate_tags(["attempt", "messages"])

        # Step 6: Emit to generate pipeline
        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=str(profile_id),
                artifact_types=[{"name": "attempt", "operation": "get"}],
                artifact_id=str(attempt_id),
                resource_types=MESSAGE_ENTRY_TYPES,
                save=True,
                run_id=str(run_id),
                group_id=str(group_id),
                modality="call",
                metadata={
                    "attempt_id": str(attempt_id),
                    "chat_id": str(chat_id),
                },
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            pass
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_message: {e}")
        chat_id_str = str(data.get("chat_id", "")) if data.get("chat_id") else None
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="send",
                message=f"Failed to send message: {e}",
                chat_id=chat_id_str,
            ).model_dump(mode="json"),
        )
