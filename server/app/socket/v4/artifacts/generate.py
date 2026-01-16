"""Unified artifact generation handler - handles ALL generation logic inline using LiteLLM."""

import asyncio
import base64
import json
import uuid
from typing import Any, AsyncIterator, cast

import httpx
import websockets
from app.infra.v4.agents.types import TResponseInputItem
from app.infra.v4.artifacts import (convert_tools_to_openai_format,
                                    convert_tools_to_responses_format,
                                    format_messages_for_litellm,
                                    stream_litellm_events)
from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.is_run_cancelled import is_run_cancelled
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import IMAGE_FOLDER, VIDEO_FOLDER, get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.socket.v4.artifacts.frames import start_client_ws_sender
from app.socket.v4.artifacts.session_store import (create_session,
                                                   get_session_by_run_id,
                                                   remove_session)
from app.sql.types import (GetAudioRunContextAndCreateRunSqlParams,
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
                           InfraArtifactsGetGroupIdFromRunSqlParams,
                           InfraArtifactsGetGroupIdFromRunSqlRow,
                           InsertUploadSqlParams, InsertUploadSqlRow)
from jinja2 import Environment, TemplateError
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

SQL_PATH = (
    "app/sql/v4/generate/start/get_generation_run_context_and_create_run_complete.sql"
)
SQL_PATH_TEXT = (
    "app/sql/v4/generate/text/get_text_run_context_for_existing_run_complete.sql"
)
SQL_PATH_MESSAGES_BY_IDS = "app/sql/v4/messages/get_messages_by_ids_complete.sql"
SQL_PATH_MESSAGES_BY_RUN = "app/sql/v4/messages/get_messages_by_run_id_complete.sql"
SQL_PATH_IMAGE = (
    "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"
)
SQL_PATH_VIDEO = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"
SQL_PATH_AUDIO = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"
GET_GROUP_ID_SQL_PATH = "app/sql/v4/infrastructure/artifacts/get_group_id_from_run_complete.sql"

# Try to import litellm
try:
    import litellm  # type: ignore
    from openai.types.responses.response_create_params import ToolChoice
    from openai.types.responses.response_input_param import ResponseInputParam
    from openai.types.responses.tool_param import ToolParam

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    # Type stubs for when litellm is not available
    ResponseInputParam = Any  # type: ignore
    ToolChoice = Any  # type: ignore
    ToolParam = Any  # type: ignore

from app.main import UPLOAD_FOLDER

# In-memory store for active tasks (for cancellation)
_active_tasks: dict[str, asyncio.Task[None]] = {}


def _store_active_task(resource_id: str, task: asyncio.Task[None]) -> None:
    """Store an active task for potential cancellation."""
    _active_tasks[resource_id] = task


def _remove_active_task(resource_id: str) -> None:
    """Remove an active task from storage."""
    _active_tasks.pop(resource_id, None)


