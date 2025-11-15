"""Handler for start_assistant WebSocket event."""

import logging
from typing import Any

from agents import gen_trace_id
from app.agents.collection.title import run_title_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql
from app.web.assistants.utils import emit_assistant_error, get_sio_instance

logger = logging.getLogger(__name__)


async def handle_start_assistant(sid: str, data: dict[str, Any]) -> None:
    """
    Handle assistant start requests via WebSocket
    Creates a new assistant chat and processes the initial message
    """
    try:
        logger.info(f"Received start_assistant request from {sid} with data: {data}")

        profile_id = data.get("profile_id")
        initial_message = data.get("initial_message")
        department_id = data.get("department_id")

        if not profile_id or not initial_message:
            logger.error(f"Missing profile_id or initial_message in request from {sid}")
            await emit_assistant_error(sid, "Missing profile_id or initial_message")
            return

        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            await emit_assistant_error(
                sid, "Missing department_id - please refresh the page"
            )
            return

        logger.info(f"Processing assistant start: profile_id={profile_id}, sid={sid}")

        # Get connection from pool
        pool = get_pool()
        if not pool:
            await emit_assistant_error(sid, "Database not available")
            return

        async with pool.acquire() as conn:
            # Verify profile exists
            sql = load_sql("sql/v3/profile/verify_profile_exists.sql")
            profile_row = await conn.fetchrow(sql, profile_id)
            if not profile_row:
                await emit_assistant_error(sid, "Profile not found")
                return

            # Generate a trace id for the chat
            trace_id = gen_trace_id()

            # Create the assistant chat
            from datetime import UTC, datetime
            sql = load_sql("sql/v3/assistant/create_chat.sql")
            chat_row = await conn.fetchrow(
                sql,
                datetime.now(UTC),
                "New Chat",  # Will be updated by title agent
                profile_id,
                trace_id,
            )
            chat_id_uuid = chat_row["id"]  # Keep as UUID for run_title_agent
            chat_id = str(chat_id_uuid)
            logger.info(f"Created new assistant chat: {chat_id}")

            # Ensure client is joined to the assistant room
            sio_instance = get_sio_instance()
            assistant_room = f"assistant_{chat_id}"
            await sio_instance.enter_room(sid, assistant_room)
            logger.info(f"Client {sid} joined assistant room {assistant_room}")

            # Update the title with the title agent
            chat_title = await run_title_agent(
                chat_id_uuid,
                initial_message,
                department_id,
                conn,  # type: ignore[arg-type]
            )
            logger.info(f"Chat title: {chat_title}")

            # Emit title update to connected clients
            await sio_instance.emit(
                "title_updated",
                {"chat_id": chat_id, "title": chat_title},
                room=assistant_room,
            )

            # Emit success response with chat_id
            await sio_instance.emit(
                "assistant_started",
                {
                    "success": True,
                    "message": "Assistant started successfully",
                    "chat_id": chat_id,
                },
                room=sid,
            )

            logger.info(f"Assistant started successfully for {sid}: chat={chat_id}")

    except Exception as e:
        logger.error(f"Error starting assistant for {sid}: {str(e)}")
        await emit_assistant_error(sid, f"Failed to start assistant: {str(e)}")

