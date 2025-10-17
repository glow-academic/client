import json
import logging
import os
import uuid
from typing import AsyncGenerator

import asyncpg  # type: ignore
from agents import Runner, trace
from agents.items import (ReasoningItem, ToolCallItem, ToolCallOutputItem,
                          TResponseInputItem)
from agents.mcp.server import MCPServer, MCPServerStreamableHttp
from app.db import get_db
from app.services.agents.generic import GenericAgent
from app.services.assistant_service import AssistantService
from app.services.model_run_service import ModelRunService
from app.utils.chat import get_assistant_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.limit import check_rate_limit
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

    # Try to get assistant chat first
    assistant_chat = await conn.fetchrow(
        "SELECT id, title, trace_id, profile_id FROM assistant_chats WHERE id = $1",
        chat_id
    )

    if assistant_chat:
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
                assistant_chat, mcp_servers, department_id, conn
            ):
                yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")


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
    chat: asyncpg.Record, mcp_servers: list[MCPServer], department_id: uuid.UUID, conn: asyncpg.Connection
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # Get all context data in optimized queries (1 JOIN + 2 parallel queries)
    assistant_service = AssistantService(conn)
    context = await assistant_service.get_assistant_run_context(
        chat_id=chat['id'],
        department_id=department_id
    )

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

    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)

    # Create model run with all junction records
    model_run_service = ModelRunService(conn)
    model_run_id = await model_run_service.create_model_run(
        department_id=department_id,
        model_id=uuid.UUID(context.model_id),
        entity_id=uuid.UUID(context.agent_id),
        entity_type="agent",
        profile_id=final_profile_id,
    )

    with trace(context.title, trace_id=context.trace_id):
        result = Runner.run_streamed(agent_instance.agent(), input=input_items, context=DebugContext(conn=conn, model_run_id=model_run_id))

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
        await model_run_service.update_model_run_tokens(
            model_run_id=model_run_id,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
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
