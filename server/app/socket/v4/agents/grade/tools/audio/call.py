"""Handler for audio tool WebSocket event."""

import uuid
from typing import Any, cast

from agents import Runner, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client, emit_to_internal
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import (
    CreateModelRunSqlParams,
    CreateModelRunSqlRow,
    GetAudioGradingRunContextSqlParams,
    GetAudioGradingRunContextSqlRow,
    GetMessagesWithAudioSqlParams,
    GetMessagesWithAudioSqlRow,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class AudioToolPayload(BaseModel):
    """Request to grade audio from grading tool."""

    chat_id: str
    trace_id: str
    message_numbers: list[int]
    what_to_analyze: str
    agent_id: str
    department_id: str
    message_id_map: dict[str, int]
    profile_id: str | None = None  # Deprecated - retrieved from sid
    sid: str | None = None


class AudioToolCompletePayload(BaseModel):
    """Response indicating audio tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    analysis: str
    message: str | None = None


class AudioToolErrorPayload(BaseModel):
    """Response indicating an error occurred in audio tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def _grading_tool_audio_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID | None = None,
    group_id: uuid.UUID | None = None,
) -> str | None:
    """Internal implementation for audio grading.

    Can be called directly (from generate.py) or via event handler.
    When called directly, data may contain _result_callback for synchronous results.

    Returns:
        Analysis result string if called synchronously (with _result_callback), None otherwise
    """
    # Check if this is a synchronous call (for tool result)
    result_callback = data.pop("_result_callback", None)
    is_synchronous = result_callback is not None

    try:
        validated = AudioToolPayload(**data)
    except ValidationError as e:
        error_msg = f"Invalid payload: {str(e)}"
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await emit_to_client(
            "grading_tools_audio_error",
            AudioToolErrorPayload(
                success=False,
                chat_id=data.get("chat_id", "unknown"),
                trace_id=data.get("trace_id", "unknown"),
                message=error_msg,
            ),
            room=sid,
        )
        return None

    # Get profile_id from sid if not provided
    if not profile_id:
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            error_msg = "Profile not found for socket"
            if is_synchronous and result_callback:
                await result_callback(None, error_msg)
                return None
            await emit_to_client(
                "grading_tools_audio_error",
                AudioToolErrorPayload(
                    success=False,
                    chat_id=validated.chat_id,
                    trace_id=validated.trace_id,
                    message=error_msg,
                ),
                room=sid,
            )
            return None
        profile_id = uuid.UUID(profile_id_str)

    chat_id = validated.chat_id
    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            chat_id_uuid = uuid.UUID(chat_id)
            department_id_uuid = uuid.UUID(data.department_id)
            agent_id_uuid = uuid.UUID(data.agent_id)

            # Map message numbers to message IDs (reverse the mapping)
            number_to_id_map: dict[int, str] = {
                num: msg_id for msg_id, num in data.message_id_map.items()
            }
            message_ids: list[uuid.UUID] = []
            for num in data.message_numbers:
                if num in number_to_id_map:
                    try:
                        message_ids.append(uuid.UUID(number_to_id_map[num]))
                    except ValueError:
                        pass

            if not message_ids:
                error_msg = (
                    "No valid message IDs found for the specified message numbers"
                )
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await emit_to_client(
                    "grading_tools_audio_error",
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            # Get audio uploads for the specified messages
            SQL_GET_AUDIO_PATH = (
                "app/sql/v4/simulations/get_messages_with_audio_complete.sql"
            )
            get_audio_params = GetMessagesWithAudioSqlParams(
                chat_id=chat_id_uuid,
                message_ids=message_ids,
            )
            audio_rows = await execute_sql_typed(
                conn, SQL_GET_AUDIO_PATH, params=get_audio_params
            )
            # execute_sql_typed returns a list for RETURNS TABLE functions
            if isinstance(audio_rows, list):
                audio_results = audio_rows
            else:
                audio_results = [audio_rows] if audio_rows else []

            if not audio_results:
                error_msg = "No audio files found for the specified messages"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await emit_to_client(
                    "grading_tools_audio_error",
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            # Get audio agent context
            SQL_AUDIO_CONTEXT_PATH = (
                "app/sql/v4/grading/get_audio_grading_run_context_complete.sql"
            )
            audio_context_params = GetAudioGradingRunContextSqlParams(
                agent_id=agent_id_uuid,
                department_id=department_id_uuid,
            )
            audio_context_result = cast(
                GetAudioGradingRunContextSqlRow | None,
                await execute_sql_typed(
                    conn, SQL_AUDIO_CONTEXT_PATH, params=audio_context_params
                ),
            )

            if not audio_context_result:
                error_msg = "Audio grading agent not found or not configured"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await emit_to_client(
                    "grading_tools_audio_error",
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            # Build audio file paths
            audio_files: list[dict[str, Any]] = []
            for row in audio_results:
                file_path = row.file_path
                full_path = UPLOAD_FOLDER / file_path
                if full_path.exists():
                    audio_files.append(
                        {
                            "message_id": row.message_id,
                            "file_path": str(full_path),
                            "mime_type": row.mime_type,
                        }
                    )

            if not audio_files:
                error_msg = "Audio files not found on disk"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await emit_to_client(
                    "grading_tools_audio_error",
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            # Prepare input for audio agent
            # Create a prompt that includes what to analyze
            analysis_prompt = f"""You are analyzing audio messages from a conversation. 

The user wants you to analyze: {data.what_to_analyze}

Please provide a detailed analysis based on this request. Consider aspects such as tone, clarity, emotional state, speech patterns, or any other relevant factors based on what was requested."""

            input_items: list[TResponseInputItem] = [
                {"role": "user", "content": analysis_prompt}
            ]

            # Add audio files to input (format depends on the model API)
            # For OpenAI audio models, we'd add audio input items
            # For now, we'll include file paths in the prompt and let the agent handle it
            audio_description = (
                f"\n\nAudio files to analyze ({len(audio_files)} files):\n"
            )
            for i, audio_file in enumerate(audio_files, 1):
                audio_description += f"{i}. Message {audio_file['message_id']}: {audio_file['file_path']}\n"

            input_items[0]["content"] += audio_description

            # Create audio agent
            audio_agent = GenericAgent(
                agent_name=audio_context_result.agent_name,
                system_prompt=audio_context_result.system_prompt,
                temperature=float(audio_context_result.temperature)
                if audio_context_result.temperature is not None
                else 0.0,
                model_name=audio_context_result.model_name,
                provider=audio_context_result.provider,
                base_url=audio_context_result.base_url,
                api_key=audio_context_result.api_key,
                reasoning=audio_context_result.reasoning,
                tools=[],  # No tools for audio analysis
                parallel_tool_calls=False,
            )

            agent_instance = audio_agent.agent()

            # Create model run for audio grading
            SQL_CREATE_RUN_PATH = "app/sql/v4/model_runs/create_model_run_complete.sql"
            create_run_params = CreateModelRunSqlParams(
                department_id=department_id_uuid,
                model_id=uuid.UUID(audio_context_result.model_id),
                entity_id=agent_id_uuid,
                entity_type="agent",
                profile_id=profile_id,  # From sid lookup
                key_id=None,
                agent_id=agent_id_uuid,
            )
            create_run_result = cast(
                CreateModelRunSqlRow,
                await execute_sql_typed(
                    conn, SQL_CREATE_RUN_PATH, params=create_run_params
                ),
            )
            model_run_id = uuid.UUID(create_run_result.run_id)

            # Run the audio agent
            with trace(
                f"Audio Grading - {chat_id}",
                trace_id=trace_id,
                group_id=chat_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            analysis = getattr(result, "final_output", None) or "No analysis provided"

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result.context_wrapper.usage
            await emit_to_internal(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "simulation_audio",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": audio_context_result.system_prompt,
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": analysis,
                    "departmentId": str(department_id_uuid),
                },
                sid=sid,
                group_id=str(group_id) if group_id else None,
            )

            # If synchronous call, return result via callback
            if is_synchronous and result_callback:
                await result_callback(analysis, None)
                return analysis

            # Otherwise emit completion event
            await emit_to_client(
                "grading_tools_audio_complete",
                AudioToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    analysis=analysis,
                    message=f"Audio analysis completed for {len(audio_files)} file(s)",
                ),
                room=sid,
            )
            return None

    except RuntimeError:
        error_msg = "Database connection pool not available"
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await emit_to_client(
            "grading_tools_audio_error",
            AudioToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=sid,
        )
        return None
    except Exception as e:
        error_msg = str(e)
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await emit_to_client(
            "grading_tools_audio_error",
            AudioToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=sid,
        )
        return None


@internal_sio.on("grading_tool_audio")  # type: ignore
async def grading_tool_audio_internal(data: dict[str, Any]) -> None:
    """Handle audio grading event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    # Note: _result_callback may be in payload for direct calls from generate.py
    await _grading_tool_audio_impl(sid, payload)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/audio",
    AudioToolPayload,
    "Grade audio messages",
)

register_client_endpoint(
    server_router,
    "/audio_complete",
    AudioToolCompletePayload,
    "Audio tool completed successfully",
)

register_client_endpoint(
    server_router,
    "/audio_error",
    AudioToolErrorPayload,
    "Audio tool error",
)
