# for use with the websockets

"""
WebSocket handlers for assistant chat functionality
Supports real-time message streaming and tool call handling
"""

import json
import logging
import uuid
import warnings
from typing import Any

import socketio  # type: ignore
from agents import gen_trace_id
from app.agents.collection.assistant import (cancel_assistant_run,
                                             run_assistant_agent)
from app.agents.collection.title import run_title_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql

# Suppress Pydantic serialization warnings from OpenAI SDK
warnings.filterwarnings("ignore", message="Pydantic serializer warnings")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logger = logging.getLogger(__name__)


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


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


async def handle_stop_assistant(sid: str, data: dict[str, Any]) -> None:
    """
    Handle assistant stop requests via WebSocket
    Replaces /assistants/stop endpoint
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await emit_assistant_error(sid, "Missing chat_id")
            return

        # Get connection from pool
        pool = get_pool()
        if not pool:
            await emit_assistant_error(sid, "Database not available")
            return

        async with pool.acquire() as conn:
            # Verify the chat exists
            sql = load_sql("sql/v3/assistant/verify_chat_exists.sql")
            chat_row = await conn.fetchrow(sql, chat_id)
            if not chat_row:
                await emit_assistant_error(sid, "Chat not found")
                return

            # Attempt to cancel the assistant run
            success = cancel_assistant_run(uuid.UUID(chat_id))

            sio_instance = get_sio_instance()

            if success:
                logger.info(f"Successfully cancelled assistant run for chat {chat_id}")

                # Emit stop signal via WebSocket
                await sio_instance.emit(
                    "assistant_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "Assistant stopped successfully",
                    },
                    room=f"assistant_{chat_id}",
                )

            else:
                logger.warning(f"No active assistant run found for chat {chat_id}")
                await sio_instance.emit(
                    "assistant_stopped",
                    {
                        "chat_id": chat_id,
                        "success": False,
                        "message": "No active assistant run found",
                    },
                    room=f"assistant_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping assistant for {sid}: {str(e)}")
        await emit_assistant_error(sid, f"Failed to stop assistant: {str(e)}")


async def process_assistant_message_websocket(
    chat_id: uuid.UUID,
    message: str,
    department_id: uuid.UUID,
) -> None:
    """
    Process an assistant message and stream the response via WebSocket
    Supports both text and audio messages (audio support to be implemented)
    """

    # Get connection from pool
    pool = get_pool()
    if not pool:
        logger.error("Database pool not available")
        return

    sio_instance = get_sio_instance()
    current_message = None
    accumulated_content = ""
    active_tool_calls = {}  # Track tool calls by ID

    async with pool.acquire() as conn:
        try:
            # Verify the chat exists
            sql = load_sql("sql/v3/assistant/verify_chat_exists.sql")
            chat_row = await conn.fetchrow(sql, chat_id)
            if not chat_row:
                raise ValueError(f"Chat {chat_id} not found")

            # 1. Add the user message to the chat
            from datetime import UTC, datetime
            sql = load_sql("sql/v3/assistant/create_message.sql")
            user_message_row = await conn.fetchrow(
                sql, chat_id, "user", message, True, datetime.now(UTC)
            )
            user_message = {
                "id": user_message_row["id"],
                "created_at": user_message_row["created_at"],
            }

            # 2. Emit user message to connected clients
            await sio_instance.emit(
                "assistant_new_message",
                {
                    "message_id": str(user_message["id"]),
                    "chat_id": str(chat_id),
                    "role": "user",
                    "content": message,
                    "completed": True,
                    "created_at": user_message["created_at"].isoformat(),
                },
                room=f"assistant_{chat_id}",
            )

            logger.info(f"Processing assistant message for chat {chat_id}")

            # 3. Stream the assistant response
            async for token in run_assistant_agent(chat_id, department_id, conn):  # type: ignore[arg-type]
                logger.info(
                    f"Received token: '{token}' (type: {type(token)}, length: {len(token) if isinstance(token, str) else 'N/A'})"
                )

                # Check if this is a tool call token
                if token.startswith("<tool_call_start>") and token.endswith(
                    "</tool_call_start>"
                ):
                    logger.info(f"Received tool call start token: {token}")

                    # If we have accumulated content, complete the current message and create a new one
                    if accumulated_content.strip() and current_message:
                        # Complete current message
                        sql = load_sql("sql/v3/assistant/complete_message.sql")
                        await conn.execute(
                            sql, accumulated_content, True, current_message["id"]
                        )

                        # Emit completion for current message
                        await sio_instance.emit(
                            "message_complete",
                            {
                                "message_id": str(current_message["id"]),
                                "chat_id": str(chat_id),
                                "final_content": accumulated_content,
                            },
                            room=f"assistant_{chat_id}",
                        )

                        # Reset accumulated content
                        accumulated_content = ""
                        current_message = None

                    # Extract tool call data
                    tool_call_json = token.replace("<tool_call_start>", "").replace(
                        "</tool_call_start>", ""
                    )
                    try:
                        tool_call_data = json.loads(tool_call_json)

                        # Determine tool type based on tool name
                        tool_name = tool_call_data.get("name", "unknown")
                        tool_type = "read"  # Default to read

                        # Map tool names to types based on their operation
                        if any(
                            keyword in tool_name.lower()
                            for keyword in ["create", "add", "insert", "new"]
                        ):
                            tool_type = "create"
                        elif any(
                            keyword in tool_name.lower()
                            for keyword in ["update", "edit", "modify", "change"]
                        ):
                            tool_type = "update"
                        elif any(
                            keyword in tool_name.lower()
                            for keyword in ["delete", "remove", "drop"]
                        ):
                            tool_type = "delete"
                        # Otherwise defaults to 'read' for find, get, list, etc.

                        # Save tool call to database (without associating to a message)
                        import json as json_module
                        from datetime import UTC, datetime
                        sql = load_sql("sql/v3/assistant/create_tool_call.sql")
                        tool_call_row = await conn.fetchrow(
                            sql,
                            chat_id,
                            tool_name,
                            tool_type,
                            json_module.dumps(tool_call_data.get("arguments", {})),
                            datetime.now(UTC),
                        )
                        if not tool_call_row:
                            logger.error("Failed to create tool call record")
                            continue
                        tool_call = {"id": tool_call_row["id"]}
                        logger.info(
                            f"Successfully created tool call record: {tool_call['id']}"
                        )

                        # Store the tool call for later result matching
                        tool_call_id = tool_call_data.get("id")
                        if tool_call_id:
                            active_tool_calls[tool_call_id] = tool_call

                        # Emit tool call created event (frontend will refetch tool calls)
                        await sio_instance.emit(
                            "tool_call_created",
                            {
                                "tool_call_id": str(tool_call["id"]),
                                "chat_id": str(chat_id),
                                "tool_name": tool_name,
                                "tool_type": tool_type,
                            },
                            room=f"assistant_{chat_id}",
                        )

                    except json.JSONDecodeError:
                        logger.error(
                            f"Failed to parse tool call JSON: {tool_call_json}"
                        )

                elif token.startswith("<tool_call_result>") and token.endswith(
                    "</tool_call_result>"
                ):
                    logger.info(f"Received tool call result token: {token}")
                    # Extract tool call result data
                    tool_result_json = token.replace("<tool_call_result>", "").replace(
                        "</tool_call_result>", ""
                    )
                    try:
                        tool_result_data = json.loads(tool_result_json)
                        tool_call_id = tool_result_data.get("id")

                        # Update the corresponding tool call record with the result
                        import json as json_module
                        tool_call_record = None
                        if tool_call_id and tool_call_id in active_tool_calls:
                            tool_call_record = active_tool_calls[tool_call_id]
                            sql = load_sql("sql/v3/assistant/complete_tool_call.sql")
                            await conn.execute(
                                sql,
                                tool_call_record["id"],
                                json_module.dumps(tool_result_data.get("result", {})),
                                True,  # completed = True
                            )
                            logger.info(
                                f"Successfully updated tool call record {tool_call_record['id']} with result"
                            )

                            # Remove from active tracking
                            del active_tool_calls[tool_call_id]

                        # Emit tool call completed event (frontend will refetch tool calls)
                        await sio_instance.emit(
                            "tool_call_completed",
                            {
                                "tool_call_id": str(tool_call_record["id"])
                                if tool_call_record
                                else None,
                                "chat_id": str(chat_id),
                                "tool_name": tool_result_data.get("name"),
                            },
                            room=f"assistant_{chat_id}",
                        )

                    except json.JSONDecodeError:
                        logger.error(
                            f"Failed to parse tool result JSON: {tool_result_json}"
                        )

                else:
                    # Regular content token
                    accumulated_content += token

                    # Create assistant message if we don't have one yet
                    if not current_message:
                        sql = load_sql("sql/v3/assistant/create_message.sql")
                        assistant_message_row = await conn.fetchrow(
                            sql, chat_id, "assistant", "", False, datetime.now(UTC)
                        )
                        current_message = {
                            "id": assistant_message_row["id"],
                            "created_at": assistant_message_row["created_at"],
                        }

                        # Emit new placeholder message
                        await sio_instance.emit(
                            "assistant_new_message",
                            {
                                "message_id": str(current_message["id"]),
                                "chat_id": str(chat_id),
                                "role": "assistant",
                                "content": "",
                                "completed": False,
                                "created_at": current_message["created_at"].isoformat(),
                            },
                            room=f"assistant_{chat_id}",
                        )

                    # Update the database with accumulated content
                    sql = load_sql("sql/v3/assistant/update_message_content.sql")
                    await conn.execute(sql, accumulated_content, current_message["id"])

                    # Emit token update to connected clients
                    await sio_instance.emit(
                        "assistant_message_token",
                        {
                            "message_id": str(current_message["id"]),
                            "chat_id": str(chat_id),
                            "token": token,
                            "accumulated_content": accumulated_content,
                        },
                        room=f"assistant_{chat_id}",
                    )

            # 4. Mark current message as completed (if we have one)
            if current_message:
                sql = load_sql("sql/v3/assistant/complete_message.sql")
                await conn.execute(
                    sql, accumulated_content, True, current_message["id"]
                )

                # 5. Emit completion signal
                await sio_instance.emit(
                    "assistant_message_complete",
                    {
                        "message_id": str(current_message["id"]),
                        "chat_id": str(chat_id),
                        "final_content": accumulated_content,
                    },
                    room=f"assistant_{chat_id}",
                )

        except Exception as e:
            # Handle cancellation gracefully
            if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                logger.info(f"Assistant run for chat {chat_id} was cancelled")

                # Finalize the message with the content received so far
                if current_message:
                    sql = load_sql("sql/v3/assistant/complete_message.sql")
                    await conn.execute(
                        sql, accumulated_content, True, current_message["id"]
                    )

                    # Emit a cancellation event
                    await sio_instance.emit(
                        "assistant_message_cancelled",
                        {
                            "message_id": str(current_message["id"]),
                            "chat_id": str(chat_id),
                            "final_content": accumulated_content,
                        },
                        room=f"assistant_{chat_id}",
                    )
            else:
                # Handle all other errors
                logger.error(
                    f"Error in process_assistant_message_websocket for chat {chat_id}: {e}",
                    exc_info=True,
                )
                await sio_instance.emit(
                    "assistant_error",
                    {"chat_id": str(chat_id), "error": str(e)},
                    room=f"assistant_{chat_id}",
                )


async def emit_assistant_error(sid: str, message: str) -> None:
    """Helper function to emit assistant error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "assistant_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted assistant error to {sid}: {message}")


def register_assistant_events(sio: socketio.AsyncServer) -> None:
    """Register all assistant WebSocket event handlers"""

    logger.info("Starting registration of assistant WebSocket event handlers")

    @sio.event  # type: ignore
    async def start_assistant(sid: str, data: dict[str, Any]) -> None:
        """Start a new assistant chat"""
        logger.info(
            f"start_assistant event triggered for sid={sid} with data keys: {list(data.keys())}"
        )
        await handle_start_assistant(sid, data)

    @sio.event  # type: ignore
    async def stop_assistant(sid: str, data: dict[str, Any]) -> None:
        """Stop an active assistant"""
        await handle_stop_assistant(sid, data)

    logger.info("Successfully registered assistant WebSocket event handlers")
