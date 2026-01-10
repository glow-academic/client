"""Unified artifact generation handler - handles ALL generation logic inline using LiteLLM."""

import asyncio
import base64
import json
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, cast

import httpx
import websockets
from agents.items import TResponseInputItem
from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import IMAGE_FOLDER, VIDEO_FOLDER, get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (CompleteImageGenerationSqlParams,
                           CompleteImageGenerationSqlRow,
                           CreateGenerationAndLinkSqlParams,
                           CreateGenerationAndLinkSqlRow,
                           GetAudioRunContextAndCreateRunSqlParams,
                           GetAudioRunContextAndCreateRunSqlRow,
                           GetGenerationRunContextAndCreateRunSqlParams,
                           GetGenerationRunContextAndCreateRunSqlRow,
                           GetImageGenerationContextAndCreateUploadSqlParams,
                           GetImageGenerationContextAndCreateUploadSqlRow,
                           GetMessagesByIdsSqlParams, GetMessagesByIdsSqlRow,
                           GetMessagesByRunIdSqlParams,
                           GetMessagesByRunIdSqlRow,
                           GetTextRunContextForExistingRunSqlParams,
                           GetTextRunContextForExistingRunSqlRow,
                           GetVideoRunContextAndCreateRunSqlParams,
                           GetVideoRunContextAndCreateRunSqlRow,
                           IGetTextRunContextAndCreateRunV4Tool,
                           InsertUploadSqlParams, InsertUploadSqlRow,
                           TextToolProgressUpdateSqlParams,
                           TextToolProgressUpdateSqlRow)
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/generate/start/get_generation_run_context_and_create_run_complete.sql"
SQL_PATH_TEXT = "app/sql/v4/generate/text/get_text_run_context_for_existing_run_complete.sql"
SQL_PATH_MESSAGES_BY_IDS = "app/sql/v4/messages/get_messages_by_ids_complete.sql"
SQL_PATH_MESSAGES_BY_RUN = "app/sql/v4/messages/get_messages_by_run_id_complete.sql"
SQL_PATH_IMAGE = "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"
SQL_PATH_VIDEO = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"
SQL_PATH_AUDIO = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"
SQL_PATH_TEXT_TOOL_PROGRESS = "app/sql/v4/generate/text/text_tool_progress_update_complete.sql"

# Try to import litellm
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

from app.main import UPLOAD_FOLDER


def determine_modality_from_output_modalities(
    output_modalities: list[str] | None
) -> str:
    """Determine handler modality from model's output_modalities.
    
    Prefers 'text' if available, otherwise uses first modality.
    Falls back to 'text' if no modalities provided.
    """
    if not output_modalities or len(output_modalities) == 0:
        return "text"  # Default fallback
    
    # Prefer text if available (most common)
    if "text" in output_modalities:
        return "text"
    
    # Otherwise use first modality
    return output_modalities[0]


# ----------------------------
# Streaming parser state classes
# ----------------------------
@dataclass
class TextState:
    started: bool = False
    buffer: str = ""


@dataclass
class ToolFnState:
    name: str | None = None
    arguments: str = ""


@dataclass
class ToolCallState:
    id: str | None = None
    type: str = "function"
    function: ToolFnState = field(default_factory=ToolFnState)


@dataclass
class ChoiceState:
    text: TextState = field(default_factory=TextState)
    tool_calls: dict[int, ToolCallState] = field(default_factory=dict)
    finish_reason: str | None = None


# ----------------------------
# Helper functions for litellm integration
# ----------------------------
def _convert_tools_to_openai_format(
    tools: list[IGetTextRunContextAndCreateRunV4Tool],
) -> list[dict[str, Any]]:
    """Convert database tool configs to OpenAI tool format.
    
    Args:
        tools: List of tool configs from database
        
    Returns:
        List of OpenAI tool format dictionaries
    """
    openai_tools: list[dict[str, Any]] = []
    
    for tool in tools:
        if not tool.name or not tool.active:
            continue
            
        # Build properties from arguments JSONB
        properties: dict[str, Any] = {}
        required_fields: list[str] = []
        
        arguments = tool.arguments or {}
        argument_descriptions = tool.argument_descriptions or {}
        
        if isinstance(arguments, dict):
            for field_name, field_spec in arguments.items():
                if not isinstance(field_spec, dict):
                    continue
                    
                field_type = field_spec.get("type", "string")
                field_required = field_spec.get("required", False)
                field_description = argument_descriptions.get(field_name, "")
                
                # Map database types to JSON Schema types
                json_schema_type = "string"
                if field_type == "integer":
                    json_schema_type = "integer"
                elif field_type == "number":
                    json_schema_type = "number"
                elif field_type == "boolean":
                    json_schema_type = "boolean"
                elif field_type == "array":
                    json_schema_type = "array"
                    # Handle array items if specified
                    items_type = field_spec.get("items", {}).get("type", "string")
                    properties[field_name] = {
                        "type": "array",
                        "items": {"type": items_type},
                        "description": field_description,
                    }
                elif field_type == "object":
                    json_schema_type = "object"
                    properties[field_name] = {
                        "type": "object",
                        "description": field_description,
                    }
                else:
                    properties[field_name] = {
                        "type": json_schema_type,
                        "description": field_description,
                    }
                
                if json_schema_type not in ("array", "object"):
                    properties[field_name] = {
                        "type": json_schema_type,
                        "description": field_description,
                    }
                
                if field_required:
                    required_fields.append(field_name)
        
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description or "",
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required_fields,
                },
            },
        }
        openai_tools.append(openai_tool)
    
    return openai_tools


def _format_messages_for_litellm(
    input_items: list[TResponseInputItem],
) -> list[dict[str, Any]]:
    """Convert input_items to litellm message format.
    
    Args:
        input_items: List of TResponseInputItem
        
    Returns:
        List of message dictionaries for litellm
    """
    messages: list[dict[str, Any]] = []
    
    for item in input_items:
        role = item.get("role", "user")
        content = item.get("content", "")
        
        # Handle audio file paths if present
        if isinstance(content, str) and "Audio file to process:" in content:
            # For now, just include as text - litellm can handle file paths
            # TODO: Convert to proper audio format if needed
            messages.append({
                "role": role,
                "content": content,
            })
        else:
            messages.append({
                "role": role,
                "content": content,
            })
    
    return messages


