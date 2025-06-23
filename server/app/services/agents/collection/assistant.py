import json
import logging
import uuid
from typing import AsyncGenerator

from agents import Runner, trace
from agents.items import ToolCallItem, ToolCallOutputItem, TResponseInputItem
from agents.mcp.server import MCPServer, MCPServerStreamableHttp
from app.db import get_session
from app.models import (Agents, AssistantChats, AssistantMessages, Models,
                        Profiles, Providers)
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_assistant_conversation_history
from dotenv import load_dotenv
from fastapi import Depends
from openai.types.responses import (ResponseFunctionToolCall,
                                    ResponseTextDeltaEvent)
from sqlalchemy import desc
from sqlmodel import Session, select

load_dotenv()

logger = logging.getLogger(__name__)

async def run_assistant_agent(
    chat_id: uuid.UUID,
    session: Session = Depends(get_session),
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
    assistant_chat = session.exec(
        select(AssistantChats).where(AssistantChats.id == chat_id)
    ).one_or_none()
    
    if assistant_chat:
        # Use internal server URL for MCP server connection
        # In Docker, the server is accessible at http://localhost:8000
        # This avoids Traefik routing issues and uses internal networking
        mcp_server_url = "http://localhost:8000/domain/mcp"
        
        async with (
            MCPServerStreamableHttp(
                name="MCP Server",
                params={"url": mcp_server_url},
                cache_tools_list=True,
            ) as domain_server
        ):
            mcp_servers = [domain_server]
            async for token in _handle_assistant_chat(
                assistant_chat, mcp_servers, session
            ):
                yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")


def cancel_assistant_run(chat_id: uuid.UUID) -> bool:
    """
    Cancel an active assistant run using unified tracking.
    
    Args:
        chat_id: The ID of the chat session to cancel
        
    Returns:
        bool: True if the run was found and cancelled, False otherwise
    """
    from app.main import cancel_active_run
    return cancel_active_run(str(chat_id))


async def _handle_assistant_chat(
    chat: AssistantChats, mcp_servers: list[MCPServer], session: Session
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # find agent with name of "Assistant"
    agent = session.exec(select(Agents).where(Agents.name == "Assistant")).one()
    if not agent:
        raise ValueError("Assistant agent not found")

    input_items: list[TResponseInputItem] = []

    # add the user profile to the input items
    input_items.append({
        "role": "user",
        "content": f"The following is the user's profile ID: {chat.profile_id}. However, they may ask questions about other profiles, so you should be able to answer questions about other profiles as well."
    })

    # Get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(AssistantMessages)
        .where(AssistantMessages.chat_id == chat.id)
    ).all()

    # sort messages by created_at
    messages = list(messages)
    messages = sorted(messages, key=lambda x: x.created_at)

    # Prepare conversation history from chat_id
    conversation_history = get_assistant_conversation_history(messages)
    input_items.extend(conversation_history)

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")
    
    # getting the provider from the model's provider_id
    provider = session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        api_key=provider.api_key,
        reasoning=agent.reasoning,
        mcp_servers=mcp_servers,
    )

    with trace(chat.title, trace_id=chat.trace_id):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items
        )

    # Store the result in active runs for potential cancellation using unified tracking
    from app.main import store_active_run
    chat_id_str = str(chat.id)
    store_active_run(chat_id_str, result)
    
    # Track active tool calls to match with their results
    active_tool_calls = {}
    
    try:
        # Process streaming events
        async for event in result.stream_events():
            logger.info(f"Processing event: type={event.type}, name={getattr(event, 'name', 'N/A')}")
            
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    yield chunk
            elif event.type == "run_item_stream_event":
                logger.info(f"Run item stream event: name={event.name}, item_type={type(event.item)}")
                
                if event.name == "tool_called" and isinstance(event.item, ToolCallItem):
                    logger.info(f"Processing tool_called event with item: {event.item}")
                    if isinstance(event.item.raw_item, ResponseFunctionToolCall):
                        tool_call = event.item.raw_item
                        name = tool_call.name
                        arguments = tool_call.arguments
                        tool_call_id = str(uuid.uuid4())  # Always generate our own UUID
                        
                        logger.info(f"Tool call details: name={name}, id={tool_call_id}, arguments={arguments}")
                        
                        # Store the tool call for later matching with results
                        active_tool_calls[tool_call_id] = {
                            'name': name,
                            'arguments': arguments
                        }
                        
                        logger.info(f"Tool called: {name} with arguments: {arguments}")
                        
                        # Yield structured tool call data
                        tool_call_data = {
                            'id': tool_call_id,
                            'name': name,
                            'arguments': arguments
                        }
                        tool_call_token = f"<tool_call_start>{json.dumps(tool_call_data)}</tool_call_start>"
                        logger.info(f"Yielding tool call token: {tool_call_token}")
                        yield tool_call_token
                        
                elif event.name == "tool_output" and isinstance(event.item, ToolCallOutputItem):
                    logger.info(f"Processing tool_output event with item: {event.item}")
                    output = event.item.output
                    logger.info(f"Tool output: {output}")
                    
                    # Try to match this output with a tool call
                    # Since we don't have a direct ID mapping, we'll use the most recent tool call
                    if active_tool_calls:
                        # Get the most recent tool call (assuming FIFO processing)
                        tool_call_id = list(active_tool_calls.keys())[-1]
                        tool_call_info = active_tool_calls[tool_call_id]
                        
                        logger.info(f"Matching tool output to call ID: {tool_call_id}")
                        
                        # Yield structured tool result data
                        tool_result_data = {
                            'id': tool_call_id,
                            'name': tool_call_info['name'],
                            'result': output
                        }
                        tool_result_token = f"<tool_call_result>{json.dumps(tool_result_data)}</tool_call_result>"
                        logger.info(f"Yielding tool result token: {tool_result_token}")
                        yield tool_result_token
                        
                        # Remove the processed tool call
                        del active_tool_calls[tool_call_id]
                    else:
                        logger.warning("Received tool output but no active tool calls to match")
                else:
                    logger.info(f"Unhandled run_item_stream_event: {event.name}")
            else:
                logger.info(f"Unhandled event type: {event.type}")

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
        from app.main import active_runs
        if chat_id_str in active_runs:
            del active_runs[chat_id_str]

