"""Handler for send_assistant_message WebSocket event."""

import json
import logging
import os
import uuid
import warnings
from collections.abc import AsyncGenerator
from typing import Any

import socketio  # type: ignore
from agents import Runner, trace
from agents.items import (ReasoningItem, ToolCallItem, ToolCallOutputItem,
                          TResponseInputItem)
from agents.mcp.server import MCPServer, MCPServerStreamableHttp
from app.db import get_pool
from app.main import sio
from app.utils.agents import GenericAgent
from app.utils.chat import get_assistant_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.sql_helper import load_sql
from dotenv import load_dotenv
from openai.types.responses import (ResponseFunctionToolCall,
                                    ResponseTextDeltaEvent)

load_dotenv()

# Suppress Pydantic serialization warnings from OpenAI SDK
warnings.filterwarnings("ignore", message="Pydantic serializer warnings")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def send_assistant_message(sid: str, data: dict[str, Any]) -> None:
    """Handle assistant message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        department_id = data.get("department_id")

        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            await sio.emit(
                "assistant_error", {"success": False, "message": "Missing department_id"}, room=sid
            )
            logger.error(f"Emitted assistant error to {sid}: Missing department_id")
            return

        if not chat_id or not message:
            logger.error(f"Missing chat_id or message in request from {sid}")
            await sio.emit(
                "assistant_error", {"success": False, "message": "Missing chat_id or message"}, room=sid
            )
            logger.error(f"Emitted assistant error to {sid}: Missing chat_id or message")
            return

        logger.info(
            f"Processing send_assistant_message from {sid}: {chat_id}, message: {message[:50]}..."
        )

        # Process the message via WebSocket
        chat_id_uuid = uuid.UUID(chat_id)
        
        # Get connection from pool
        pool = get_pool()
        if not pool:
            logger.error("Database pool not available")
            return

        current_message = None
        accumulated_content = ""
        active_tool_calls = {}  # Track tool calls by ID

        async with pool.acquire() as conn:
            try:
                # Verify the chat exists
                sql = load_sql("sql/v3/assistant/verify_chat_exists.sql")
                chat_row = await conn.fetchrow(sql, chat_id_uuid)
                if not chat_row:
                    raise ValueError(f"Chat {chat_id_uuid} not found")

                # 1. Add the user message to the chat
                from datetime import UTC, datetime
                sql = load_sql("sql/v3/assistant/create_message.sql")
                user_message_row = await conn.fetchrow(
                    sql, chat_id_uuid, "user", message, True, datetime.now(UTC)
                )
                user_message = {
                    "id": user_message_row["id"],
                    "created_at": user_message_row["created_at"],
                }

                # 2. Emit user message to connected clients
                await sio.emit(
                    "assistant_new_message",
                    {
                        "message_id": str(user_message["id"]),
                        "chat_id": str(chat_id_uuid),
                        "role": "user",
                        "content": message,
                        "completed": True,
                        "created_at": user_message["created_at"].isoformat(),
                    },
                    room=f"assistant_{chat_id_uuid}",
                )

                logger.info(f"Processing assistant message for chat {chat_id_uuid}")

                # 3. Stream the assistant response (inlined run_assistant_agent)
                # Use internal server URL for MCP server connection
                base_url = os.getenv("INTERNAL_API_BASE")
                mcp_server_url = f"{base_url}/domain/mcp/"

                async with MCPServerStreamableHttp(
                    name="MCP Server",
                    params={"url": mcp_server_url},
                    cache_tools_list=True,
                ) as domain_server:
                    mcp_servers = [domain_server]
                    
                    # Get all context data, messages, and tool_calls in single consolidated SQL query
                    sql = load_sql("sql/v3/agents/get_assistant_run_context_complete.sql")
                    context_row = await conn.fetchrow(sql, str(chat_id_uuid), str(department_id))
                    
                    if not context_row:
                        raise ValueError(f"Chat {chat_id_uuid} not found or no assistant agent configured")
                    
                    # Parse JSONB arrays for messages and tool_calls (asyncpg returns JSONB as list/dict)
                    def parse_jsonb(data: Any) -> list[dict[str, Any]]:
                        if isinstance(data, str):
                            parsed = json.loads(data)
                            return parsed if isinstance(parsed, list) else []
                        if isinstance(data, list):
                            return data
                        return []
                    
                    messages = parse_jsonb(context_row["messages"])
                    tool_calls = parse_jsonb(context_row["tool_calls"])
                    
                    # Build context dict from SQL result
                    context_dict = {
                        "chat_id": context_row["chat_id"],
                        "title": context_row["title"],
                        "trace_id": context_row["trace_id"],
                        "profile_id": context_row["profile_id"],
                        "user_role": context_row["user_role"],
                        "user_first_name": context_row["user_first_name"],
                        "user_last_name": context_row["user_last_name"],
                        "agent_id": context_row["agent_id"],
                        "agent_name": context_row["agent_name"],
                        "system_prompt": context_row["system_prompt"],
                        "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
                        "reasoning": context_row["reasoning"],
                        "model_id": context_row["model_id"],
                        "model_name": context_row["model_name"],
                        "custom_model": context_row["custom_model"],
                        "provider_id": context_row["provider_id"],
                        "provider_name": context_row["provider_name"],
                        "base_url": context_row["base_url"],
                        "api_key": context_row["api_key"],
                        "messages": messages,
                        "tool_calls": tool_calls,
                        "req_per_day": context_row["req_per_day"],
                        "runs_today_count": context_row["runs_today_count"],
                        "earliest_run_created_at": context_row["earliest_run_created_at"],
                    }
                    
                    # Create a simple object-like context for compatibility
                    class SimpleContext:  # type: ignore
                        def __init__(self, d: dict[str, Any]) -> None:
                            for k, v in d.items():
                                setattr(self, k, v)
                        
                        @property
                        def user_name(self) -> str:
                            first = getattr(self, "user_first_name", "") or ""
                            last = getattr(self, "user_last_name", "") or ""
                            return f"{first} {last}".strip() or "User"
                        
                        @property
                        def user_role_display(self) -> str:
                            role = getattr(self, "user_role", "guest")
                            role_mapping = {
                                "superadmin": "Super Administrator",
                                "admin": "Administrator",
                                "instructional": "Instructional",
                                "ta": "GTA",
                                "guest": "Guest",
                            }
                            return role_mapping.get(role, role.capitalize())
                    
                    context: Any = SimpleContext(context_dict)

                    input_items: list[TResponseInputItem] = []

                    # Add the user profile to the input items
                    input_items.append(
                        {
                            "role": "user",
                            "content": f"The user's profile ID: {context.profile_id}. The user's name is {context.user_name}. The user's role is {context.user_role_display}. However, they may ask questions about other profiles, so you should be able to answer questions about other profiles as well.",
                        }
                    )

                    # Prepare conversation history from context data
                    conversation_history = get_assistant_conversation_history(
                        context.messages, context.tool_calls
                    )
                    input_items.extend(conversation_history)

                    # Create agent instance with context data
                    agent_instance = GenericAgent(
                        agent_name=context.agent_name,
                        system_prompt=context.system_prompt,
                        temperature=context.temperature,
                        model_name=context.model_name,
                        model_provider=context.provider_name,
                        base_url=context.base_url,
                        api_key=context.api_key,
                        reasoning=context.reasoning,
                        mcp_servers=mcp_servers,
                        custom_model=context.custom_model,
                    )

                    final_profile_id = uuid.UUID(context.profile_id)

                    # Check rate limit
                    profile_id_uuid = final_profile_id if final_profile_id else None
                    if not profile_id_uuid:
                        raise ValueError("Profile not found. Please contact support.")
                    
                    req_per_day = context_dict["req_per_day"]
                    runs_today_count = context_dict["runs_today_count"]
                    
                    if req_per_day is not None and runs_today_count >= req_per_day:
                        from datetime import timedelta
                        from zoneinfo import ZoneInfo
                        earliest_run_created_at = context_dict["earliest_run_created_at"]
                        if earliest_run_created_at:
                            next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                            eastern_tz = ZoneInfo("America/New_York")
                            next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                            error_message = (
                                f"Daily request limit of {req_per_day} reached. "
                                f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                                f"{next_allowed_et.strftime('%B %d, %Y')}."
                            )
                        else:
                            error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                        raise ValueError(error_message)

                    # Create model run with all junction records using SQL file
                    sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
                    model_run_row = await conn.fetchrow(
                        sql_create_run,
                        str(department_id),
                        context.model_id,
                        context.agent_id,
                        "agent",
                        str(final_profile_id),
                    )
                    model_run_id = uuid.UUID(model_run_row["model_run_id"])

                    with trace(context.title, trace_id=context.trace_id):
                        result = Runner.run_streamed(
                            agent_instance.agent(),
                            input=input_items,
                            context=DebugContext(conn=conn, model_run_id=model_run_id),
                        )

                    # Store the result in active runs for potential cancellation using unified tracking
                    from app.socket.connections.utils import store_active_run

                    chat_id_str = context.chat_id
                    await store_active_run(chat_id_str, result)

                    try:
                        # Process streaming events
                        async for event in result.stream_events():
                            if event.type == "raw_response_event":
                                if isinstance(event.data, ResponseTextDeltaEvent):
                                    chunk = event.data.delta
                                    token = chunk
                                    
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
                                            await sio.emit(
                                                "message_complete",
                                                {
                                                    "message_id": str(current_message["id"]),
                                                    "chat_id": str(chat_id_uuid),
                                                    "final_content": accumulated_content,
                                                },
                                                room=f"assistant_{chat_id_uuid}",
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
                                                chat_id_uuid,
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
                                            await sio.emit(
                                                "tool_call_created",
                                                {
                                                    "tool_call_id": str(tool_call["id"]),
                                                    "chat_id": str(chat_id_uuid),
                                                    "tool_name": tool_name,
                                                    "tool_type": tool_type,
                                                },
                                                room=f"assistant_{chat_id_uuid}",
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
                                            await sio.emit(
                                                "tool_call_completed",
                                                {
                                                    "tool_call_id": str(tool_call_record["id"])
                                                    if tool_call_record
                                                    else None,
                                                    "chat_id": str(chat_id_uuid),
                                                    "tool_name": tool_result_data.get("name"),
                                                },
                                                room=f"assistant_{chat_id_uuid}",
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
                                            from datetime import UTC, datetime
                                            sql = load_sql("sql/v3/assistant/create_message.sql")
                                            assistant_message_row = await conn.fetchrow(
                                                sql, chat_id_uuid, "assistant", "", False, datetime.now(UTC)
                                            )
                                            current_message = {
                                                "id": assistant_message_row["id"],
                                                "created_at": assistant_message_row["created_at"],
                                            }

                                            # Emit new placeholder message
                                            await sio.emit(
                                                "assistant_new_message",
                                                {
                                                    "message_id": str(current_message["id"]),
                                                    "chat_id": str(chat_id_uuid),
                                                    "role": "assistant",
                                                    "content": "",
                                                    "completed": False,
                                                    "created_at": current_message["created_at"].isoformat(),
                                                },
                                                room=f"assistant_{chat_id_uuid}",
                                            )

                                        # Update the database with accumulated content
                                        sql = load_sql("sql/v3/assistant/update_message_content.sql")
                                        await conn.execute(sql, accumulated_content, current_message["id"])

                                        # Emit token update to connected clients
                                        await sio.emit(
                                            "assistant_message_token",
                                            {
                                                "message_id": str(current_message["id"]),
                                                "chat_id": str(chat_id_uuid),
                                                "token": token,
                                                "accumulated_content": accumulated_content,
                                            },
                                            room=f"assistant_{chat_id_uuid}",
                                        )
                    except Exception as stream_error:
                        logger.error(f"Error processing stream: {stream_error}", exc_info=True)
                        raise
                    finally:
                        # Clean up active run
                        from app.socket.connections.utils import \
                            remove_active_run
                        await remove_active_run(chat_id_str)

                # 4. Mark current message as completed (if we have one)
                if current_message:
                    sql = load_sql("sql/v3/assistant/complete_message.sql")
                    await conn.execute(
                        sql, accumulated_content, True, current_message["id"]
                    )

                    # 5. Emit completion signal
                    await sio.emit(
                        "assistant_message_complete",
                        {
                            "message_id": str(current_message["id"]),
                            "chat_id": str(chat_id_uuid),
                            "final_content": accumulated_content,
                        },
                        room=f"assistant_{chat_id_uuid}",
                    )

            except Exception as e:
                # Handle cancellation gracefully
                if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                    logger.info(f"Assistant run for chat {chat_id_uuid} was cancelled")

                    # Finalize the message with the content received so far
                    if current_message:
                        sql = load_sql("sql/v3/assistant/complete_message.sql")
                        await conn.execute(
                            sql, accumulated_content, True, current_message["id"]
                        )

                        # Emit a cancellation event
                        await sio.emit(
                            "assistant_message_cancelled",
                            {
                                "message_id": str(current_message["id"]),
                                "chat_id": str(chat_id_uuid),
                                "final_content": accumulated_content,
                            },
                            room=f"assistant_{chat_id_uuid}",
                        )
                else:
                    # Handle all other errors
                    logger.error(
                        f"Error processing assistant message for chat {chat_id_uuid}: {e}",
                        exc_info=True,
                    )
                    await sio.emit(
                        "assistant_error",
                        {"chat_id": str(chat_id_uuid), "error": str(e)},
                        room=f"assistant_{chat_id_uuid}",
                    )

        logger.info(f"Completed processing send_assistant_message for {chat_id}")

    except Exception as e:
        logger.error(f"Error in send_assistant_message for {sid}: {str(e)}")
        await sio.emit(
            "assistant_error", {"success": False, "message": f"Failed to send message: {str(e)}"}, room=sid
        )
        logger.error(f"Emitted assistant error to {sid}: Failed to send message: {str(e)}")