async def _stream_litellm_events(
    stream: AsyncIterator[Any],
) -> AsyncIterator[dict[str, Any]]:
    """Convert litellm streaming chunks into structured events.
    
    Yields events:
    - text_start: First text delta received
    - text_delta: Incremental text content
    - text_complete: Text streaming complete
    - tool_call_start: Tool call started
    - tool_call_delta: Incremental tool call arguments
    - tool_call_complete: Tool call complete (when finish_reason received)
    - message_complete: Message complete with finish_reason
    
    Args:
        stream: AsyncIterator from litellm.acompletion(stream=True)
        
    Yields:
        Event dictionaries with 'type' and relevant fields
    """
    choices: dict[int, ChoiceState] = {}
    
    def get_choice_state(choice_index: int) -> ChoiceState:
        if choice_index not in choices:
            choices[choice_index] = ChoiceState()
        return choices[choice_index]
    
    async for chunk in stream:
        # Handle both dict and ModelResponse types
        if hasattr(chunk, "choices"):
            chunk_choices = chunk.choices
        elif isinstance(chunk, dict):
            chunk_choices = chunk.get("choices", [])
        else:
            continue
        
        for ch in chunk_choices:
            # Get choice index
            if hasattr(ch, "index"):
                i = ch.index
            elif isinstance(ch, dict):
                i = ch.get("index", 0)
            else:
                i = 0
            
            st = get_choice_state(i)
            
            # Get delta
            if hasattr(ch, "delta"):
                delta = ch.delta
            elif isinstance(ch, dict):
                delta = ch.get("delta", {})
            else:
                delta = {}
            
            # Get finish_reason
            if hasattr(ch, "finish_reason"):
                finish_reason = ch.finish_reason
            elif isinstance(ch, dict):
                finish_reason = ch.get("finish_reason")
            else:
                finish_reason = None
            
            # Handle role signals
            if isinstance(delta, dict):
                role = delta.get("role")
                if role == "assistant":
                    yield {"type": "assistant_role", "choice_index": i}
                
                # Handle text streaming (content)
                content_piece = delta.get("content")
                if content_piece:
                    if not st.text.started:
                        st.text.started = True
                        yield {"type": "text_start", "choice_index": i}
                    st.text.buffer += content_piece
                    yield {
                        "type": "text_delta",
                        "choice_index": i,
                        "delta": content_piece,
                    }
                
                # Handle tool-call streaming
                tool_calls_delta = delta.get("tool_calls") or []
                for tc in tool_calls_delta:
                    if not isinstance(tc, dict):
                        continue
                    
                    tc_index = tc.get("index", 0)
                    
                    # Initialize state for this tool call index
                    if tc_index not in st.tool_calls:
                        st.tool_calls[tc_index] = ToolCallState()
                        yield {
                            "type": "tool_call_start",
                            "choice_index": i,
                            "tool_index": tc_index,
                        }
                    
                    tc_state = st.tool_calls[tc_index]
                    
                    # id/type can arrive late or early
                    if tc.get("id"):
                        tc_state.id = tc["id"]
                    if tc.get("type"):
                        tc_state.type = tc["type"]
                    
                    fn = tc.get("function") or {}
                    if fn.get("name"):
                        tc_state.function.name = fn["name"]
                    
                    # arguments often arrive in multiple chunks; concatenate
                    args_piece = fn.get("arguments")
                    if args_piece:
                        tc_state.function.arguments += args_piece
                        yield {
                            "type": "tool_call_delta",
                            "choice_index": i,
                            "tool_index": tc_index,
                            "delta": args_piece,
                        }
            
            # Handle completion signals
            if finish_reason is not None:
                st.finish_reason = finish_reason
                
                # Extract usage if available in chunk
                usage_data: dict[str, Any] | None = None
                if hasattr(chunk, "usage"):
                    usage_obj = chunk.usage
                    if hasattr(usage_obj, "prompt_tokens"):
                        usage_data = {
                            "prompt_tokens": usage_obj.prompt_tokens,
                            "completion_tokens": getattr(usage_obj, "completion_tokens", 0),
                        }
                elif isinstance(chunk, dict):
                    usage_data = chunk.get("usage")
                
                complete_event: dict[str, Any] = {
                    "type": "message_complete",
                    "choice_index": i,
                    "finish_reason": finish_reason,
                }
                if usage_data:
                    complete_event["usage"] = usage_data
                
                yield complete_event
                
                # If we have tool calls, emit tool_call_complete for each
                if st.tool_calls:
                    for tc_index, tc_state in st.tool_calls.items():
                        yield {
                            "type": "tool_call_complete",
                            "choice_index": i,
                            "tool_index": tc_index,
                            "id": tc_state.id,
                            "name": tc_state.function.name,
                            "arguments": tc_state.function.arguments,
                        }
                
                # If text started, emit text_complete
                if st.text.started:
                    yield {
                        "type": "text_complete",
                        "choice_index": i,
                        "text": st.text.buffer,
                    }


