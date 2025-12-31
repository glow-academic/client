"""Handler for audio_generate WebSocket event."""

import asyncio
import uuid
from pathlib import Path
from typing import Any, cast

from agents import Runner, trace
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import (GetAudioRunContextAndCreateRunSqlParams,
                           GetAudioRunContextAndCreateRunSqlRow)
from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel, ValidationError
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

AUDIO_FOLDER = UPLOAD_FOLDER / "audio"
AUDIO_FOLDER.mkdir(parents=True, exist_ok=True)


# Pydantic models for server-to-client events
class AudioGenerationProgressPayload(BaseModel):
    """Response indicating progress in audio generation."""

    type: str  # "start", "processing", "completed"
    message: str | None = None
    status: str | None = None  # "created", "processing", "completed", "failed"
    progress: float | None = None  # 0.0 to 1.0
    upload_id: str | None = None


class AudioGenerationCompletePayload(BaseModel):
    """Response indicating audio generation completed successfully."""

    success: bool
    message: str
    audioUrl: str | None = None
    uploadId: str | None = None


class AudioGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in audio generation."""

    success: bool
    message: str
    upload_id: str | None = None


# Pydantic model for client-to-server event
class GenerateAudioPayload(BaseModel):
    """Request to generate audio."""

    uploadId: str  # Input audio upload_id (optional - can be None for text-to-audio)
    prompt: str  # Text prompt for audio generation
    agentId: str  # Audio agent ID
    departmentId: str | None = None  # Optional department ID


# Emit helper functions
async def audio_generation_progress(
    payload: AudioGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "audio_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def audio_generation_complete(
    payload: AudioGenerationCompletePayload, room: str
) -> None:
    await sio.emit("audio_generation_complete", payload.model_dump(), room=room)


async def audio_generation_error(
    payload: AudioGenerationErrorPayload, room: str
) -> None:
    await sio.emit("audio_generation_error", payload.model_dump(), room=room)


SQL_PATH = "app/sql/v4/audio/get_audio_run_context_and_create_run_complete.sql"


async def _audio_generate_impl(sid: str, data: GenerateAudioPayload) -> None:
    """Handle audio generation requests via WebSocket."""
    try:
        upload_id = uuid.UUID(data.uploadId) if data.uploadId else None
        agent_id = uuid.UUID(data.agentId)
        department_id = uuid.UUID(data.departmentId) if data.departmentId else None

        # Get profile_id from sid lookup (O(1) Redis lookup)
        # Audio generation can work without profile_id (guest mode)
        profile_id_str = await find_profile_by_socket(sid)
        profile_id = uuid.UUID(profile_id_str) if profile_id_str else None

        async with get_db_connection() as conn:
            # Emit start event
            await audio_generation_progress(
                AudioGenerationProgressPayload(
                    type="start",
                    message="Starting audio generation",
                    status="created",
                    upload_id=str(upload_id) if upload_id else None,
                ),
                room=sid,
            )

            # Get agent context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetAudioRunContextAndCreateRunSqlParams(
                    upload_id=upload_id,  # Can be None for text-to-audio
                    agent_id=agent_id,
                    profile_id=profile_id,  # Can be None for guest mode
                    department_id=department_id,
                )
                result = cast(
                    GetAudioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await audio_generation_error(
                        AudioGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            upload_id=str(upload_id) if upload_id else None,
                        ),
                        room=sid,
                    )
                    return
                await audio_generation_error(
                    AudioGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize audio generation: {str(e)}",
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            if not result:
                await audio_generation_error(
                    AudioGenerationErrorPayload(
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
            dept_id = result.department_id

            if not result.api_key:
                agent_name = result.agent_name or "audio agent"
                model_name = result.model_name or "unknown model"
                await audio_generation_error(
                    AudioGenerationErrorPayload(
                        success=False,
                        message=(
                            f"API key not found for {agent_name} (model: {model_name}). "
                            "Please link an API key to the model in system settings. "
                            "For OpenAI audio generation, ensure the model is linked to an OpenAI API key."
                        ),
                        upload_id=str(upload_id) if upload_id else None,
                    ),
                    room=sid,
                )
                return

            # Extract context data
            encrypted_api_key = result.api_key
            model_name = result.model_name
            # Decrypt the API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except ValueError as e:
                await audio_generation_error(
                    AudioGenerationErrorPayload(
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

            # Prepare input for chat completions
            # For gpt-audio, we can pass audio files as input
            messages: list[dict[str, Any]] = [
                {"role": "user", "content": data.prompt}
            ]

            # If upload_id is provided, add audio file to input
            audio_file_path = None
            if upload_id and result.file_path:
                # Read audio file from uploads folder
                audio_file_path = UPLOAD_FOLDER / result.file_path
                if audio_file_path.exists():
                    # For OpenAI chat completions with audio, we need to pass the file
                    # OpenAI expects file objects or file paths
                    with open(audio_file_path, "rb") as audio_file:
                        # Create file object for OpenAI API
                        # Note: OpenAI chat completions API accepts audio files in the content
                        # Format depends on OpenAI API version - for now, we'll use text prompt
                        # and let the model handle audio generation
                        pass  # Audio input handling can be added when OpenAI API supports it

            # Use GenericAgent to generate audio via chat completions
            # gpt-audio model works with chat completions API
            audio_agent = GenericAgent(
                agent_name=result.agent_name or "Audio Agent",
                system_prompt=result.system_prompt or "",
                temperature=float(result.temperature) if result.temperature is not None else 0.0,
                model_name=model_name,
                provider=result.provider_name or "openai",
                base_url=result.base_url,
                api_key=api_key,
                reasoning=result.reasoning,
                tools=[],  # No tools for audio generation
                parallel_tool_calls=False,
            )

            agent_instance = audio_agent.agent()

            # Run agent to generate audio
            # Note: gpt-audio with chat completions may return audio in the response
            # For now, we'll generate text and handle audio output separately
            # This is a placeholder - actual implementation depends on OpenAI API support
            await audio_generation_progress(
                AudioGenerationProgressPayload(
                    type="processing",
                    message="Generating audio...",
                    status="processing",
                    progress=0.5,
                    upload_id=str(upload_id) if upload_id else None,
                ),
                room=sid,
            )

            # Run agent with streaming (if supported) or regular run
            with trace(
                "Audio Agent",
                trace_id=None,
            ):
                from agents.items import TResponseInputItem

                input_items: list[TResponseInputItem] = [
                    {"role": "user", "content": data.prompt}
                ]
                result_agent = await Runner.run(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            usage = result_agent.context_wrapper.usage
            assistant_output = getattr(result_agent, "final_output", None) or ""

            # For now, save the text output as a placeholder
            # TODO: When OpenAI API supports audio output in chat completions,
            # extract audio from response and save to file
            # For now, we'll create a placeholder upload record
            audio_filename = f"audio_{uuid.uuid4()}.txt"  # Placeholder - should be .mp3 or .wav
            audio_relative_path = f"audio/{audio_filename}"
            AUDIO_FOLDER.mkdir(parents=True, exist_ok=True)
            audio_path = AUDIO_FOLDER / audio_filename

            # Save text output for now (replace with audio when API supports it)
            await asyncio.to_thread(audio_path.write_text, assistant_output, encoding="utf-8")

            async with conn.transaction():
                # Create upload record
                mime_type = "text/plain"  # Placeholder - should be audio/mpeg or audio/wav
                file_size = len(assistant_output.encode("utf-8"))
                sql_query = load_sql("app/sql/v4/uploads/insert_upload.sql")
                output_upload_id_str = await conn.fetchval(
                    sql_query,
                    audio_relative_path,
                    mime_type,
                    file_size,
                )

                if not output_upload_id_str:
                    await audio_generation_error(
                        AudioGenerationErrorPayload(
                            success=False,
                            message="Failed to create upload record",
                            upload_id=str(upload_id) if upload_id else None,
                        ),
                        room=sid,
                    )
                    return

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "audio",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": result.system_prompt or "",
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(dept_id) if dept_id else None,
                },
            )

            # Emit completion event
            await audio_generation_complete(
                AudioGenerationCompletePayload(
                    success=True,
                    message="Audio generated successfully",
                    audioUrl=f"/api/uploads/download/{output_upload_id_str}",
                    uploadId=output_upload_id_str,
                ),
                room=sid,
            )

    except Exception as e:
        upload_id_str = str(data.uploadId) if hasattr(data, "uploadId") and data.uploadId else None
        await audio_generation_error(
            AudioGenerationErrorPayload(
                success=False, message=str(e), upload_id=upload_id_str
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def audio_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateAudioPayload(**data)
        await _audio_generate_impl(sid, validated)
    except ValidationError as e:
        await audio_generation_error(
            AudioGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", upload_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def audio_generate_api(request: GenerateAudioPayload) -> dict[str, bool]:
    """Client-to-server event: Generate audio using AI."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def audio_generation_progress_api(
    request: AudioGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Progress update for audio generation."""
    return {"success": True}


@server_router.post("/generation_complete", response_model=dict[str, bool])
async def audio_generation_complete_api(
    request: AudioGenerationCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Audio generation completed successfully."""
    return {"success": True}


@server_router.post("/generation_error", response_model=dict[str, bool])
async def audio_generation_error_api(
    request: AudioGenerationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during audio generation."""
    return {"success": True}