def determine_modality_from_output_modalities(
    output_modalities: list[str] | None,
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


async def _call_llm_text_stream(
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | list[ToolParam] | None = None,
    tool_choice: str | ToolChoice = "auto",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.0,
    reasoning: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Call LLM with streaming, preferring aresponses() API, falling back to acompletion().

    This function makes AI calls (litellm), so it stays in the handler layer, not infra.
    Infra handles parsing via stream_litellm_events().

    Args:
        model: Model name
        messages: List of message dicts
        tools: Optional list of tool definitions
        tool_choice: Tool choice mode ("auto", "required", etc.)
        api_key: API key for the provider
        base_url: Optional base URL override
        temperature: Temperature setting
        reasoning: Optional reasoning mode
        metadata: Optional metadata dict for tracing (run_id, trace_id, etc.)

    Yields:
        Raw stream chunks from litellm (will be parsed by stream_litellm_events)
    """
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

    # Prepare base parameters
    base_kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "api_key": api_key,
        "temperature": temperature,
    }

    if base_url:
        base_kwargs["base_url"] = base_url

    if tools:
        base_kwargs["tools"] = tools
        base_kwargs["tool_choice"] = tool_choice

    if reasoning:
        base_kwargs["extra_body"] = {"reasoning": reasoning}

    # Inject tracing metadata for OpenAI native tracing
    if metadata:
        # For OpenAI: use extra_headers for trace correlation
        # Format: OpenAI-Trace-Id or similar (check OpenAI docs for exact header)
        extra_headers: dict[str, str] = {}
        if metadata.get("trace_id"):
            extra_headers["OpenAI-Trace-Id"] = str(metadata["trace_id"])
        if metadata.get("run_id"):
            extra_headers["X-Run-Id"] = str(metadata["run_id"])
        if extra_headers:
            base_kwargs["extra_headers"] = extra_headers

    # Try aresponses() first (preferred API)
    try:
        if hasattr(litellm, "aresponses"):
            # aresponses() requires 'input' parameter (not 'messages')
            # Convert messages list to input format - aresponses accepts list of messages as input
            responses_kwargs: dict[str, Any] = {
                "input": messages,  # aresponses accepts messages list as input
                "model": model,
                "stream": True,  # Explicitly set stream=True
                "api_key": api_key,
                "temperature": temperature,
            }
            
            if base_url:
                responses_kwargs["base_url"] = base_url
            
            if tools:
                # For aresponses(), tools should be in Responses format (FunctionToolParam)
                # Check if tools are already in Responses format or need conversion
                validated_tools: list[dict[str, Any]] = []
                for tool in tools:
                    # Convert FunctionToolParam (Pydantic model) to dict if needed
                    tool_dict: dict[str, Any] | None = None
                    if isinstance(tool, dict):
                        tool_dict = cast(dict[str, Any], tool)
                    elif hasattr(tool, "model_dump"):
                        # Pydantic model - convert to dict
                        tool_dict = tool.model_dump()
                    elif hasattr(tool, "dict"):
                        # Pydantic v1 style
                        tool_dict = tool.dict()
                    
                    if not tool_dict:
                        continue
                    
                    # Responses format: {"type": "function", "name": ..., "parameters": ...}
                    if tool_dict.get("type") == "function" and "name" in tool_dict:
                        # Already in Responses format - ensure additionalProperties is set for strict mode
                        tool_copy = {**tool_dict}
                        if tool_copy.get("strict") and isinstance(tool_copy.get("parameters"), dict):
                            tool_copy["parameters"] = {
                                **tool_copy["parameters"],
                                "additionalProperties": False,
                            }
                        validated_tools.append(tool_copy)
                    # OpenAI format: {"type": "function", "function": {"name": ...}}
                    elif tool_dict.get("type") == "function" and "function" in tool_dict:
                        func = tool_dict.get("function")
                        if isinstance(func, dict) and func.get("name"):
                            # Convert OpenAI format to Responses format
                            # When strict=True, additionalProperties must be explicitly set to false
                            parameters = func.get("parameters", {})
                            if isinstance(parameters, dict):
                                # Ensure additionalProperties is set to false for strict mode
                                parameters = {**parameters, "additionalProperties": False}
                            validated_tools.append({
                                "type": "function",
                                "name": func["name"],
                                "description": func.get("description", ""),
                                "parameters": parameters,
                                "strict": True,
                            })
                
                if validated_tools:
                    responses_kwargs["tools"] = validated_tools  # type: ignore
                    responses_kwargs["tool_choice"] = tool_choice if isinstance(tool_choice, str) else tool_choice
            
            if reasoning:
                responses_kwargs["reasoning"] = reasoning
            
            # Include usage in response (if supported)
            # Note: aresponses() may include usage by default in response.completed events
            if metadata:
                responses_extra_headers: dict[str, str] = {}
                if metadata.get("trace_id"):
                    responses_extra_headers["OpenAI-Trace-Id"] = str(metadata["trace_id"])
                if metadata.get("run_id"):
                    responses_extra_headers["X-Run-Id"] = str(metadata["run_id"])
                if responses_extra_headers:
                    responses_kwargs["extra_headers"] = responses_extra_headers
            
            stream = await litellm.aresponses(**responses_kwargs)
            async for chunk in stream:
                yield chunk
            return
    except (AttributeError, TypeError, Exception) as e:
        # Fallback to acompletion() if aresponses() fails or doesn't exist
        import logging

        logger = logging.getLogger(__name__)
        logger.debug(
            f"aresponses() not available or failed: {e}, falling back to acompletion()"
        )

    # Fallback to acompletion() - add stream_options to include usage
    # acompletion() needs OpenAI format tools, so convert if needed
    # Note: tools might be in Responses format (from responses_kwargs) or OpenAI format (from base_kwargs)
    # We need to check the original tools parameter and convert if needed
    if tools:
        # Check if tools are in Responses format and convert to OpenAI format
        acompletion_tools: list[dict[str, Any]] = []
        for tool in tools:
            if isinstance(tool, dict):
                tool_dict = cast(dict[str, Any], tool)
                # Responses format: {"type": "function", "name": ..., "parameters": ...}
                if tool_dict.get("type") == "function" and "name" in tool_dict and "function" not in tool_dict:
                    # Convert Responses format to OpenAI format
                    acompletion_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool_dict["name"],
                            "description": tool_dict.get("description", ""),
                            "parameters": tool_dict.get("parameters", {}),
                        },
                    })
                # Already in OpenAI format: {"type": "function", "function": {"name": ...}}
                elif tool_dict.get("type") == "function" and "function" in tool_dict:
                    acompletion_tools.append(tool_dict)
        
        if acompletion_tools:
            base_kwargs["tools"] = acompletion_tools
        else:
            # No valid tools, remove tools parameter
            base_kwargs.pop("tools", None)
            base_kwargs.pop("tool_choice", None)
    
    
    # Add stream_options to include usage in streaming chunks
    base_kwargs["stream_options"] = {"include_usage": True}
    stream = await litellm.acompletion(**base_kwargs)
    async for chunk in stream:
        yield chunk


async def _generate_artifact_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
) -> None:
    """Unified entry point for all artifact generation - handles ALL logic inline."""
    try:
        async with get_db_connection() as conn:
            # Extract eval_mode flag (defaults to False for backward compatibility)
            eval_mode = data.get("eval_mode", False)
            
            # Handle resource_types array (new) or resource_type (legacy) for backward compatibility
            resource_types = data.get("resource_types")
            if not resource_types:
                # Backward compatibility: single resource_type
                resource_type = data.get("resource_type")
                if resource_type:
                    resource_types = [resource_type]
                else:
                    raise ValueError(
                        "Either resource_types or resource_type must be provided"
                    )

            # Convert message_ids to UUID array if provided (shared across all resource_types)
            message_ids_uuid = (
                [uuid.UUID(mid) for mid in data.get("message_ids", [])]
                if data.get("message_ids")
                else None
            )

            # Require agent_id directly (no domain_id lookup)
            agent_id = data.get("agent_id")
            if not agent_id:
                raise ValueError("agent_id must be provided")

            # Extract developer_instructions and user_instructions (legacy support)
            developer_instructions = data.get("developer_instructions")  # list[str] | None
            user_instructions = data.get("user_instructions")  # list[str] | None
            # Extract resources (array of {resource_type, resource_ids})
            resources = data.get("resources")  # list[dict[str, Any]] | None

            # Process each resource_type
            for resource_type in resource_types:
                try:
                    params = GetGenerationRunContextAndCreateRunSqlParams(
                        agent_id=uuid.UUID(agent_id),
                        profile_id=profile_id,
                        message_ids=message_ids_uuid,
                        department_id=None,  # Can be NULL, modality handlers will get it
                        group_id=uuid.UUID(data["group_id"])
                        if data.get("group_id")
                        else None,
                        developer_instructions=developer_instructions,
                        user_instructions=user_instructions,
                        resources=resources,  # Pass resources array to SQL
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
                            artifact_type=data.get("artifact_type"),
                            group_id=data.get("group_id"),
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue  # Continue to next resource_type instead of returning
                except Exception as e:
                    # Other errors
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Failed to start generation for {resource_type}: {str(e)}",
                            artifact_type=data.get("artifact_type"),
                            group_id=data.get("group_id"),
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue  # Continue to next resource_type instead of returning

                if not result:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Failed to create run for {resource_type}",
                            artifact_type=data.get("artifact_type"),
                            group_id=data.get("group_id"),
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )
                    continue  # Continue to next resource_type instead of returning

                modality = determine_modality_from_output_modalities(
                    result.output_modalities
                )
                run_id = result.run_id
                group_id = str(result.group_id) if result.group_id else None
                trace_id = result.trace_id
                message_ids = [str(mid) for mid in (result.message_ids or [])]
                if not agent_id:
                    # If your SQL row includes agent_id, prefer that (if available on result)
                    agent_id_from_sql = getattr(result, "agent_id", None)
                    if agent_id_from_sql:
                        agent_id = str(agent_id_from_sql)
                    else:
                        await emit_to_internal(
                            "generate_error",
                            GenerateErrorApiRequest(
                                sid=sid,
                                error_message=f"agent_id missing for {resource_type}",
                                artifact_type=data.get("artifact_type"),
                                group_id=data.get("group_id"),
                                resource_type=resource_type,
                            ),
                            sid=sid,
                        )
                        continue  # Continue to next resource_type instead of returning

                # Extract artifact_type from data to pass through handlers
                artifact_type = data.get("artifact_type")
                
                # Route to appropriate modality handler
                if modality == "text" or modality == "call" or modality == "document":
                    await _handle_text_generation(
                        sid=sid,
                        data=data,
                        profile_id=profile_id,
                        conn=conn,
                        run_id=uuid.UUID(run_id),
                        agent_id=uuid.UUID(agent_id) if agent_id else None,
                        resource_type=resource_type,
                        artifact_type=artifact_type,
                        message_ids=[uuid.UUID(mid) for mid in message_ids]
                        if message_ids
                        else None,
                        group_id=uuid.UUID(group_id) if group_id else None,
                        trace_id=trace_id,
                        tool_choice="required" if modality == "call" else "auto",
                        eval_mode=eval_mode,
                    )
                elif modality == "image":
                    await _handle_image_generation(
                        sid=sid,
                        data=data,
                        profile_id=profile_id,
                        conn=conn,
                        run_id=uuid.UUID(run_id),
                        agent_id=uuid.UUID(agent_id) if agent_id else None,
                        artifact_type=artifact_type,
                        trace_id=trace_id,
                        eval_mode=eval_mode,
                    )
                elif modality == "video":
                    await _handle_video_generation(
                        sid=sid,
                        data=data,
                        profile_id=profile_id,
                        conn=conn,
                        run_id=uuid.UUID(run_id),
                        artifact_type=artifact_type,
                        trace_id=trace_id,
                        eval_mode=eval_mode,
                    )
                elif modality == "audio":
                    await _handle_audio_generation(
                        sid=sid,
                        data=data,
                        profile_id=profile_id,
                        conn=conn,
                        run_id=uuid.UUID(run_id),
                        agent_id=uuid.UUID(agent_id) if agent_id else None,
                        resource_type=resource_type,
                        artifact_type=artifact_type,
                        eval_mode=eval_mode,
                    )
                else:
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Modality {modality} not yet supported",
                            artifact_type=data.get("artifact_type"),
                            group_id=group_id,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate artifact: {str(e)}",
                artifact_type=data.get("artifact_type"),
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
    resource_type: str,
    artifact_type: str | None,
    message_ids: list[uuid.UUID] | None,
    group_id: uuid.UUID | None,
    trace_id: str | None,
    tool_choice: str = "auto",
    eval_mode: bool = False,
) -> None:
    """Handle text generation using litellm directly."""
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

    if not agent_id:
        raise ValueError("agent_id is required for text generation")

    # Get text context from SQL
    resources = data.get("resources")  # Extract resources array from data
    params = GetTextRunContextForExistingRunSqlParams(
        run_id=run_id,
        agent_id=agent_id,
        message_ids=message_ids,
        group_id=group_id,
        resources=resources,  # Pass resources array to SQL
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

    # Convert tools to both formats:
    # - OpenAI format for acompletion() fallback
    # - Responses format for aresponses() (preferred)
    openai_tools = convert_tools_to_openai_format(agent_tools_config)
    responses_tools = convert_tools_to_responses_format(agent_tools_config)

    # Construct input items for the agent
    input_items: list[TResponseInputItem] = []
    seen_message_ids: set[uuid.UUID] = (
        set()
    )  # Track seen messages to prevent duplicates

    # Handle audio input if upload_id is provided
    if result.upload_id and result.file_path:
        audio_file_path = UPLOAD_FOLDER / result.file_path
        if audio_file_path.exists():
            # TODO: Convert to proper audio input format or signed URL instead of filesystem path
            # For now, use a placeholder that doesn't expose filesystem paths
            audio_input: TResponseInputItem = {
                "role": "user",
                "content": "Audio file is available for processing",
            }
            input_items.append(audio_input)

    # Get all messages linked to the run (system/developer messages from previous runs)
    try:
        run_messages_params = GetMessagesByRunIdSqlParams(run_id=run_id)
        run_messages_result = cast(
            GetMessagesByRunIdSqlRow,
            await execute_sql_typed(
                conn, SQL_PATH_MESSAGES_BY_RUN, params=run_messages_params
            ),
        )
        if run_messages_result.messages:
            for msg in run_messages_result.messages:
                # Deduplicate by message ID
                msg_id = getattr(msg, "id", None)
                if msg_id and msg_id in seen_message_ids:
                    continue
                if msg_id:
                    seen_message_ids.add(msg_id)

                if msg.role in ("system", "developer"):
                    item: TResponseInputItem = {  # type: ignore[assignment]
                        "role": msg.role,
                        "content": msg.content or "",
                    }
                    input_items.append(item)  # type: ignore[arg-type]
    except Exception:
        import logging

        logging.getLogger(__name__).warning(f"Failed to fetch run messages")

    # Get messages from message_ids (user regeneration message + context messages)
    if message_ids:
        try:
            messages_params = GetMessagesByIdsSqlParams(message_ids=message_ids)
            messages_result = cast(
                GetMessagesByIdsSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES_BY_IDS, params=messages_params
                ),
            )
            if messages_result.messages:
                for msg in messages_result.messages:
                    # Deduplicate by message ID
                    msg_id = getattr(msg, "id", None)
                    if msg_id and msg_id in seen_message_ids:
                        continue
                    if msg_id:
                        seen_message_ids.add(msg_id)

                    if msg.role not in ("system", "developer"):
                        item: TResponseInputItem = {  # type: ignore[assignment]
                            "role": msg.role,
                            "content": msg.content or "",
                        }
                        input_items.append(item)  # type: ignore[arg-type]
        except Exception:
            import logging

            logging.getLogger(__name__).warning(f"Failed to fetch messages by IDs")

    # Format messages for litellm
    messages = format_messages_for_litellm(input_items)

    # Render developer instruction templates with context (if provided)
    system_prompt = result.system_prompt or ""
    developer_instruction_templates = getattr(result, "developer_instruction_templates", None)
    context = getattr(result, "context", None)
    
    if developer_instruction_templates and context:
        # Convert context from JSONB to Python dict if needed
        context_dict = context if isinstance(context, dict) else json.loads(context) if isinstance(context, str) else {}
        
        # Render each template with context
        env = Environment(
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        
        rendered_instructions: list[str] = []
        for template_str in developer_instruction_templates:
            if not template_str or not template_str.strip():
                continue
            
            try:
                template = env.from_string(template_str)
                rendered_content = template.render(**context_dict)
                
                if rendered_content and rendered_content.strip():
                    rendered_instructions.append(rendered_content.strip())
            except TemplateError as e:
                import logging
                logging.getLogger(__name__).warning(
                    f"Failed to render developer instruction template: {str(e)}"
                )
                continue
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(
                    f"Unexpected error rendering developer instruction template: {str(e)}"
                )
                continue
        
        # Append rendered instructions to system prompt
        if rendered_instructions:
            system_prompt = system_prompt + "\n\n" + "\n\n".join(rendered_instructions)

    # Add system prompt if present
    if system_prompt:
        messages.insert(
            0,
            {
                "role": "system",
                "content": system_prompt,
            },
        )

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "text",
            "sid": sid,
            "artifact_type": artifact_type,
            "resource_type": resource_type,
            "run_id": str(run_id),
            "group_id": str(group_id) if group_id else None,
            "type": "start",
            "message": f"Starting {result.agent_name or 'text'} generation",
            "eval_mode": eval_mode,
        },
    )

    # Prepare metadata for tracing
    metadata: dict[str, Any] = {
        "run_id": str(run_id),
        "trace_id": trace_id,
        "group_id": str(group_id) if group_id else None,
        "resource_type": resource_type,
        "agent_id": str(agent_id) if agent_id else None,
    }

    # Call LLM with streaming using boundary function
    # Use group_id for task storage instead of resource_id
    group_id_str = str(group_id) if group_id else sid
    stream = _call_llm_text_stream(
        model=result.model_name or "",
        messages=messages,
        tools=responses_tools if responses_tools else (openai_tools if openai_tools else None),
        tool_choice=tool_choice,
        api_key=decrypted_api_key,
        base_url=result.base_url,
        temperature=result.temperature or 0.0,
        reasoning=result.reasoning,
        metadata=metadata,
    )

    # Wrap streaming loop in task for cancellation
    assistant_output = ""
    input_tokens = 0
    output_tokens = 0
    tool_call_states: dict[str, dict[str, Any]] = {}  # tool_call_id -> state

    async def _stream_and_emit() -> None:
        """Inner function to handle streaming and emitting events."""
        nonlocal assistant_output, input_tokens, output_tokens
        import logging

        logger = logging.getLogger(__name__)
        event_count = 0

        try:
            async for event in stream_litellm_events(stream):
                event_count += 1
                # Check for cancellation periodically
                if await is_run_cancelled(str(run_id)):
                    break

                event_type = event.get("type")

                # -------- TEXT lifecycle
                if event_type == "text_start":
                    await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "text_start",
                        "eval_mode": eval_mode,
                    },
                    )

                elif event_type == "text_delta":
                    delta = event.get("delta", "")
                    if delta:
                        assistant_output += delta
                        await internal_sio.emit(
                        "generate_progress",
                        {
                            "modality": "text",
                            "sid": sid,
                            "artifact_type": artifact_type,
                            "group_id": str(group_id) if group_id else None,
                            "resource_type": resource_type,
                            "run_id": str(run_id),
                            "group_id": str(group_id) if group_id else None,
                            "type": "text_delta",
                            "delta": delta,
                            "eval_mode": eval_mode,
                        },
                        )

                elif event_type == "text_complete":
                    assistant_output = event.get("text", assistant_output)
                    await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "group_id": str(group_id) if group_id else None,
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "text_complete",
                        "text": assistant_output,
                        "eval_mode": eval_mode,
                    },
                    )

                # -------- TOOL lifecycle
                elif event_type == "tool_call_start":
                    tool_call_id = cast(str, event.get("tool_call_id"))
                    tool_index = event.get("tool_index", 0)

                    tool_call_states.setdefault(
                    tool_call_id,
                    {
                        "tool_index": tool_index,
                        "call_id": tool_call_id,
                        "tool_name": None,
                        "arguments": "",
                    },
                    )

                    await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "tool_call_start",
                        "tool_call_id": tool_call_id,
                        "eval_mode": eval_mode,
                    },
                    )

                elif event_type == "tool_call_delta":
                    tool_call_id = cast(str, event.get("tool_call_id"))
                    delta = event.get("delta", "") or ""
                    tool_name = event.get("tool_name")

                    st = tool_call_states.setdefault(
                    tool_call_id,
                    {
                        "tool_index": event.get("tool_index", 0),
                        "call_id": tool_call_id,
                        "tool_name": None,
                        "arguments": "",
                    },
                    )
                    if tool_name and not st["tool_name"]:
                        st["tool_name"] = tool_name
                    st["arguments"] += delta

                    await internal_sio.emit(
                    "generate_progress",
                    {
                        "modality": "text",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "resource_type": resource_type,
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "type": "tool_call_delta",
                        "tool_call_id": tool_call_id,
                        "delta": delta,
                        "tool_name": st.get("tool_name"),
                        "arguments_delta": delta,
                        "eval_mode": eval_mode,
                    },
                    )

                elif event_type == "tool_call_complete":
                    tool_call_id = cast(str, event.get("tool_call_id"))
                    tool_name = (
                        event.get("name")
                        or tool_call_states.get(tool_call_id, {}).get("tool_name")
                        or ""
                    )
                    # Prefer state store over event.get() for final arguments
                    st = tool_call_states.get(tool_call_id, {})
                    arguments_str = event.get("arguments") or st.get("arguments", "")

                    # Parse args (best effort)
                    try:
                        arguments_dict = json.loads(arguments_str) if arguments_str else {}
                    except json.JSONDecodeError:
                        arguments_dict = {}

                    st = tool_call_states.setdefault(
                        tool_call_id,
                        {
                            "tool_index": event.get("tool_index", 0),
                            "call_id": tool_call_id,
                            "tool_name": None,
                            "arguments": "",
                        },
                    )
                    st["tool_name"] = tool_name or st.get("tool_name")
                    st["arguments"] = arguments_str or st.get("arguments", "")

                    # Emit progress event for progress handler
                    await internal_sio.emit(
                        "generate_progress",
                        {
                            "modality": "text",
                            "sid": sid,
                            "artifact_type": artifact_type,
                            "resource_type": resource_type,
                            "run_id": str(run_id),
                            "group_id": str(group_id) if group_id else None,
                            "type": "tool_call_complete",
                            "tool_call_id": tool_call_id,
                            "tool_name": tool_name,
                            "arguments": arguments_dict,
                            "arguments_delta": st["arguments"],
                            "call_id": tool_call_id,  # Add call_id for template rendering
                            "agent_id": str(agent_id) if agent_id else None,  # Add agent_id for tool execution
                            "eval_mode": eval_mode,
                        },
                    )

                    # Also emit generate_complete for complete handler to execute tool
                    await internal_sio.emit(
                        "generate_complete",
                        {
                            "modality": "text",
                            "sid": sid,
                            "artifact_type": artifact_type,
                            "type": "tool_call_complete",
                            "resource_type": resource_type,
                            "run_id": str(run_id),
                            "group_id": str(group_id) if group_id else None,
                            "tool_call_id": tool_call_id,
                            "call_id": tool_call_id,  # external_call_id for lookup
                            "tool_name": tool_name,
                            "agent_id": str(agent_id) if agent_id else None,
                            "eval_mode": eval_mode,
                        },
                    )

                # -------- message completion + usage
                elif event_type == "message_complete":
                    usage_data = event.get("usage")
                    if isinstance(usage_data, dict):
                        input_tokens = usage_data.get("prompt_tokens", 0) or 0
                        output_tokens = usage_data.get("completion_tokens", 0) or 0
                    else:
                        logger.warning(
                            f"message_complete event received without usage_data for run {run_id}"
                        )
                    # message_complete signals stream completion - break out of loop
                    # The stream will end naturally, and generate_complete will be emitted after await task
        except Exception as stream_error:
            logger.error(
                f"Error processing stream events for run {run_id}: {str(stream_error)}",
                exc_info=True,
            )
            raise
        finally:
            if event_count == 0:
                logger.warning(
                    f"No events received from stream for run {run_id}. "
                    f"This may indicate a parsing issue or empty response."
                )

    # Create task for cancellation support
    task = asyncio.create_task(_stream_and_emit())
    _store_active_task(group_id_str, task)
    await store_active_run(group_id_str, task)

    try:
        await task
    except asyncio.CancelledError:
        # Task was cancelled - cleanup already handled
        raise
    except BaseException as stream_error:
        if isinstance(stream_error, (KeyboardInterrupt, SystemExit)):
            raise
        raise
    finally:
        _remove_active_task(group_id_str)
        await remove_active_run(group_id_str)

    # Emit run completion event with usage data
    await internal_sio.emit(
        "generate_complete",
        {
            "modality": "text",
            "sid": sid,
            "artifact_type": artifact_type,
            "type": "run_complete",
            "resource_type": resource_type,
            "run_id": str(run_id),
            "group_id": str(group_id) if group_id else None,
            "input_text_tokens": input_tokens,
            "output_text_tokens": output_tokens,
            "system_prompt": result.system_prompt or "",
            "input_items": input_items,
            "assistant_output": assistant_output,
            "eval_mode": eval_mode,
        },
    )


async def _handle_image_generation(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID,
    conn: Any,
    run_id: uuid.UUID,
    agent_id: uuid.UUID | None,
    artifact_type: str | None,
    trace_id: str | None,
    eval_mode: bool = False,
) -> None:
    """Handle image generation using LiteLLM."""
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

    if not agent_id:
        raise ValueError("agent_id is required for image generation")

    image_id = uuid.UUID(data.get("image_id") or str(uuid.uuid4()))
    prompt = data.get("prompt", "")

    # Get image context from SQL
    params = GetImageGenerationContextAndCreateUploadSqlParams(
        image_id=image_id,
        agent_id=agent_id,
        profile_id=profile_id,
        department_id=uuid.UUID(data["department_id"])
        if data.get("department_id")
        else None,
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

    # Get group_id from run
    group_params = InfraArtifactsGetGroupIdFromRunSqlParams(
        run_id=uuid.UUID(run_id)
    )
    group_result = cast(
        InfraArtifactsGetGroupIdFromRunSqlRow,
        await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params),
    )
    group_id_from_run = str(group_result.group_id) if group_result and group_result.group_id else None

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "image",
            "sid": sid,
            "artifact_type": artifact_type,
            "resource_type": "images",
            "run_id": str(run_id),
            "group_id": str(group_id_from_run) if group_id_from_run else None,
            "type": "start",
            "message": "Starting image generation",
            "eval_mode": eval_mode,
        },
    )

    # Check if model supports native image generation (Gemini 3.0)
    model_name = result.model_name or ""
    if model_name.startswith("gemini-3") or "gemini-3" in model_name.lower():
        # Use native image generation via responses() API if available, otherwise completion
        try:
            import litellm

            # Try aresponses() first for better format handling
            if hasattr(litellm, "aresponses"):
                try:
                    resp = await litellm.aresponses(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        modalities=["text", "image"],
                        api_key=decrypted_api_key,
                    )
                    # Handle responses() format (check response structure)
                    # Note: Actual structure may vary - validate carefully
                    if hasattr(resp, "output") and resp.output:
                        # Extract image from response output
                        # This is a placeholder - actual structure needs validation
                        pass
                except (AttributeError, TypeError):
                    # Fall back to acompletion
                    resp = await litellm.acompletion(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        modalities=["text", "image"],
                        api_key=decrypted_api_key,
                    )
            else:
                resp = await litellm.acompletion(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    modalities=["text", "image"],
                    api_key=decrypted_api_key,
                )

            # Extract image_part - validate structure carefully
            image_data = None
            if hasattr(resp, "choices") and resp.choices:
                choice = resp.choices[0]
                if hasattr(choice, "message"):
                    msg = choice.message
                    if hasattr(msg, "images") and msg.images:
                        img = msg.images[0]
                        if hasattr(img, "image_url"):
                            image_data = img.image_url.url
                        elif isinstance(img, dict):
                            image_data = img.get("image_url", {}).get("url")
            elif isinstance(resp, dict):
                choices = resp.get("choices", [])
                if choices:
                    msg = choices[0].get("message", {})
                    images = msg.get("images", [])
                    if images:
                        image_data = images[0].get("image_url", {}).get("url")

            if image_data and image_data.startswith("data:image"):
                base64_data = image_data.split(",")[1]
                gemini_image_bytes = base64.b64decode(base64_data)
                mime_type = "image/png"  # Default for Gemini
                file_size = len(gemini_image_bytes)

                # Persist image
                image_name = data.get("name", "image")
                file_path = await _persist_image(
                    conn,
                    image_id,
                    gemini_image_bytes,
                    mime_type,
                    file_size,
                    image_name,
                )

                # Emit completion
                await internal_sio.emit(
                    "generate_complete",
                    {
                        "modality": "image",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "resource_type": "images",
                        "run_id": str(run_id),
                        "group_id": str(group_id_from_run) if group_id_from_run else None,
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

            logging.getLogger(__name__).warning(
                f"Native image generation failed: {e}, falling back to image_generation"
            )

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
            raise ValueError(
                f"No image data returned from litellm for image {image_id}"
            )

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
        file_path = await _persist_image(
            conn, image_id, image_bytes, mime_type, file_size, image_name
        )

        # Emit completion
        await internal_sio.emit(
            "generate_complete",
            {
                "modality": "image",
                "sid": sid,
                "artifact_type": artifact_type,
                "resource_type": "images",
                "run_id": str(run_id),
                "group_id": str(group_id_from_run) if group_id_from_run else None,
                "image_id": str(image_id),
                "file_path": file_path,
                "mime_type": mime_type,
                "file_size": file_size,
                "trace_id": trace_id,
                "eval_mode": eval_mode,
            },
        )

    except Exception as e:
        # Get group_id from run for error reporting
        try:
            group_params = InfraArtifactsGetGroupIdFromRunSqlParams(
                run_id=uuid.UUID(run_id)
            )
            group_result = cast(
                InfraArtifactsGetGroupIdFromRunSqlRow,
                await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params),
            )
            group_id_from_run = str(group_result.group_id) if group_result and group_result.group_id else None
        except Exception:
            group_id_from_run = None
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Image generation failed: {str(e)}",
                artifact_type=artifact_type,
                group_id=str(group_id_from_run) if group_id_from_run else None,
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
    artifact_type: str | None,
    trace_id: str | None,
    eval_mode: bool = False,
) -> None:
    """Handle video generation using OpenAI Sora API or LiteLLM."""
    video_id = uuid.UUID(data.get("videoId") or str(uuid.uuid4()))
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

    # Get group_id from run
    group_params = InfraArtifactsGetGroupIdFromRunSqlParams(
        run_id=uuid.UUID(run_id)
    )
    group_result = cast(
        InfraArtifactsGetGroupIdFromRunSqlRow,
        await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params),
    )
    group_id_from_run = str(group_result.group_id) if group_result and group_result.group_id else None

    # Emit start event
    await internal_sio.emit(
        "generate_progress",
        {
            "modality": "video",
            "sid": sid,
            "artifact_type": artifact_type,
            "resource_type": "videos",
            "run_id": str(run_id),
            "group_id": str(group_id_from_run) if group_id_from_run else None,
            "type": "start",
            "message": "Starting video generation",
            "status": "created",
            "progress": None,
            "video_id": str(video_id),
            "eval_mode": eval_mode,
        },
    )

    # Use OpenAI Sora API directly (or LiteLLM video_generation if available)
    model_name = result.model_name or ""
    if model_name.startswith("sora") or "sora" in model_name.lower():
        # OpenAI Sora API - isolate SDK calls for consistency
        from openai import OpenAI

        client = OpenAI(api_key=decrypted_api_key)

        # Hardcoded values per existing pattern
        seconds: str = "4"
        model: str = "sora-2"
        size: str = "720x1280"

        # Create video job - use consistent async pattern
        async def _create_video_job() -> Any:
            create_params: dict[str, Any] = {
                "prompt": prompt,
                "model": model,
                "seconds": seconds,
                "size": size,
            }
            if image_reference_id:
                create_params["image_reference_id"] = image_reference_id
            return await asyncio.to_thread(client.videos.create, **create_params)

        video_job = await _create_video_job()

        video_job_id = video_job.id

        # Helper function for consistent async SDK calls
        async def _retrieve_video_status(job_id: str) -> Any:
            return await asyncio.to_thread(client.videos.retrieve, job_id)

        async def _download_video_content(job_id: str) -> Any:
            return await asyncio.to_thread(client.videos.download_content, job_id)

        # Poll for completion with progress updates
        max_polls = 60  # 5 minutes max (5 second intervals)
        poll_count = 0
        while poll_count < max_polls:
            video_status = await _retrieve_video_status(video_job_id)
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
                    "artifact_type": artifact_type,
                    "resource_type": "videos",
                    "run_id": str(run_id),
                    "group_id": str(group_id_from_run) if group_id_from_run else None,
                    "type": "polling",
                    "message": f"Video generation in progress: {video_status.status}",
                    "status": video_status.status,
                    "progress": progress_value,
                    "video_id": str(video_id),
                    "eval_mode": eval_mode,
                },
            )

            if video_status.status == "completed":
                # Download video using OpenAI client's download_content method
                video_response = await _download_video_content(video_job_id)
                video_content_bytes: bytes = getattr(video_response, "content", b"")
                if not video_content_bytes:
                    if hasattr(video_response, "read"):
                        video_content_bytes = video_response.read()  # type: ignore[attr-defined]

                if not video_content_bytes:
                    raise ValueError("Video generation returned empty content")

                video_bytes = video_content_bytes

                # Persist video
                file_path = await _persist_video(
                    conn, video_id, video_bytes, upload_id, run_id
                )

                # Emit completion
                await internal_sio.emit(
                    "generate_complete",
                    {
                        "modality": "video",
                        "sid": sid,
                        "artifact_type": artifact_type,
                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                        "resource_type": "videos",
                        "run_id": str(run_id),
                        "success": True,
                        "message": "Video generated successfully",
                        "videoUrl": f"/api/uploads/download/{upload_id}",
                        "video_id": str(video_id),
                        "file_path": file_path,
                        "upload_id": str(upload_id),
                        "eval_mode": eval_mode,
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

                video_id_from_resp = (
                    video_resp.id if hasattr(video_resp, "id") else None
                )
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

                    status = (
                        status_resp.status if hasattr(status_resp, "status") else None
                    )
                    await internal_sio.emit(
                        "generate_progress",
                        {
                            "modality": "video",
                            "sid": sid,
                            "artifact_type": artifact_type,
                            "group_id": str(group_id_from_run) if group_id_from_run else None,
                            "resource_type": "videos",
                            "run_id": str(run_id),
                            "type": "polling",
                            "message": f"Video generation in progress: {status}",
                            "status": status,
                            "progress": None,
                            "video_id": str(video_id),
                            "eval_mode": eval_mode,
                        },
                    )

                    if status == "completed":
                        # Download video
                        content_resp = await litellm.avideo_content(
                            video_id=video_id_from_resp,
                            api_key=decrypted_api_key,
                        )
                        video_bytes = (
                            content_resp if isinstance(content_resp, bytes) else b""
                        )

                        # Persist video
                        file_path = await _persist_video(
                            conn, video_id, video_bytes, upload_id, run_id
                        )

                        # Emit completion
                        await internal_sio.emit(
                            "generate_complete",
                            {
                                "modality": "video",
                                "sid": sid,
                                "artifact_type": artifact_type,
                                "group_id": str(group_id_from_run) if group_id_from_run else None,
                                "resource_type": "videos",
                                "run_id": str(run_id),
                                "success": True,
                                "message": "Video generated successfully",
                                "videoUrl": f"/api/uploads/download/{upload_id}",
                                "video_id": str(video_id),
                                "file_path": file_path,
                                "upload_id": str(upload_id),
                                "eval_mode": eval_mode,
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
    resource_type: str,
    artifact_type: str | None,
    eval_mode: bool = False,
) -> None:
    """Handle audio generation using queue-based architecture with OpenAI Realtime WebSocket."""
    if not agent_id:
        raise ValueError("agent_id is required for audio generation")

    # Get audio context from SQL
    upload_id_for_audio = (
        uuid.UUID(data.get("upload_id") or str(uuid.uuid4()))
        if resource_type == "audio"
        else uuid.UUID("00000000-0000-0000-0000-000000000000")  # Dummy UUID for voice
    )
    audio_params = GetAudioRunContextAndCreateRunSqlParams(
        upload_id=upload_id_for_audio,
        agent_id=agent_id,
        profile_id=profile_id,
        department_id=uuid.UUID(data["department_id"])
        if data.get("department_id")
        else None,
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

    # Get group_id and chat_id from run
    group_params_audio = InfraArtifactsGetGroupIdFromRunSqlParams(
        run_id=uuid.UUID(run_id)
    )
    group_result_audio = cast(
        InfraArtifactsGetGroupIdFromRunSqlRow,
        await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params_audio),
    )
    group_id_from_run = str(group_result_audio.group_id) if group_result_audio and group_result_audio.group_id else None
    
    # Get chat_id from resource_id if available (for voice mode)
    chat_id: str | None = None
    resource_id = data.get("resource_id")
    if resource_id:
        try:
            chat_id = str(uuid.UUID(resource_id))
        except (ValueError, TypeError):
            pass

    # Create session in session store
    session = create_session(sid, str(run_id))
    session.oa_ws_connection = None  # Will be set when WS connects
    session.chat_id = chat_id
    session.group_id = str(group_id_from_run) if group_id_from_run else None

    url = f"wss://api.openai.com/v1/realtime?model={quote(model_name)}"
    headers = {
        "Authorization": f"Bearer {decrypted_api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    try:
        async with websockets.connect(url, extra_headers=headers) as ws:
            # Store WebSocket connection in session
            session.oa_ws_connection = ws
            # Emit session started event
            await internal_sio.emit(
                "generate_progress",
                {
                    "modality": "audio",
                    "sid": sid,
                    "artifact_type": artifact_type,
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "group_id": str(group_id_from_run) if group_id_from_run else None,
                    "type": "session_started",
                    "model": model_name,
                    "eval_mode": eval_mode,
                },
            )

            # Configure session
            session_config: dict[str, Any] = {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": audio_result.system_prompt
                    or "Be concise and helpful.",
                },
            }

            # TODO: Add tools and history formatting when needed
            # For now, send basic session config
            await ws.send(json.dumps(session_config))

            # Uplink loop: drain inbound_queue and forward to OpenAI (unless muted)
            async def uplink_loop() -> None:
                """Drain inbound_queue and forward audio frames to OpenAI."""
                while True:
                    try:
                        msg = await session.inbound_queue.get()
                        
                        if msg.get("type") == "mic.set_muted":
                            muted = msg.get("muted", False)
                            session.muted = muted
                            if muted:
                                # Send clear buffer command once when muted
                                await ws.send(json.dumps({"type": "input_audio_buffer.clear"}))
                            continue
                        
                        if msg.get("type") == "audio":
                            if session.muted:
                                continue  # Stop forwarding when muted
                            
                            # Convert binary PCM16 to base64
                            pcm16_bytes = msg.get("pcm16_bytes")
                            if pcm16_bytes:
                                if isinstance(pcm16_bytes, str):
                                    # Already base64 encoded
                                    audio_base64 = pcm16_bytes
                                else:
                                    # Binary bytes - encode to base64
                                    audio_base64 = base64.b64encode(pcm16_bytes).decode("utf-8")
                                
                                await ws.send(json.dumps({
                                    "type": "input_audio_buffer.append",
                                    "audio": audio_base64,
                                }))
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        # Log error but continue loop
                        await emit_to_internal(
                            "generate_error",
                            GenerateErrorApiRequest(
                                sid=sid,
                                error_message=f"Error in uplink loop: {str(e)}",
                                artifact_type=artifact_type,
                                group_id=str(group_id_from_run) if group_id_from_run else None,
                                resource_type=resource_type,
                            ),
                            sid=sid,
                        )

            # Downlink loop: read OpenAI events and push to outbound_queue
            async def downlink_loop() -> None:
                """Read OpenAI events and push audio deltas to outbound_queue."""
                try:
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
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "session_created",
                                        "eval_mode": eval_mode,
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
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "user_speech_started",
                                        "item_id": event.get("item_id"),
                                        "audio_start_ms": event.get("audio_start_ms", 0),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "input_audio_buffer.speech_stopped":
                                # User stopped speaking - create upload_id for user audio
                                item_id = event.get("item_id")
                                if item_id:
                                    # TODO: Create upload_id and start TUS upload for user audio
                                    # For now, store item_id mapping (upload_id will be created when audio is ready)
                                    # upload_id = await _create_audio_upload(...)
                                    # session.item_id_to_upload_id[item_id] = str(upload_id)
                                    pass
                                
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "user_speech_stopped",
                                        "item_id": item_id,
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif (
                                event_type
                                == "conversation.item.input_audio_transcription.completed"
                            ):
                                # User transcription completed - retrieve upload_id and call member_progress
                                item_id = event.get("item_id")
                                transcript = event.get("transcript", "")
                                upload_id = session.item_id_to_upload_id.get(item_id) if item_id else None
                                
                                # Call member_progress with transcript and upload_id (if available)
                                if transcript and chat_id:
                                    try:
                                        from app.infra.v4.websocket.find_profile_by_socket import \
                                            find_profile_by_socket
                                        from app.socket.v4.attempts.simulation.member_progress import (
                                            MemberProgressPayload,
                                            _member_progress_impl)
                                        
                                        profile_id_str = await find_profile_by_socket(sid)
                                        if profile_id_str:
                                            await _member_progress_impl(
                                                sid,
                                                MemberProgressPayload(
                                                    chat_id=chat_id,
                                                    message=transcript,
                                                    voice_mode=True,
                                                    upload_id=upload_id,
                                                ),
                                                uuid.UUID(profile_id_str),
                                            )
                                    except Exception as e:
                                        # Log error but continue
                                        await emit_to_internal(
                                            "generate_error",
                                            GenerateErrorApiRequest(
                                                sid=sid,
                                                error_message=f"Error calling member_progress: {str(e)}",
                                                artifact_type=artifact_type,
                                                group_id=str(group_id_from_run) if group_id_from_run else None,
                                                resource_type=resource_type,
                                            ),
                                            sid=sid,
                                        )
                                
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "user_transcription_complete",
                                        "item_id": item_id,
                                        "transcript": transcript,
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.created":
                                # Response started
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "response_started",
                                        "response_id": event.get("response_id"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.output_item.added":
                                # Output item added
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "output_item_added",
                                        "item_id": event.get("item_id"),
                                        "output_type": event.get("output_type"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.output_item.done":
                                # Output item done
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "output_item_done",
                                        "item_id": event.get("item_id"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.audio_transcript.delta":
                                # Assistant transcription delta
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "audio_transcript_delta",
                                        "delta": event.get("delta"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.audio_transcript.done":
                                # Assistant transcription complete
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "audio_transcript_done",
                                        "transcript": event.get("transcript"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.audio.delta":
                                # Assistant audio delta - push to outbound_queue and emit generate_progress
                                audio_delta = event.get("delta")
                                if audio_delta:
                                    # Decode base64 to PCM16 bytes for client
                                    try:
                                        pcm16_bytes = base64.b64decode(audio_delta)
                                        await session.outbound_queue.put({
                                            "type": "audio",
                                            "pcm16": pcm16_bytes,
                                        })
                                    except Exception as e:
                                        # If decoding fails, still emit generate_progress with base64
                                        pass
                                    
                                    # Also emit generate_progress for simulations listeners
                                    await internal_sio.emit(
                                        "generate_progress",
                                        {
                                            "modality": "audio",
                                            "sid": sid,
                                            "artifact_type": artifact_type,
                                            "group_id": str(group_id_from_run) if group_id_from_run else None,
                                            "resource_type": resource_type,
                                            "run_id": str(run_id),
                                            "type": "audio_delta",
                                            "audio": audio_delta,  # Base64 encoded audio
                                            "eval_mode": eval_mode,
                                        },
                                    )
                            elif event_type == "response.function_call_arguments.delta":
                                # Tool call arguments delta
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "tool_call_progress",
                                        "call_id": event.get("call_id"),
                                        "arguments_delta": event.get("delta"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.function_call.done":
                                # Tool call complete
                                await internal_sio.emit(
                                    "generate_progress",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "tool_call_complete",
                                        "call_id": event.get("call_id"),
                                        "function_call": event.get("function_call"),
                                        "eval_mode": eval_mode,
                                    },
                                )
                            elif event_type == "response.done":
                                # Response complete - create upload_id for assistant audio
                                response_id = event.get("response_id")
                                if response_id:
                                    # TODO: Create upload_id and start TUS upload for assistant audio
                                    # For now, store response_id mapping (upload_id will be created when audio is ready)
                                    # upload_id = await _create_audio_upload(...)
                                    # session.response_id_to_upload_id[response_id] = str(upload_id)
                                    pass
                                
                                await internal_sio.emit(
                                    "generate_complete",
                                    {
                                        "modality": "audio",
                                        "sid": sid,
                                        "artifact_type": artifact_type,
                                        "group_id": str(group_id_from_run) if group_id_from_run else None,
                                        "resource_type": resource_type,
                                        "run_id": str(run_id),
                                        "type": "run_complete",
                                        "eval_mode": eval_mode,
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
                                        error_message=error_data.get(
                                            "message", "Unknown error"
                                        ),
                                        artifact_type=artifact_type,
                                        group_id=str(group_id_from_run) if group_id_from_run else None,
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
                                    artifact_type=artifact_type,
                                    group_id=str(group_id_from_run) if group_id_from_run else None,
                                    resource_type=resource_type,
                                ),
                                sid=sid,
                            )
                            break
                except asyncio.CancelledError:
                    # Task was cancelled - exit loop naturally
                    pass
                except Exception as e:
                    # Emit error for unexpected exceptions in downlink loop
                    await emit_to_internal(
                        "generate_error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Error in downlink loop: {str(e)}",
                            artifact_type=artifact_type,
                            group_id=str(group_id_from_run) if group_id_from_run else None,
                            resource_type=resource_type,
                        ),
                        sid=sid,
                    )

            # Start client WS sender task
            await start_client_ws_sender(sid, str(run_id))
            
            # Run both loops concurrently
            uplink_task = asyncio.create_task(uplink_loop())
            downlink_task = asyncio.create_task(downlink_loop())
            
            try:
                # Wait for downlink loop to complete (it will break on response.done or error)
                await downlink_task
            finally:
                # Cancel uplink loop when downlink completes
                uplink_task.cancel()
                try:
                    await uplink_task
                except asyncio.CancelledError:
                    pass

    except Exception as e:
        # Get group_id from run for error reporting
        try:
            group_params_error = InfraArtifactsGetGroupIdFromRunSqlParams(
                run_id=uuid.UUID(run_id)
            )
            group_result_error = cast(
                InfraArtifactsGetGroupIdFromRunSqlRow,
                await execute_sql_typed(conn, GET_GROUP_ID_SQL_PATH, params=group_params_error),
            )
            group_id_from_run = str(group_result_error.group_id) if group_result_error and group_result_error.group_id else None
        except Exception:
            group_id_from_run = None
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"WebSocket connection failed: {str(e)}",
                artifact_type=artifact_type,
                group_id=str(group_id_from_run) if group_id_from_run else None,
                resource_type=resource_type,
            ),
            sid=sid,
        )
    finally:
        # Clean up session
        remove_session(str(run_id))
        remove_session(sid)


async def _persist_image(
    conn: Any,
    image_id: uuid.UUID,
    image_bytes: bytes,
    mime_type: str,
    file_size: int,
    image_name: str,
) -> str:
    """Persist image to disk only (database persistence handled by complete.py)."""
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

    # Save image bytes to file using async I/O
    def _write_image_sync(path: str, data: bytes) -> None:
        with open(path, "wb") as f:
            f.write(data)

    await asyncio.to_thread(_write_image_sync, str(full_path), image_bytes)

    return file_path


async def _persist_video(
    conn: Any,
    video_id: uuid.UUID,
    video_bytes: bytes,
    upload_id: uuid.UUID,
    run_id: uuid.UUID,
) -> str:
    """Persist video to disk only (database persistence handled by complete.py)."""
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
                    artifact_type=data.get("artifact_type"),
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
                artifact_type=data.get("artifact_type"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )