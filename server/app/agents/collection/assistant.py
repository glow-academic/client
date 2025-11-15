import json
import logging
import os
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import asyncpg  # type: ignore
from agents import Runner, trace
from agents.items import (ReasoningItem, ToolCallItem, ToolCallOutputItem,
                          TResponseInputItem)
from agents.mcp.server import MCPServer, MCPServerStreamableHttp
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.chat import get_assistant_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.sql_helper import load_sql
from dotenv import load_dotenv
from fastapi import Depends
from openai.types.responses import (ResponseFunctionToolCall,
                                    ResponseTextDeltaEvent)

load_dotenv()

logger = logging.getLogger(__name__)


async def run_assistant_agent(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Now supports both simulation chats and eval chats by detecting the chat type.

    Args:
        chat_id: The ID of the chat session (can be simulation_chat_id or eval_chat_id)
        input_text: Optional input text to send to the agent
        test_data: Whether to use test data
    Yields:
        Text chunks from the agent's response
    """

    # Use internal server URL for MCP server connection
    # In Docker, the server is accessible at http://localhost:8000
    # This avoids Traefik routing issues and uses internal networking
    base_url = os.getenv("INTERNAL_API_BASE")
    mcp_server_url = f"{base_url}/domain/mcp/"

    async with MCPServerStreamableHttp(
        name="MCP Server",
        params={"url": mcp_server_url},
        cache_tools_list=True,
    ) as domain_server:
        mcp_servers = [domain_server]
        async for token in _handle_assistant_chat(
            chat_id, mcp_servers, department_id, conn
        ):
            yield token


async def cancel_assistant_run(chat_id: uuid.UUID) -> bool:
    """
    Cancel an active assistant run using unified tracking.

    Args:
        chat_id: The ID of the chat session to cancel

    Returns:
        bool: True if the run was found and cancelled, False otherwise
    """
    from app.extensions import cancel_active_run

    return await cancel_active_run(str(chat_id))


async def _handle_assistant_chat(
    chat_id: uuid.UUID,
    mcp_servers: list[MCPServer],
    department_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> AsyncGenerator[str, None]:
    """Handle assistant chat processing."""

    # Get all context data, messages, and tool_calls in single consolidated SQL query
    sql = load_sql("sql/v3/agents/get_assistant_run_context_complete.sql")
    context_row = await conn.fetchrow(sql, str(chat_id), str(department_id))
    
    if not context_row:
        raise ValueError(f"Chat {chat_id} not found or no assistant agent configured")
    
    # Parse JSONB arrays for messages and tool_calls (asyncpg returns JSONB as list/dict)
    def parse_jsonb(data: Any) -> list[dict[str, Any]]:
        if isinstance(data, str):
            return json.loads(data)
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
    }
    
    # Create a simple object-like context for compatibility
    # Use type: ignore for dynamic attributes since we're replacing a Pydantic model
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

    # Check rate limit using SQL file
    from datetime import UTC, datetime
    profile_id_uuid = final_profile_id if final_profile_id else None
    if not profile_id_uuid:
        raise ValueError("Profile not found. Please contact support.")
    
    # Calculate the start of the current day in UTC
    now_utc = datetime.now(UTC)
    start_of_day_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    
    sql_rate_limit = load_sql("sql/v3/model_runs/check_rate_limit.sql")
    rate_limit_row = await conn.fetchrow(
        sql_rate_limit, str(final_profile_id), start_of_day_utc.isoformat()
    )
    
    if not rate_limit_row:
        raise ValueError("Profile not found.")
    
    req_per_day = rate_limit_row["req_per_day"]
    runs_today_count = rate_limit_row["runs_today_count"]
    
    if req_per_day is not None and runs_today_count >= req_per_day:
        # Rate limit exceeded - format error message
        from datetime import timedelta
        from zoneinfo import ZoneInfo
        earliest_run_created_at = rate_limit_row["earliest_run_created_at"]
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
    from app.main import store_active_run

    chat_id_str = context.chat_id
    await store_active_run(chat_id_str, result)

    # Track active tool calls to match with their results
    active_tool_calls = {}

    try:
        # Process streaming events
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    yield chunk
            elif event.type == "run_item_stream_event":
                if event.name == "tool_called" and isinstance(event.item, ToolCallItem):
                    if isinstance(event.item.raw_item, ResponseFunctionToolCall):
                        tool_call = event.item.raw_item
                        name = tool_call.name
                        arguments = tool_call.arguments
                        tool_call_id = str(uuid.uuid4())  # Always generate our own UUID

                        # Store the tool call for later matching with results
                        active_tool_calls[tool_call_id] = {
                            "name": name,
                            "arguments": arguments,
                        }

                        # Yield structured tool call data
                        tool_call_data = {
                            "id": tool_call_id,
                            "name": name,
                            "arguments": arguments,
                        }
                        tool_call_token = f"<tool_call_start>{json.dumps(tool_call_data)}</tool_call_start>"
                        yield tool_call_token

                elif event.name == "tool_output" and isinstance(
                    event.item, ToolCallOutputItem
                ):
                    output = event.item.output

                    # Try to match this output with a tool call
                    # Since we don't have a direct ID mapping, we'll use the most recent tool call
                    if active_tool_calls:
                        # Get the most recent tool call (assuming FIFO processing)
                        tool_call_id = list(active_tool_calls.keys())[-1]
                        tool_call_info = active_tool_calls[tool_call_id]

                        # Yield structured tool result data
                        tool_result_data = {
                            "id": tool_call_id,
                            "name": tool_call_info["name"],
                            "result": output,
                        }
                        tool_result_token = f"<tool_call_result>{json.dumps(tool_result_data)}</tool_call_result>"
                        yield tool_result_token

                        # Remove the processed tool call
                        del active_tool_calls[tool_call_id]
                    else:
                        logger.warning(
                            "Received tool output but no active tool calls to match"
                        )
                elif event.name == "reasoning_item_created" and isinstance(
                    event.item, ReasoningItem
                ):
                    logger.info(f"Reasoning item created: {event.item}")
                    pass
                else:
                    pass
            else:
                pass

        usage = result.context_wrapper.usage

        # Update model run tokens
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

    except Exception as e:
        # Handle cancellation or other errors
        if "cancelled" in str(e).lower():
            # This is expected when the run is cancelled
            pass
        else:
            # Re-raise other exceptions
            raise e
    finally:
        # Clean up the active run using unified tracking
        from app.extensions import remove_active_run

        await remove_active_run(chat_id_str)