async def _generate_artifact_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
) -> None:
    """Unified entry point for all artifact generation - handles ALL logic inline."""
    try:
        async with get_db_connection() as conn:
            # Get output_modalities from payload (from generate_start) or query
            if data.get("run_id") and data.get("output_modalities"):
                # Use from payload (already created run via generate_start)
                output_modalities = data.get("output_modalities")
                modality = determine_modality_from_output_modalities(output_modalities)
                # Use existing run_id, group_id, trace_id from payload
                run_id = data["run_id"]
                group_id = data.get("group_id")
                trace_id = data.get("trace_id")
                message_ids = data.get("message_ids", [])
                agent_id = data.get("agent_id")
            else:
                # Create run via SQL (direct call to generate_artifact)
                try:
                    # Convert message_ids to UUID array if provided
                    message_ids_uuid = (
                        [uuid.UUID(mid) for mid in data.get("message_ids", [])]
                        if data.get("message_ids")
                        else None
                    )

                    # Handle both domain_id (new) and agent_id (legacy) for backward compatibility
                    domain_id = data.get("domain_id")
                    agent_id = data.get("agent_id")
                    if domain_id:
                        # Look up agent_id from domain_id
                        domain_lookup_sql = "SELECT agent_id FROM domains WHERE id = $1"
                        agent_id_from_domain = await conn.fetchval(domain_lookup_sql, uuid.UUID(domain_id))
                        if not agent_id_from_domain:
                            raise ValueError(f"Domain not found: {domain_id}")
                        agent_id = str(agent_id_from_domain)
                    elif not agent_id:
                        raise ValueError("Either domain_id or agent_id must be provided")
                    
                    params = GetGenerationRunContextAndCreateRunSqlParams(
                        agent_id=uuid.UUID(agent_id),
                        resource_id=uuid.UUID(data["resource_id"]),
                        resource_type=data["resource_type"],
                        profile_id=profile_id,
                        message_ids=message_ids_uuid,
                        department_id=None,  # Can be NULL, modality handlers will get it
                        group_id=uuid.UUID(data["group_id"]) if data.get("group_id") else None,
                        user_instructions=data.get("user_instructions"),
                        developer_message_contentss=data.get("developer_message_contents"),
                    )
                    result = cast(
                        GetGenerationRunContextAndCreateRunSqlRow,
                        await execute_sql_typed(conn, SQL_PATH, params=params),
                    )
                except Exception as e:
                    import asyncpg  # type: ignore

                    error_msg = str(e)
                    # Check if it's a rate limit error from SQL
                    if (
                        isinstance(e, asyncpg.PostgresError)
                        and "RATE_LIMIT_EXCEEDED" in error_msg
                    ):
                        user_msg = (
                            error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                            if "RATE_LIMIT_EXCEEDED: " in error_msg
                            else error_msg
                        )
                        await emit_to_internal(
                            "generate_error",
                            GenerateErrorApiRequest(
                                sid=sid,
                                error_message=user_msg,
                                resource_id=data.get("resource_id"),
                                group_id=data.get("group_id"),
                                resource_type=data.get("resource_type"),
                            ),
                            sid=sid,
                        )
                        return
                    # Other errors
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Failed to start generation: {str(e)}",
                            resource_id=data.get("resource_id"),
                            group_id=data.get("group_id"),
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
                    return

                if not result:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message="Failed to create run",
                            resource_id=data.get("resource_id"),
                            group_id=data.get("group_id"),
                            resource_type=data.get("resource_type"),
                        ),
                        sid=sid,
                    )
                    return

                modality = determine_modality_from_output_modalities(result.output_modalities)
                run_id = result.run_id
                group_id = str(result.group_id) if result.group_id else None
                trace_id = result.trace_id
                message_ids = [str(mid) for mid in (result.message_ids or [])]
                agent_id = data.get("agent_id") or str(uuid.UUID(result.run_id))  # Fallback

            # Route to appropriate modality handler
            if modality == "text" or modality == "call" or modality == "document":
                await _handle_text_generation(
                    sid=sid,
                    data=data,
                    profile_id=profile_id,
                    conn=conn,
                    run_id=uuid.UUID(run_id),
                    agent_id=uuid.UUID(agent_id) if agent_id else None,
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                    message_ids=[uuid.UUID(mid) for mid in message_ids] if message_ids else None,
                    group_id=uuid.UUID(group_id) if group_id else None,
                    trace_id=trace_id,
                    tool_choice="required" if modality == "call" else "auto",
                )
            elif modality == "image":
                await _handle_image_generation(
                    sid=sid,
                    data=data,
                    profile_id=profile_id,
                    conn=conn,
                    run_id=uuid.UUID(run_id),
                    agent_id=uuid.UUID(agent_id) if agent_id else None,
                    resource_id=uuid.UUID(data["resource_id"]),
                    trace_id=trace_id,
                )
            elif modality == "video":
                await _handle_video_generation(
                    sid=sid,
                    data=data,
                    profile_id=profile_id,
                    conn=conn,
                    run_id=uuid.UUID(run_id),
                    resource_id=uuid.UUID(data["resource_id"]),
                    trace_id=trace_id,
                )
            elif modality == "audio":
                await _handle_audio_generation(
                    sid=sid,
                    data=data,
                    profile_id=profile_id,
                    conn=conn,
                    run_id=uuid.UUID(run_id),
                    agent_id=uuid.UUID(agent_id) if agent_id else None,
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                )
            else:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Modality {modality} not yet supported",
                        resource_id=data.get("resource_id"),
                        group_id=group_id,
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate artifact: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )


