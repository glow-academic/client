"""Handler for audio_regenerate WebSocket event."""

import asyncio
import uuid
from typing import Any, cast

from agents import Runner, trace
from agents.items import TResponseInputItem
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import AUDIO_FOLDER, UPLOAD_FOLDER, get_internal_sio, sio
from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel, ValidationError
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetAudioRegenerationRunContextAndCreateRunSqlParams,
        GetAudioRegenerationRunContextAndCreateRunSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class GetAudioRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        upload_id: uuid.UUID | None
        agent_id: uuid.UUID
        profile_id: uuid.UUID | None = None
        department_id: uuid.UUID | None = None
        group_id: uuid.UUID
        user_instructions: str | None = None

    class GetAudioRegenerationRunContextAndCreateRunSqlRow(BaseModel):
        agent_id: str
        agent_name: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        custom_model: str | None
        provider_id: str | None
        provider_name: str
        profile_id: str | None
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        department_id: uuid.UUID | None
        upload_id: uuid.UUID | None
        file_path: str | None
        mime_type: str | None
        run_id: str
        group_id: uuid.UUID
        previous_messages: list[Any] | None = None


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/audio/get_audio_regeneration_run_context_and_create_run_complete.sql"
)


# Pydantic models for server-to-client events
class AudioRegenerationProgressPayload(BaseModel):
    """Response indicating progress in audio regeneration."""

    type: str
    message: str | None = None
    status: str | None = None
    progress: float | None = None
    upload_id: str | None = None


class AudioRegenerationCompletePayload(BaseModel):
    """Response indicating audio regeneration completed successfully."""

    success: bool
    message: str
    audioUrl: str | None = None
    uploadId: str | None = None


class AudioRegenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in audio regeneration."""

    success: bool
    message: str
    upload_id: str | None = None


# Pydantic model for client-to-server event
class RegenerateAudioPayload(BaseModel):
    """Request to regenerate audio."""

    uploadId: str | None = None
    prompt: str
    agentId: str
    groupId: str  # REQUIRED for regeneration
    departmentId: str | None = None
    userInstructions: str | None = None


# Emit helper functions
async def audio_regeneration_progress(
    payload: AudioRegenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "audio_regeneration_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def audio_regeneration_complete(
    payload: AudioRegenerationCompletePayload, room: str
) -> None:
    await sio.emit("audio_regeneration_complete", payload.model_dump(), room=room)


async def audio_regeneration_error(
    payload: AudioRegenerationErrorPayload, room: str
) -> None:
    await sio.emit("audio_regeneration_error", payload.model_dump(), room=room)


async def _audio_regenerate_impl(sid: str, data: RegenerateAudioPayload) -> None:
    """Handle audio regeneration requests via WebSocket."""
    upload_id = uuid.UUID(data.uploadId) if data.uploadId else None
    agent_id = uuid.UUID(data.agentId)
    department_id = uuid.UUID(data.departmentId) if data.departmentId else None
    group_id = uuid.UUID(data.groupId)  # REQUIRED for regeneration

    try:
        # Get profile_id from sid lookup (O(1) Redis lookup)
        profile_id_str = await find_profile_by_socket(sid)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None

        async with get_db_connection() as conn:
            # Emit start event
            await audio_regeneration_progress(
                AudioRegenerationProgressPayload(
                    type="start",
                    message="Starting audio regeneration",
                    status="created",
                    upload_id=str(upload_id) if upload_id else None,
                ),
                room=sid,
            )

            # Get agent context AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                params = GetAudioRegenerationRunContextAndCreateRunSqlParams(
                    upload_id=upload_id,
                    agent_id=agent_id,
                    profile_id=profile_id,
                    department_id=department_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=data.userInstructions,
                )
                result = cast(
                    GetAudioRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await audio_regeneration_error(
                        AudioRegenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            upload_id=str(upload_id) if upload_id else None,
                        ),
                        room=sid,
                    )
                    return
                await audio_regeneration_error(
                    AudioRegenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize audio regeneration: {str(e)}",
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            if not result:
                await audio_regeneration_error(
                    AudioRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"No audio agent configured. "
                            "Please configure an audio agent in system settings."
                        ),
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

            # Extract context data
            encrypted_api_key = result.api_key
            model_name = result.model_name

            if not encrypted_api_key:
                agent_name = result.agent_name or "audio agent"
                await audio_regeneration_error(
                    AudioRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings."
                        ),
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await audio_regeneration_error(
                    AudioRegenerationErrorPayload(
                        success=False,
                        message=(
                            f"Failed to decrypt API key for {result.agent_name or 'audio agent'}: {str(e)}"
                        ),
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            # Initialize OpenAI client
            client = OpenAI(api_key=api_key)

            # Build input items: previous messages + prompt + user instructions
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Prepare input for chat completions
            messages: list[dict[str, Any]] = [{"role": "user", "content": data.prompt}]

            # If upload_id is provided, add audio file to input
            audio_file_path = None
            if upload_id and result.file_path:
                audio_file_path = UPLOAD_FOLDER / result.file_path
                if audio_file_path.exists():
                    messages[0]["content"] += (
                        f"\n\nAudio file to process: {audio_file_path}"
                    )

            # Add user instructions on top
            if data.userInstructions and data.userInstructions.strip():
                messages[0]["content"] += (
                    f"\n\nUser Instructions: {data.userInstructions.strip()}"
                )

            # Use GenericAgent to generate audio via chat completions (same as generate.py)
            audio_agent = GenericAgent(
                agent_name=result.agent_name or "Audio Agent",
                system_prompt=result.system_prompt or "",
                temperature=float(result.temperature)
                if result.temperature is not None
                else 0.0,
                model_name=model_name,
                provider=result.provider_name or "openai",
                base_url=result.base_url,
                api_key=api_key,
                reasoning=result.reasoning,
                tools=[],  # No tools for audio generation
                parallel_tool_calls=False,
            )

            agent_instance = audio_agent.agent()

            await audio_regeneration_progress(
                AudioRegenerationProgressPayload(
                    type="processing",
                    message="Regenerating audio...",
                    status="processing",
                    progress=0.5,
                    upload_id=str(upload_id) if upload_id else None,
                ),
                room=sid,
            )

            # Convert messages to input_items format
            input_items_for_agent: list[TResponseInputItem] = [
                {"role": "user", "content": messages[0]["content"]}
            ]

            with trace(
                "Audio Agent Regeneration",
                trace_id=None,
            ):
                result_agent = await Runner.run(
                    agent_instance,
                    input=input_items_for_agent,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            usage = result_agent.context_wrapper.usage
            assistant_output = getattr(result_agent, "final_output", None) or ""

            # For now, save the text output as a placeholder
            # TODO: When OpenAI API supports audio output in chat completions,
            # extract audio from response and save to file
            audio_filename = f"audio_{uuid.uuid4()}.txt"
            audio_relative_path = f"audio/{audio_filename}"
            AUDIO_FOLDER.mkdir(parents=True, exist_ok=True)
            audio_path = AUDIO_FOLDER / audio_filename

            await asyncio.to_thread(
                audio_path.write_text, assistant_output, encoding="utf-8"
            )

            async with conn.transaction():
                # Create upload record
                mime_type = "text/plain"  # Placeholder
                file_size = len(assistant_output.encode("utf-8"))
                sql_query = load_sql("app/sql/v4/uploads/insert_upload.sql")
                output_upload_id_str = await conn.fetchval(
                    sql_query,
                    audio_relative_path,
                    mime_type,
                    file_size,
                )

                if not output_upload_id_str:
                    await audio_regeneration_error(
                        AudioRegenerationErrorPayload(
                            success=False,
                            message="Failed to create upload record",
                            upload_id=str(upload_id) if upload_id else None,
                        ),
                        room=sid,
                    )
                    return

            # Emit async pricing event (non-blocking)
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "audio_regeneration",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": result.system_prompt or "",
                    "inputItems": input_items_for_agent,
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id) if department_id else None,
                },
            )

            # Emit completion event
            await audio_regeneration_complete(
                AudioRegenerationCompletePayload(
                    success=True,
                    message="Audio regenerated successfully",
                    audioUrl=f"/api/uploads/download/{output_upload_id_str}",
                    uploadId=output_upload_id_str,
                ),
                room=sid,
            )

    except Exception as e:
        upload_id_str = (
            str(data.uploadId) if hasattr(data, "uploadId") and data.uploadId else None
        )
        await audio_regeneration_error(
            AudioRegenerationErrorPayload(
                success=False, message=str(e), upload_id=upload_id_str
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def audio_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = RegenerateAudioPayload(**data)
        await _audio_regenerate_impl(sid, validated)
    except ValidationError as e:
        await audio_regeneration_error(
            AudioRegenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", upload_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/regenerate", response_model=dict[str, bool])
async def audio_regenerate_api(request: RegenerateAudioPayload) -> dict[str, bool]:
    """Client-to-server event: Regenerate audio using AI."""
    return {"success": True}
