"""Attempt stop handler.

Handles: attempt_stop_message — stop active message generation.

Dual cancel (in-process + Redis) → entry mutation → emit stopped.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.cancel_active_result import cancel_active_result
from app.infra.websocket.cancel_active_run import cancel_active_run
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptStopPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptStoppedData,
)
from app.routes.v5.tools.entries.attempt_chat.get import get_attempt_chats
from app.routes.v5.tools.entries.attempt_message.search import search_attempt_messages
from app.routes.v5.tools.entries.attempt_message_completion.create import (
    create_attempt_message_completion,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.runs.create import create_run
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _attempt_stop_impl(sid: str, data: AttemptStopPayload) -> None:
    """Handle attempt_stop_message — cancel active generation and mark complete."""
    try:
        chat_id = str(data.chat_id)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            raise ValueError("Profile not found for socket")

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            raise ValueError("Session not found for socket")

        profile_id = uuid.UUID(profile_id_str)
        session_id = uuid.UUID(session_id_str)

        # Step 1: In-process cancel
        await cancel_active_result(chat_id)

        # Step 2: Redis cooperative cancel
        await cancel_active_run(chat_id)

        # Step 3: Find latest message and mark complete
        # TODO: Add leaf-node filter (exclude messages with children in attempt_message_tree_entry)
        pool = get_pool()
        async with pool.acquire() as conn:
            chat_entries = await get_attempt_chats(conn, [uuid.UUID(chat_id)])
            if not chat_entries or not chat_entries[0].group_id:
                raise ValueError(f"Group not found for chat {chat_id}")
            group_id = chat_entries[0].group_id

            identity = await resolve_profile_identity_context(
                pool,
                profile_id,
                get_redis_client(),
                session_id=session_id,
            )
            profiles_id = identity.profiles_id if identity else None

            messages, _ = await search_attempt_messages(
                conn,
                chat_ids=[uuid.UUID(chat_id)],
                limit=1,
                bypass_mv=True,
            )

            if not messages:
                await internal_sio.emit(
                    "attempt_stopped",
                    AttemptStoppedData(
                        sid=sid,
                        chat_id=chat_id,
                        success=False,
                        message="No active message found for this chat",
                    ).model_dump(mode="json"),
                )
                return

            latest_message = messages[0]

            # Create run + call for traceability
            run = await create_run(
                conn,
                group_id=group_id,
                session_id=session_id,
                profiles_id=profiles_id,
            )
            call = await create_call(
                conn,
                run_id=run.id,
                session_id=session_id,
            )

            await create_attempt_message_completion(
                conn,
                attempt_message_id=latest_message.message_id,
                call_id=call.id,
                stop=True,
            )

        # Emit to sid + attempt room via server layer
        await internal_sio.emit(
            "attempt_stopped",
            AttemptStoppedData(
                sid=sid,
                rooms=[sid, f"attempt_{chat_id}"],
                chat_id=chat_id,
                success=True,
                message=None,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_stop_message: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="stop",
                message=f"Failed to stop: {e}",
                chat_id=str(data.chat_id) if data else None,
            ).model_dump(mode="json"),
        )


@sio.event  # type: ignore
async def attempt_stop_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_stop_message event — stop message generation."""
    try:
        payload = AttemptStopPayload(**data)
        await _attempt_stop_impl(sid, payload)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_stop_message: {e}")
        chat_id = data.get("chat_id", "")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="stop",
                message=f"Invalid request: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