async def _handle_text_generation(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
    conn: Any,
    run_id: uuid.UUID,
    agent_id: uuid.UUID | None,
    resource_id: uuid.UUID,
    resource_type: str,
    message_ids: list[uuid.UUID] | None,
    group_id: uuid.UUID | None,
    trace_id: str | None,
    tool_choice: str = "auto",
) -> None:
    """Handle text generation using litellm directly."""
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")
    
    if not agent_id:
        raise ValueError("agent_id is required for text generation")

    # Get text context from SQL
    params = GetTextRunContextForExistingRunSqlParams(
        run_id=run_id,
        agent_id=agent_id,
        resource_id=resource_id,
        resource_type=resource_type,
        message_ids=message_ids,
        group_id=group_id,
    )
    result = cast(
        GetTextRunContextForExistingRunSqlRow,
        await execute_sql_typed(conn, SQL_PATH_TEXT, params=params),
    )

    if not result:
        raise ValueError("Run not found or no agent configured")

    # Decrypt API key
    if not result.api_key:
        raise ValueError(f"API key not found for agent {agent_id}")

    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    # Build tools from database configs
    agent_tools_config = [
        tool for tool in (result.tools or []) if tool.name is not None
    ]

    # Convert tools to OpenAI format
    openai_tools = _convert_tools_to_openai_format(agent_tools_config)

    # Construct input items for the agent
    input_items: list[TResponseInputItem] = []

    # Handle audio input if upload_id is provided
    if result.upload_id and result.file_path:
        audio_file_path = UPLOAD_FOLDER / result.file_path
        if audio_file_path.exists():
            audio_input: TResponseInputItem = {
                "role": "user",
                "content": f"Audio file to process: {audio_file_path}",
            }
            input_items.append(audio_input)

    # Get all messages linked to the run (system/developer messages from previous runs)
    try:
        run_messages_params = GetMessagesByRunIdSqlParams(run_id=run_id)
        run_messages_result = cast(
            GetMessagesByRunIdSqlRow,
            await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_RUN, params=run_messages_params),
        )
        if run_messages_result.messages:
            for msg in run_messages_result.messages:
                if msg.role in ("system", "developer"):
                    input_items.append({  # type: ignore[arg-type]
                        "role": msg.role,
                        "content": msg.content or "",
                    })
    except Exception:
        import logging
        logging.getLogger(__name__).warning(f"Failed to fetch run messages")

    # Get messages from message_ids (user regeneration message + context messages)
    if message_ids:
        try:
            messages_params = GetMessagesByIdsSqlParams(message_ids=message_ids)
            messages_result = cast(
                GetMessagesByIdsSqlRow,
                await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_IDS, params=messages_params),
            )
            if messages_result.messages:
                for msg in messages_result.messages:
                    if msg.role not in ("system", "developer"):
                        input_items.append({  # type: ignore[arg-type]
                            "role": msg.role,
                            "content": msg.content or "",
                        })
        except Exception:
            import logging
            logging.getLogger(__name__).warning(f"Failed to fetch messages by IDs")

    # Format messages for litellm
    messages = _format_messages_for_litellm(input_items)
    
    # Add system prompt if present
    if result.system_prompt:
        messages.insert(0, {
            "role": "system",
            "content": result.system_prompt,
        })

    # Track completed tool names for verification
    required_tool_names: set[str] = {
        tool.name for tool in agent_tools_config if tool.name is not None
    }
    tool_name_to_type: dict[str, str] = {
        tool.name: tool.tool_type
        for tool in agent_tools_config
        if tool.name is not None and tool.tool_type is not None
    }

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "text",
            "sid": sid,
            "resource_id": str(resource_id),
            "resource_type": resource_type,
            "run_id": str(run_id),
            "group_id": str(group_id) if group_id else None,
            "type": "start",
            "message": f"Starting {result.agent_name or 'text'} generation",
        },
    )

    # Prepare litellm completion parameters
    completion_kwargs: dict[str, Any] = {
        "model": result.model_name or "",
        "messages": messages,
        "stream": True,
        "api_key": decrypted_api_key,
        "temperature": result.temperature or 0.0,
    }
    
    if result.base_url:
        completion_kwargs["base_url"] = result.base_url
    
    if openai_tools:
        completion_kwargs["tools"] = openai_tools
        completion_kwargs["tool_choice"] = tool_choice
    
    # Handle reasoning if present
    if result.reasoning:
        completion_kwargs["extra_body"] = {"reasoning": result.reasoning}

    # Call litellm with streaming
    resource_id_str = str(group_id) if group_id else sid
    stream = await litellm.acompletion(**completion_kwargs)

    # Store stream reference for potential cancellation
    # Note: litellm streams don't have a direct cancellation method,
    # but we store it for consistency with existing patterns
    await store_active_run(resource_id_str, stream)

    completed_tool_names: set[str] = set()
    assistant_output = ""
    input_tokens = 0
    output_tokens = 0
    
    # Track tool calls for persistence
    tool_call_states: dict[str, dict[str, Any]] = {}  # tool_call_id -> state

    try:
        # Process streaming events
        async for event in _stream_litellm_events(stream):
            event_type = event.get("type")
            
            if event_type == "text_start":
                # Text streaming started
                pass  # Already emitted start event above
            
            elif event_type == "text_delta":
                # Emit text token
                delta = event.get("delta", "")
                if delta:
                    assistant_output += delta
                    await internal_sio.emit(
                        "generate_progress",
                        {
                            "modality": "text",
                            "sid": sid,
                            "resource_id": str(resource_id),
                            "resource_type": resource_type,
                            "run_id": str(run_id),
                            "group_id": str(group_id) if group_id else None,
                            "type": "token",
                            "text": delta,
                        },
                    )
            
            elif event_type == "tool_call_start":
                # Tool call started
                tool_index = event.get("tool_index", 0)
                tool_call_id = f"call_{run_id}_{tool_index}"
                
                tool_call_states[tool_call_id] = {
                    "tool_index": tool_index,
                    "call_id": None,
                    "tool_name": None,
                    "arguments": "",
                }
                
                await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "resource_id": str(resource_id),
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "tool_call_start",
                        "tool_call_id": tool_call_id,
                        "tool_name": None,  # Will be set when we get name
                    },
                )
                
                # Persist tool call start
                try:
                    progress_params = TextToolProgressUpdateSqlParams(
                        run_id=run_id,
                        tool_call_id=tool_call_id,
                        progress_type="tool_call_start",
                        call_id=None,
                        tool_name=None,
                        arguments_delta="",
                        resource_id=resource_id,
                    )
                    await execute_sql_typed(conn, SQL_PATH_TEXT_TOOL_PROGRESS, params=progress_params)
                except Exception:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to persist tool call start")
            
            elif event_type == "tool_call_delta":
                # Tool call arguments delta
                tool_index = event.get("tool_index", 0)
                tool_call_id = f"call_{run_id}_{tool_index}"
                delta = event.get("delta", "")
                
                if tool_call_id in tool_call_states:
                    tool_call_states[tool_call_id]["arguments"] += delta
                
                await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "resource_id": str(resource_id),
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "tool_call_progress",
                        "tool_call_id": tool_call_id,
                        "arguments_delta": delta,
                    },
                )
                
                # Persist tool call progress
                try:
                    progress_params = TextToolProgressUpdateSqlParams(
                        run_id=run_id,
                        tool_call_id=tool_call_id,
                        progress_type="tool_call_progress",
                        call_id=tool_call_states.get(tool_call_id, {}).get("call_id"),
                        tool_name=tool_call_states.get(tool_call_id, {}).get("tool_name"),
                        arguments_delta=delta,
                        resource_id=resource_id,
                    )
                    await execute_sql_typed(conn, SQL_PATH_TEXT_TOOL_PROGRESS, params=progress_params)
                except Exception:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to persist tool call progress")
            
            elif event_type == "tool_call_complete":
                # Tool call complete
                tool_call_id = event.get("id") or f"call_{run_id}_{event.get('tool_index', 0)}"
                tool_name = event.get("name", "")
                arguments_str = event.get("arguments", "")
                
                # Parse arguments
                try:
                    arguments_dict = json.loads(arguments_str) if arguments_str else {}
                except json.JSONDecodeError:
                    arguments_dict = {}
                
                # Update state
                if tool_call_id not in tool_call_states:
                    tool_call_states[tool_call_id] = {
                        "tool_index": event.get("tool_index", 0),
                        "call_id": tool_call_id,
                        "tool_name": tool_name,
                        "arguments": arguments_str,
                    }
                else:
                    tool_call_states[tool_call_id]["call_id"] = tool_call_id
                    tool_call_states[tool_call_id]["tool_name"] = tool_name
                    tool_call_states[tool_call_id]["arguments"] = arguments_str
                
                completed_tool_names.add(tool_name)
                
                # Persist tool call complete
                try:
                    progress_params = TextToolProgressUpdateSqlParams(
                        run_id=run_id,
                        tool_call_id=tool_call_id,
                        progress_type="tool_call_complete",
                        call_id=tool_call_id,
                        tool_name=tool_name,
                        arguments_delta=arguments_str,
                        resource_id=resource_id,
                    )
                    progress_result = cast(
                        TextToolProgressUpdateSqlRow,
                        await execute_sql_typed(conn, SQL_PATH_TEXT_TOOL_PROGRESS, params=progress_params),
                    )
                    
                    # TODO: Execute tool (create resource)
                    # This is where we would call the actual tool function to create the resource
                    # For now, tool calls are persisted but not executed
                    
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to persist tool call complete: {e}")
                
                await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "resource_id": str(resource_id),
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "tool_call_complete",
                        "tool_call_id": tool_call_id,
                        "tool_name": tool_name,
                        "arguments": arguments_dict,
                    },
                )
            
            elif event_type == "message_complete":
                # Message complete - extract usage if available
                if "usage" in event:
                    usage_data = event["usage"]
                    if isinstance(usage_data, dict):
                        input_tokens = usage_data.get("prompt_tokens", 0)
                        output_tokens = usage_data.get("completion_tokens", 0)
            
            elif event_type == "text_complete":
                # Text streaming complete
                assistant_output = event.get("text", assistant_output)

    except BaseException as stream_error:
        if isinstance(
            stream_error,
            (asyncio.CancelledError, KeyboardInterrupt, SystemExit),
        ):
            raise
        raise
    finally:
        await remove_active_run(resource_id_str)

    # Verify all required tools were called
    missing_tools = required_tool_names - completed_tool_names
    if missing_tools:
        tool_names_str = ", ".join(sorted(missing_tools))
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=(
                    f"Agent did not call all required tools. "
                    f"Missing: {tool_names_str}"
                ),
                resource_id=str(resource_id),
                group_id=str(group_id) if group_id else None,
                resource_type=resource_type,
            ),
            sid=sid,
        )
        return

    # Emit run completion event with usage data
    await internal_sio.emit(
        "generate_complete",
        {
            "modality": "text",
            "sid": sid,
            "type": "run_complete",
            "resource_id": str(resource_id),
            "resource_type": resource_type,
            "run_id": str(run_id),
            "group_id": str(group_id) if group_id else None,
            "input_text_tokens": input_tokens,
            "output_text_tokens": output_tokens,
            "system_prompt": result.system_prompt or "",
            "input_items": input_items,
            "assistant_output": assistant_output,
        },
    )


async def _handle_image_generation(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
    conn: Any,
    run_id: uuid.UUID,
    agent_id: uuid.UUID | None,
    resource_id: uuid.UUID,
    trace_id: str | None,
) -> None:
    """Handle image generation using LiteLLM."""
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

    if not agent_id:
        raise ValueError("agent_id is required for image generation")

    image_id = uuid.UUID(data.get("image_id") or data.get("resource_id"))
    prompt = data.get("prompt", "")

    # Get image context from SQL
    params = GetImageGenerationContextAndCreateUploadSqlParams(
        image_id=image_id,
        agent_id=agent_id,
        profile_id=profile_id,
        department_id=uuid.UUID(data["department_id"]) if data.get("department_id") else None,
    )
    result = cast(
        GetImageGenerationContextAndCreateUploadSqlRow,
        await execute_sql_typed(conn, SQL_PATH_IMAGE, params=params),
    )

    if not result:
        raise ValueError(f"Agent {agent_id} not found or inactive")

    if not result.api_key:
        raise ValueError(f"API key not found for agent {agent_id}")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "image",
            "sid": sid,
            "resource_id": str(resource_id),
            "resource_type": "images",
            "run_id": str(run_id),
            "type": "start",
            "message": "Starting image generation",
        },
    )

    # Check if model supports native image generation (Gemini 3.0)
    model_name = result.model_name or ""
    if model_name.startswith("gemini-3") or "gemini-3" in model_name.lower():
        # Use native image generation via completion
        try:
            import litellm
            resp = await litellm.acompletion(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                modalities=["text", "image"],
                api_key=decrypted_api_key,
            )

            # Extract image_part
            if resp.choices and resp.choices[0].message.images:
                image_data = resp.choices[0].message.images[0]["image_url"]["url"]
                # Extract base64 data
                if image_data.startswith("data:image"):
                    base64_data = image_data.split(",")[1]
                    gemini_image_bytes = base64.b64decode(base64_data)
                    mime_type = "image/png"  # Default for Gemini
                    file_size = len(gemini_image_bytes)

                    # Persist image
                    image_name = data.get("name", "image")
                    file_path = await _persist_image(conn, image_id, gemini_image_bytes, mime_type, file_size, image_name)

                    # Emit completion
                    await internal_sio.emit(
                        "generate_complete",
                        {
                            "modality": "image",
                            "sid": sid,
                            "resource_id": str(resource_id),
                            "resource_type": "images",
                            "run_id": str(run_id),
                            "image_id": str(image_id),
                            "file_path": file_path,
                            "mime_type": mime_type,
                            "file_size": file_size,
                            "trace_id": trace_id,
                        },
                    )
                    return
        except Exception as e:
            # Fall back to image_generation if native fails
            import logging
            logging.getLogger(__name__).warning(f"Native image generation failed: {e}, falling back to image_generation")

    # Use litellm.image_generation()
    try:
        import litellm
        response = await litellm.aimage_generation(
            prompt=prompt,
            model=model_name,
            api_key=decrypted_api_key,
            base_url=result.base_url if result.base_url else None,
        )

        # Extract image URL or bytes from response
        image_url: str | None = None
        image_bytes: bytes | None = None

        if isinstance(response, dict):
            if "data" in response and len(response["data"]) > 0:
                data_item = response["data"][0]
                image_url = data_item.get("url")
                if not image_url:
                    b64_json = data_item.get("b64_json")
                    if b64_json:
                        image_bytes = base64.b64decode(b64_json)
        elif isinstance(response, str):
            image_url = response

        if not image_url and not image_bytes:
            raise ValueError(f"No image data returned from litellm for image {image_id}")

        # Download image if URL provided
        if image_url and not image_bytes:
            async with httpx.AsyncClient() as http_client:
                img_response = await http_client.get(image_url, timeout=30.0)
                img_response.raise_for_status()
                image_bytes = img_response.content

        # Determine mime type
        mime_type = "image/png"
        if image_url:
            if ".jpg" in image_url or ".jpeg" in image_url:
                mime_type = "image/jpeg"
            elif ".gif" in image_url:
                mime_type = "image/gif"

        file_size = len(image_bytes) if image_bytes else 0

        # Persist image (ensure image_bytes is not None)
        if not image_bytes:
            raise ValueError(f"No image data available for image {image_id}")
        
        image_name = data.get("name", "image")
        file_path = await _persist_image(conn, image_id, image_bytes, mime_type, file_size, image_name)

        # Emit completion
        await internal_sio.emit(
            "generate_complete",
            {
                "modality": "image",
                "sid": sid,
                "resource_id": str(resource_id),
                "resource_type": "images",
                "run_id": str(run_id),
                "image_id": str(image_id),
                "file_path": file_path,
                "mime_type": mime_type,
                "file_size": file_size,
                "trace_id": trace_id,
            },
        )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Image generation failed: {str(e)}",
                resource_id=str(resource_id),
                resource_type="images",
            ),
            sid=sid,
        )


