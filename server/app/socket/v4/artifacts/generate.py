"""Unified artifact generation handler - handles ALL generation logic inline using LiteLLM."""

import asyncio
import base64
import json
import uuid
from typing import Any, cast

import httpx
import websockets
from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, trace)
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.agents.stream_agent_events import (StreamEventCallbacks,
                                                     stream_agent_events)
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
                           InsertUploadSqlParams, InsertUploadSqlRow)
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

# Try to import litellm
try:
    import litellm  # type: ignore

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

from agents import Tool
from agents.items import TResponseInputItem
# Import tool building helper
from app.infra.v4.tools.build_tool_from_config import build_tool_from_config
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
    """Handle text generation using GenericAgent (which uses LiteLLM internally)."""
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

    text_tools: list[Tool] = []
    for tool in agent_tools_config:
        if tool.name is None:
            continue
        try:
            tool_config = {
                "id": str(tool.id),
                "name": tool.name,
                "description": tool.description or "",
                "tool_type": tool.tool_type or "",
                "agent_role": tool.agent_role or "",
                "arguments": tool.arguments,
                "argument_descriptions": tool.argument_descriptions,
                "argument_defaults": tool.argument_defaults,
                "active": tool.active,
            }
            built_tool = build_tool_from_config(tool_config)
            text_tools.append(built_tool)
        except Exception:
            import logging
            logging.getLogger(__name__).warning(f"Failed to build tool {tool.name}")

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
        "generate_text_progress",
        {
            "sid": sid,
            "resource_id": str(resource_id),
            "resource_type": resource_type,
            "run_id": str(run_id),
            "type": "start",
            "message": f"Starting {result.agent_name or 'text'} generation",
        },
    )

    # Create tool use behavior
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        return ToolsToFinalOutputResult(is_final_output=False)

    # Build text agent using config
    text_agent = GenericAgent(
        agent_name=result.agent_name or "",
        system_prompt=result.system_prompt or "",
        temperature=result.temperature or 0.0,
        model_name=result.model_name or "",
        provider=result.provider or "",
        base_url=result.base_url,
        api_key=decrypted_api_key,
        reasoning=result.reasoning,
        tools=text_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )

    # Run text generation with streaming
    resource_id_str = str(group_id) if group_id else sid
    with trace(
        f"{result.agent_name or 'Text'} Agent",
        trace_id=trace_id,
        group_id=resource_id_str,
    ):
        result_runner = Runner.run_streamed(
            text_agent.agent(),
            input_items,
            context=None,
        )

    # Store the result in active runs for potential cancellation
    await store_active_run(resource_id_str, result_runner)

    completed_tool_names: set[str] = set()

    try:
        # Stream tool calls and text
        async def on_tool_call_start(tool_call_id: str, tool_name: str, call_id: str | None) -> None:
            await internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": sid,
                    "resource_id": str(resource_id),
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "type": "tool_call_start",
                    "tool_call_id": tool_call_id,
                    "tool_name": tool_name,
                },
            )

        async def on_tool_call_progress(tool_call_id: str, arguments_delta: str) -> None:
            await internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": sid,
                    "resource_id": str(resource_id),
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "type": "tool_call_progress",
                    "tool_call_id": tool_call_id,
                    "arguments_delta": arguments_delta,
                },
            )

        async def on_tool_call_complete(tool_call_id: str, arguments: dict[str, Any]) -> None:
            tool_name = arguments.get("name", "")
            completed_tool_names.add(tool_name)
            await internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": sid,
                    "resource_id": str(resource_id),
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "type": "tool_call_complete",
                    "tool_call_id": tool_call_id,
                    "tool_name": tool_name,
                    "arguments": arguments,
                },
            )

        callbacks = StreamEventCallbacks(
            on_tool_call_start=on_tool_call_start,
            on_tool_call_progress=on_tool_call_progress,
            on_tool_call_complete=on_tool_call_complete,
        )

        await stream_agent_events(result_runner, callbacks)

        # Stream text tokens
        async for event in result_runner.stream_events():
            if not hasattr(event, "type") or event.type != "raw_response_event":
                continue

            event_data = getattr(event, "data", None)
            if not event_data:
                continue

            event_data_type = getattr(event_data, "type", None)
            if event_data_type == "response.text.delta":
                delta = getattr(event_data, "delta", "")
                if delta:
                    await internal_sio.emit(
                        "generate_text_progress",
                        {
                            "sid": sid,
                            "resource_id": str(resource_id),
                            "resource_type": resource_type,
                            "run_id": str(run_id),
                            "type": "token",
                            "text": delta,
                        },
                    )

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
    usage = result_runner.context_wrapper.usage
    assistant_output = getattr(result_runner, "final_output", None) or ""
    await internal_sio.emit(
        "generate_text_complete",
        {
            "sid": sid,
            "type": "run_complete",
            "resource_id": str(resource_id),
            "resource_type": resource_type,
            "run_id": str(run_id),
            "group_id": str(group_id) if group_id else None,
            "input_text_tokens": usage.input_tokens,
            "output_text_tokens": usage.output_tokens,
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
        "generate_image_progress",
        {
            "sid": sid,
            "resource_id": str(resource_id),
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
                    image_bytes = base64.b64decode(base64_data)
                    mime_type = "image/png"  # Default for Gemini
                    file_size = len(image_bytes)

                    # Persist image
                    image_name = data.get("name", "image")
                    file_path = await _persist_image(conn, image_id, image_bytes, mime_type, file_size, image_name)

                    # Emit completion
                    await internal_sio.emit(
                        "generate_image_complete",
                        {
                            "sid": sid,
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
            "generate_image_complete",
            {
                "sid": sid,
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
        "generate_video_progress",
        {
            "sid": sid,
            "resource_id": str(resource_id),
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
                "generate_video_progress",
                {
                    "sid": sid,
                    "resource_id": str(resource_id),
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
                    "generate_video_complete",
                    {
                        "sid": sid,
                        "success": True,
                        "message": "Video generated successfully",
                        "videoUrl": f"/api/uploads/download/{upload_id}",
                        "video_id": str(video_id),
                        "run_id": str(run_id),
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
                        "generate_video_progress",
                        {
                            "sid": sid,
                            "resource_id": str(resource_id),
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
                            "generate_video_complete",
                            {
                                "sid": sid,
                                "success": True,
                                "message": "Video generated successfully",
                                "videoUrl": f"/api/uploads/download/{upload_id}",
                                "video_id": str(video_id),
                                "run_id": str(run_id),
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
    """Handle audio generation using native realtime API WebSocket."""
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

    # Generate ephemeral key using OpenAI Realtime API
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={
                    "Authorization": f"Bearer {decrypted_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "session": {
                        "type": "realtime",
                        "model": model_name,
                    }
                },
                timeout=30.0,
            )
            response.raise_for_status()
            response_data = response.json()
            ephemeral_key = response_data.get("value")
            expires_in = response_data.get("expires_in", 3600)

            if not ephemeral_key:
                raise ValueError("No ephemeral key in response")

    except Exception as e:
        raise ValueError(f"Failed to generate ephemeral key: {str(e)}")

    # Emit session started event
    await internal_sio.emit(
        "generate_audio_progress",
        {
            "sid": sid,
            "resource_id": str(resource_id),
            "resource_type": resource_type,
            "run_id": str(run_id),
            "type": "session_started",
            "ephemeral_key": ephemeral_key,
            "expires_in": expires_in,
            "model": model_name,
        },
    )

    # TODO: For WebSocket-based audio (not WebRTC), connect to realtime API
    # For now, WebRTC is handled client-side with ephemeral key


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
