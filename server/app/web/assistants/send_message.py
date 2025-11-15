"""Handler for send_assistant_message WebSocket event."""

import json
import logging
import uuid
import warnings
from typing import Any

from app.agents.collection.assistant import run_assistant_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql
from app.web.assistants.utils import emit_assistant_error, get_sio_instance

# Suppress Pydantic serialization warnings from OpenAI SDK
warnings.filterwarnings("ignore", message="Pydantic serializer warnings")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logger = logging.getLogger(__name__)


async def handle_send_assistant_message(sid: str, data: dict[str, Any]) -> None:
    """Handle assistant message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        department_id = data.get("department_id")

        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            await emit_assistant_error(sid, "Missing department_id")
            return

        if not chat_id or not message:
            logger.error(f"Missing chat_id or message in request from {sid}")
            await emit_assistant_error(sid, "Missing chat_id or message")
            return

        logger.info(
            f"Processing send_assistant_message from {sid}: {chat_id}, message: {message[:50]}..."
        )

        # Process the message via WebSocket
        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id), message=message, department_id=department_id
        )

        logger.info(f"Completed processing send_assistant_message for {chat_id}")

    except Exception as e:
        logger.error(f"Error in send_assistant_message for {sid}: {str(e)}")
        await emit_assistant_error(sid, f"Failed to send message: {str(e)}")


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