async def _handle_video_generation(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
    conn: Any,
    run_id: uuid.UUID,
    resource_id: uuid.UUID,
    trace_id: str | None,
) -> None:
    """Handle video generation using OpenAI Sora API or LiteLLM."""
    video_id = uuid.UUID(data.get("videoId") or data.get("resource_id"))
    prompt = data.get("prompt", "")
    image_reference_id = data.get("imageReferenceId")

    # Create upload record first
    sql_query = load_sql("app/sql/v4/uploads/insert_upload_complete.sql")
    upload_params = InsertUploadSqlParams(
        file_path="",  # Will be set during persistence
        mime_type="video/mp4",
        size=0,  # Will be updated after generation
    )
    upload_result = cast(
        InsertUploadSqlRow,
        await execute_sql_typed(conn, sql_query, params=upload_params),
    )
    if not upload_result or not upload_result.id:
        raise ValueError("Failed to create upload record")

    upload_id = uuid.UUID(upload_result.id)

    # Get video context from SQL
    params = GetVideoRunContextAndCreateRunSqlParams(
        video_id=video_id,
        profile_id=profile_id,
    )
    result = cast(
        GetVideoRunContextAndCreateRunSqlRow,
        await execute_sql_typed(conn, SQL_PATH_VIDEO, params=params),
    )

    if not result:
        raise ValueError(f"No video agent configured for video {video_id}")

    if not result.api_key:
        raise ValueError(f"API key not found for video agent")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except ValueError as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "video",
            "sid": sid,
            "resource_id": str(resource_id),
            "resource_type": "videos",
            "run_id": str(run_id),
            "type": "start",
            "message": "Starting video generation",
            "status": "created",
            "progress": None,
            "video_id": str(video_id),
        },
    )

    # Use OpenAI Sora API directly (or LiteLLM video_generation if available)
    model_name = result.model_name or ""
    if model_name.startswith("sora") or "sora" in model_name.lower():
        # OpenAI Sora API
        from openai import OpenAI

        client = OpenAI(api_key=decrypted_api_key)

        # Hardcoded values per existing pattern
        seconds: str = "4"
        model: str = "sora-2"
        size: str = "720x1280"

        # Create video job
        create_params: dict[str, Any] = {
            "prompt": prompt,
            "model": model,
            "seconds": seconds,
            "size": size,
        }
        if image_reference_id:
            create_params["image_reference_id"] = image_reference_id

        video_job = await asyncio.to_thread(client.videos.create, **create_params)

        video_job_id = video_job.id
        # Poll for completion with progress updates
        max_polls = 60  # 5 minutes max (5 second intervals)
        poll_count = 0
        while poll_count < max_polls:
            video_status = await asyncio.to_thread(
                client.videos.retrieve, video_job_id
            )
            # Emit progress update
            progress_value = (
                video_status.progress / 100.0
                if video_status.progress is not None
                else None
            )
            await internal_sio.emit(
                "generate_progress",
                {
                    "modality": "video",
                    "sid": sid,
                    "resource_id": str(resource_id),
                    "resource_type": "videos",
                    "run_id": str(run_id),
                    "type": "polling",
                    "message": f"Video generation in progress: {video_status.status}",
                    "status": video_status.status,
                    "progress": progress_value,
                    "video_id": str(video_id),
                },
            )

            if video_status.status == "completed":
                # Download video using OpenAI client's download_content method
                video_response = await asyncio.to_thread(
                    client.videos.download_content, video_job_id
                )
                video_content_bytes: bytes = getattr(video_response, "content", b"")
                if not video_content_bytes:
                    if hasattr(video_response, "read"):
                        video_content_bytes = video_response.read()  # type: ignore[attr-defined]

                if not video_content_bytes:
                    raise ValueError("Video generation returned empty content")

                video_bytes = video_content_bytes

                # Persist video
                file_path = await _persist_video(conn, video_id, video_bytes, upload_id, run_id)

                # Emit completion
                await internal_sio.emit(
                    "generate_complete",
                    {
                        "modality": "video",
                        "sid": sid,
                        "resource_id": str(resource_id),
                        "resource_type": "videos",
                        "run_id": str(run_id),
                        "success": True,
                        "message": "Video generated successfully",
                        "videoUrl": f"/api/uploads/download/{upload_id}",
                        "video_id": str(video_id),
                    },
                )
                return

            if video_status.status == "failed":
                raise ValueError(f"Video generation failed: {video_status.error}")

            await asyncio.sleep(5)
            poll_count += 1

        raise ValueError("Video generation timed out")
    else:
        # Try LiteLLM video_generation (Veo3)
        if LITELLM_AVAILABLE:
            try:
                import litellm
                video_resp = await litellm.avideo_generation(
                    model=model_name,
                    prompt=prompt,
                    api_key=decrypted_api_key,
                )

                video_id_from_resp = video_resp.id if hasattr(video_resp, "id") else None
                if not video_id_from_resp:
                    raise ValueError("No video ID in response")

                # Poll status
                max_polls = 60
                poll_count = 0
                while poll_count < max_polls:
                    status_resp = await litellm.avideo_status(
                        video_id=video_id_from_resp,
                        api_key=decrypted_api_key,
                    )

                    status = status_resp.status if hasattr(status_resp, "status") else None
                    await internal_sio.emit(
                        "generate_progress",
                        {
                            "modality": "video",
                            "sid": sid,
                            "resource_id": str(resource_id),
                            "resource_type": "videos",
                            "run_id": str(run_id),
                            "type": "polling",
                            "message": f"Video generation in progress: {status}",
                            "status": status,
                            "progress": None,
                            "video_id": str(video_id),
                        },
                    )

                    if status == "completed":
                        # Download video
                        content_resp = await litellm.avideo_content(
                            video_id=video_id_from_resp,
                            api_key=decrypted_api_key,
                        )
                        video_bytes = content_resp if isinstance(content_resp, bytes) else b""

                        # Persist video
                        file_path = await _persist_video(conn, video_id, video_bytes, upload_id, run_id)

                        # Emit completion
                        await internal_sio.emit(
                            "generate_complete",
                            {
                                "modality": "video",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": "videos",
                                "run_id": str(run_id),
                                "success": True,
                                "message": "Video generated successfully",
                                "videoUrl": f"/api/uploads/download/{upload_id}",
                                "video_id": str(video_id),
                            },
                        )
                        return

                    if status == "failed":
                        raise ValueError("Video generation failed")

                    await asyncio.sleep(10)
                    poll_count += 1

                raise ValueError("Video generation timed out")
            except Exception as e:
                raise ValueError(f"LiteLLM video generation failed: {str(e)}")
        else:
            raise ValueError("Video generation not supported for this provider")


async def _handle_audio_generation(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
    conn: Any,
    run_id: uuid.UUID,
    agent_id: uuid.UUID | None,
    resource_id: uuid.UUID,
    resource_type: str,
) -> None:
    """Handle audio generation using direct WebSocket connection to OpenAI Realtime API."""
    if not agent_id:
        raise ValueError("agent_id is required for audio generation")

    # Get audio context from SQL
    upload_id_for_audio = (
        resource_id
        if resource_type == "audio"
        else uuid.UUID("00000000-0000-0000-0000-000000000000")  # Dummy UUID for voice
    )
    audio_params = GetAudioRunContextAndCreateRunSqlParams(
        upload_id=upload_id_for_audio,
        agent_id=agent_id,
        profile_id=profile_id,
        department_id=uuid.UUID(data["department_id"]) if data.get("department_id") else None,
    )
    audio_result = cast(
        GetAudioRunContextAndCreateRunSqlRow,
        await execute_sql_typed(conn, SQL_PATH_AUDIO, params=audio_params),
    )

    if not audio_result:
        raise ValueError("No audio agent configured")

    if not audio_result.api_key:
        raise ValueError("API key not found for audio agent")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(audio_result.api_key)
    except ValueError as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    model_name = audio_result.model_name or "gpt-4o-realtime-preview-2024-10-01"

    # Connect to OpenAI Realtime API WebSocket
    from urllib.parse import quote
    url = f"wss://api.openai.com/v1/realtime?model={quote(model_name)}"
    headers = {
        "Authorization": f"Bearer {decrypted_api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    try:
        async with websockets.connect(url, extra_headers=headers) as ws:
            # Emit session started event
            await internal_sio.emit(
                "generate_progress",
                {
                    "modality": "audio",
                    "sid": sid,
                    "resource_id": str(resource_id),
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "type": "session_started",
                    "model": model_name,
                },
            )

            # Configure session
            session_config: dict[str, Any] = {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": audio_result.system_prompt or "Be concise and helpful.",
                },
            }
            
            # TODO: Add tools and history formatting when needed
            # For now, send basic session config
            await ws.send(json.dumps(session_config))

            # Listen for events from OpenAI Realtime API
            async for message in ws:
                try:
                    event = json.loads(message)
                    event_type = event.get("type")

                    # Handle 14 OpenAI Realtime API events
                    if event_type == "session.created":
                        # Session created - ready to start
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "session_created",
                            },
                        )
                    elif event_type == "session.updated":
                        # Session updated - acknowledge
                        pass
                    elif event_type == "input_audio_buffer.speech_started":
                        # User started speaking
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "user_speech_started",
                                "item_id": event.get("item_id"),
                                "audio_start_ms": event.get("audio_start_ms", 0),
                            },
                        )
                    elif event_type == "input_audio_buffer.speech_stopped":
                        # User stopped speaking
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "user_speech_stopped",
                                "item_id": event.get("item_id"),
                            },
                        )
                    elif event_type == "conversation.item.input_audio_transcription.completed":
                        # User transcription completed
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "user_transcription_complete",
                                "item_id": event.get("item_id"),
                                "transcript": event.get("transcript"),
                            },
                        )
                    elif event_type == "response.created":
                        # Response started
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "response_started",
                                "response_id": event.get("response_id"),
                            },
                        )
                    elif event_type == "response.output_item.added":
                        # Output item added
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "output_item_added",
                                "item_id": event.get("item_id"),
                                "output_type": event.get("output_type"),
                            },
                        )
                    elif event_type == "response.output_item.done":
                        # Output item done
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "output_item_done",
                                "item_id": event.get("item_id"),
                            },
                        )
                    elif event_type == "response.audio_transcript.delta":
                        # Assistant transcription delta
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "audio_transcript_delta",
                                "delta": event.get("delta"),
                            },
                        )
                    elif event_type == "response.audio_transcript.done":
                        # Assistant transcription complete
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "audio_transcript_done",
                                "transcript": event.get("transcript"),
                            },
                        )
                    elif event_type == "response.audio.delta":
                        # Assistant audio delta - send to client
                        audio_delta = event.get("delta")
                        if audio_delta:
                            await internal_sio.emit(
                                "generate_progress",
                                {
                                    "modality": "audio",
                                    "sid": sid,
                                    "resource_id": str(resource_id),
                                    "resource_type": resource_type,
                                    "run_id": str(run_id),
                                    "type": "audio_delta",
                                    "audio": audio_delta,  # Base64 encoded audio
                                },
                            )
                    elif event_type == "response.function_call_arguments.delta":
                        # Tool call arguments delta
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "tool_call_progress",
                                "call_id": event.get("call_id"),
                                "arguments_delta": event.get("delta"),
                            },
                        )
                    elif event_type == "response.function_call.done":
                        # Tool call complete
                        await internal_sio.emit(
                            "generate_progress",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "tool_call_complete",
                                "call_id": event.get("call_id"),
                                "function_call": event.get("function_call"),
                            },
                        )
                    elif event_type == "response.done":
                        # Response complete
                        await internal_sio.emit(
                            "generate_complete",
                            {
                                "modality": "audio",
                                "sid": sid,
                                "resource_id": str(resource_id),
                                "resource_type": resource_type,
                                "run_id": str(run_id),
                                "type": "run_complete",
                            },
                        )
                        break  # Exit receive loop after completion
                    elif event_type == "error":
                        # Error event
                        error_data = event.get("error", {})
                        await emit_to_internal(
                            "generate_error",
                            GenerateErrorApiRequest(
                                sid=sid,
                                error_message=error_data.get("message", "Unknown error"),
                                resource_id=str(resource_id),
                                resource_type=resource_type,
                            ),
                            sid=sid,
                        )
                        break  # Exit on error
                except json.JSONDecodeError:
                    # Skip invalid JSON
                    continue
                except Exception as e:
                    # Emit error for unexpected exceptions
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Error processing WebSocket event: {str(e)}",
                            resource_id=str(resource_id),
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    break

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"WebSocket connection failed: {str(e)}",
                resource_id=str(resource_id),
                resource_type=resource_type,
            ),
            sid=sid,
        )


async def _persist_image(
    conn: Any,
    image_id: uuid.UUID,
    image_bytes: bytes,
    mime_type: str,
    file_size: int,
    image_name: str,
) -> str:
    """Persist image to disk and database."""
    import re

    # Determine file extension from mime type
    file_ext = ".png"
    if mime_type == "image/jpeg" or mime_type == "image/jpg":
        file_ext = ".jpg"
    elif mime_type == "image/gif":
        file_ext = ".gif"

    # Create deduplicated filename from image name
    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", image_name)
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    safe_name = safe_name.lower() or "image"

    # Append UUID for deduplication
    upload_uuid = uuid.uuid4()
    file_name = f"{safe_name}_{upload_uuid}{file_ext}"
    file_path = f"image/{file_name}"
    full_path = IMAGE_FOLDER / file_name

    # Ensure image directory exists
    IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

    # Save image bytes to file
    with open(full_path, "wb") as f:
        f.write(image_bytes)

    # Persist to database using SQL function
    params = CompleteImageGenerationSqlParams(
        image_id=image_id,
        file_path=file_path,
        mime_type=mime_type,
        file_size=file_size,
    )
    sql_result = cast(
        CompleteImageGenerationSqlRow,
        await execute_sql_typed(
            conn,
            "app/sql/v4/images/complete_image_generation_complete.sql",
            params=params,
        ),
    )

    return file_path


async def _persist_video(
    conn: Any,
    video_id: uuid.UUID,
    video_bytes: bytes,
    upload_id: uuid.UUID,
    run_id: uuid.UUID,
) -> str:
    """Persist video to disk and database."""
    # Determine file extension from mime type
    file_ext = ".mp4"
    mime_type = "video/mp4"

    # Create filename
    video_filename = f"{video_id}_{uuid.uuid4()}{file_ext}"
    video_relative_path = f"video/{video_filename}"
    VIDEO_FOLDER.mkdir(parents=True, exist_ok=True)
    video_path = VIDEO_FOLDER / video_filename

    # Save video bytes to file
    video_path.write_bytes(video_bytes)

    # Persist to database using SQL function
    params = CreateGenerationAndLinkSqlParams(
        video_id=video_id,
        file_path=video_relative_path,
        mime_type=mime_type,
        upload_id=upload_id,
        active=True,
        run_id=run_id,
    )
    sql_result = cast(
        CreateGenerationAndLinkSqlRow,
        await execute_sql_typed(
            conn,
            "app/sql/v4/videos/create_generation_and_link_complete.sql",
            params=params,
        ),
    )

    return video_relative_path


@internal_sio.on("generate_artifact")  # type: ignore
async def generate_artifact_internal(data: dict[str, Any]) -> None:
    """Handle generate_artifact event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        # Get profile_id from sid lookup
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("resource_id"),
                    group_id=data.get("group_id"),
                    resource_type=data.get("resource_type"),
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _generate_artifact_impl(sid, data, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )
