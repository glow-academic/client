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
from app.utils.agents import get_department_agent
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

    # Get the assistant agent configured for this department (via junction table)
    agent = await get_department_agent(conn, department_id, 'assistant')

    input_items: list[TResponseInputItem] = []

    # get the user profile from the chat
    user_profile = await conn.fetchrow(
        "SELECT id, role, first_name, last_name FROM profiles WHERE id = $1",
        chat['profile_id']
    )
    if not user_profile:
        raise ValueError(f"User profile not found with ID: {chat['profile_id']}")

    # get the user's role
    user_role = user_profile['role']
    if user_role == "superadmin":
        user_role = "Super Administrator"
    elif user_role == "admin":
        user_role = "Administrator"
    elif user_role == "instructional":
        user_role = "Instructional"
    elif user_role == "ta":
        user_role = "GTA"

    # get the user's name
    user_name = f"{user_profile['first_name']} {user_profile['last_name']}"

    # add the user profile to the input items
    input_items.append(
        {
            "role": "user",
            "content": f"The user's profile ID: {chat['profile_id']}. The user's name is {user_name}. The user's role is {user_role}. However, they may ask questions about other profiles, so you should be able to answer questions about other profiles as well.",
        }
    )

    # Get all the messages for the chat_id, including the new one, order by created_at
    messages = await conn.fetch(
        "SELECT * FROM assistant_messages WHERE chat_id = $1 ORDER BY created_at",
        chat['id']
    )

    # get all the tool calls for the chat_id
    tool_calls = await conn.fetch(
        "SELECT * FROM assistant_tool_calls WHERE chat_id = $1 ORDER BY created_at",
        chat['id']
    )

    # Prepare conversation history from chat_id
    conversation_history = get_assistant_conversation_history(messages, tool_calls)
    input_items.extend(conversation_history)

    # getting the model from the agent's model_id
    model = await conn.fetchrow(
        "SELECT id, name, provider_id, custom_model FROM models WHERE id = $1",
        agent['model_id']
    )
    if not model:
        raise ValueError(f"Model with ID {agent['model_id']} not found")

    # getting the provider from the model's provider_id
    provider = await conn.fetchrow(
        "SELECT id, name, base_url, api_key FROM providers WHERE id = $1",
        model['provider_id']
    )
    if not provider:
        raise ValueError(f"Provider with ID {model['provider_id']} not found")

    agent_instance = GenericAgent(
        agent_name=agent['name'],
        system_prompt=agent['system_prompt'],
        temperature=agent['temperature'],
        model_name=model['name'],
        model_provider=provider['name'],
        base_url=provider['base_url'],
        api_key=provider['api_key'],
        reasoning=agent['reasoning'],
        mcp_servers=mcp_servers,
        custom_model=model['custom_model'],
    )

    final_profile_id = chat['profile_id']

    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)

    # create a model run
    model_run_id = await conn.fetchval("""
        INSERT INTO model_runs (input_tokens, output_tokens, department_id)
        VALUES ($1, $2, $3)
        RETURNING id
    """, 0, 0, department_id)

    # Create model_run junction records
    if model['id']:
        await conn.execute("""
            INSERT INTO model_run_models (model_run_id, model_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, model['id'], True)
    
    if agent['id']:
        await conn.execute("""
            INSERT INTO model_run_agents (model_run_id, agent_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, agent['id'], True)
    
    if final_profile_id:
        await conn.execute("""
            INSERT INTO model_run_profiles (model_run_id, profile_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, final_profile_id, True)

    with trace(chat['title'], trace_id=chat['trace_id']):
        result = Runner.run_streamed(agent_instance.agent(), input=input_items, context=DebugContext(conn=conn, model_run_id=model_run_id))

    # Store the result in active runs for potential cancellation using unified tracking
    from app.main import store_active_run

    chat_id_str = str(chat['id'])
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

        # update model run
        await conn.execute("""
            UPDATE model_runs 
            SET input_tokens = $1, output_tokens = $2
            WHERE id = $3
        """, usage.input_tokens, usage.output_tokens, model_run_id)

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
