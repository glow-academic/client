"""Handler for grading_tool_audio WebSocket event."""

import uuid
from typing import Any

from agents import Runner, trace
from agents.items import TResponseInputItem
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.main import UPLOAD_FOLDER, get_internal_sio, get_pool, sio
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
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
    profile_id: str | None = None
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


async def audio_tool_complete(payload: AudioToolCompletePayload, room: str) -> None:
    logger.info(
        f"[grading_tool_audio_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, chat_id={payload.chat_id}"
    )
    await sio.emit("grading_tools_audio_complete", payload.model_dump(), room=room)
    logger.info(f"[grading_tool_audio_complete] Emitted to room={room}")


async def audio_tool_error(payload: AudioToolErrorPayload, room: str) -> None:
    await sio.emit("grading_tools_audio_error", payload.model_dump(), room=room)


async def _grading_tool_audio_impl(sid: str, data: dict[str, Any]) -> str | None:
    """Internal implementation for audio grading.

    Returns:
        Analysis result string if called synchronously (with _result_callback), None otherwise
    """
    logger.info(
        f"[grading_tool_audio] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, trace_id={data.get('trace_id', 'unknown')}"
    )

    # Check if this is a synchronous call (for tool result)
    result_callback = data.pop("_result_callback", None)
    is_synchronous = result_callback is not None

    try:
        validated = AudioToolPayload(**data)
    except ValidationError as e:
        error_msg = f"Invalid payload: {str(e)}"
        logger.error(f"Validation error in grading_tool_audio for {sid}: {e}")
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await audio_tool_error(
            AudioToolErrorPayload(
                success=False,
                chat_id=data.get("chat_id", "unknown"),
                trace_id=data.get("trace_id", "unknown"),
                message=error_msg,
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return None

    chat_id = validated.chat_id
    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        error_msg = "Database connection pool not available"
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await audio_tool_error(
            AudioToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=f"simulation_{chat_id}",
        )
        return None

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            chat_id_uuid = uuid.UUID(chat_id)
            department_id_uuid = uuid.UUID(validated.department_id)
            agent_id_uuid = uuid.UUID(validated.agent_id)

            # Map message numbers to message IDs (reverse the mapping)
            number_to_id_map: dict[int, str] = {
                num: msg_id for msg_id, num in validated.message_id_map.items()
            }
            message_ids: list[uuid.UUID] = []
            for num in validated.message_numbers:
                if num in number_to_id_map:
                    try:
                        message_ids.append(uuid.UUID(number_to_id_map[num]))
                    except ValueError as e:
                        logger.warning(
                            f"Invalid message ID format {number_to_id_map[num]}: {e}, skipping"
                        )
                else:
                    logger.warning(
                        f"Message number {num} not found in message_id_map, skipping"
                    )

            if not message_ids:
                error_msg = (
                    "No valid message IDs found for the specified message numbers"
                )
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await audio_tool_error(
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            # Get audio uploads for the specified messages
            sql_get_audio = load_sql("app/sql/v3/simulations/get_messages_with_audio.sql")
            sql_query = sql_get_audio
            sql_params = (str(chat_id_uuid), message_ids)
            audio_rows = await conn.fetch(sql_get_audio, str(chat_id_uuid), message_ids)

            if not audio_rows:
                error_msg = "No audio files found for the specified messages"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await audio_tool_error(
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            # Get audio agent context
            sql_audio_context = load_sql(
                "sql/v3/agents/get_audio_grading_run_context.sql"
            )
            audio_context_row = await conn.fetchrow(
                sql_audio_context, str(agent_id_uuid), str(department_id_uuid)
            )

            if not audio_context_row:
                error_msg = "Audio grading agent not found or not configured"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await audio_tool_error(
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            # Build audio file paths
            audio_files: list[dict[str, Any]] = []
            for row in audio_rows:
                file_path = row["file_path"]
                full_path = UPLOAD_FOLDER / file_path
                if full_path.exists():
                    audio_files.append(
                        {
                            "message_id": row["message_id"],
                            "file_path": str(full_path),
                            "mime_type": row["mime_type"],
                        }
                    )
                else:
                    logger.warning(
                        f"Audio file not found: {full_path} for message {row['message_id']}"
                    )

            if not audio_files:
                error_msg = "Audio files not found on disk"
                if is_synchronous and result_callback:
                    await result_callback(None, error_msg)
                    return None
                await audio_tool_error(
                    AudioToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            # Prepare input for audio agent
            # Create a prompt that includes what to analyze
            analysis_prompt = f"""You are analyzing audio messages from a conversation. 

The user wants you to analyze: {validated.what_to_analyze}

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
                agent_name=audio_context_row["agent_name"],
                system_prompt=audio_context_row["system_prompt"],
                temperature=float(audio_context_row["temperature"])
                if audio_context_row["temperature"] is not None
                else 0.0,
                model_name=audio_context_row["model_name"],
                provider=audio_context_row["provider"],
                base_url=audio_context_row["base_url"],
                api_key=audio_context_row["api_key"],
                reasoning=audio_context_row["reasoning"],
                tools=[],  # No tools for audio analysis
                parallel_tool_calls=False,
            )

            agent_instance = audio_agent.agent()

            # Create model run for audio grading
            sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id_uuid),
                audio_context_row["model_id"],
                str(agent_id_uuid),
                "agent",
                validated.profile_id or audio_context_row["profile_id"],
                None,  # key_id
                str(agent_id_uuid),  # agent_id
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

            # Run the audio agent
            logger.info(f"Running audio grading agent for chat {chat_id}...")
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
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "simulation_grade_audio",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": audio_context_row.get("system_prompt", ""),
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": analysis,
                    "departmentId": str(department_id_uuid),
                },
            )

            # If synchronous call, return result via callback
            if is_synchronous and result_callback:
                await result_callback(analysis, None)
                return analysis

            # Otherwise emit completion event
            await audio_tool_complete(
                AudioToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    analysis=analysis,
                    message=f"Audio analysis completed for {len(audio_files)} file(s)",
                ),
                room=f"simulation_{chat_id}",
            )

            logger.info(
                f"Audio grading completed for chat {chat_id}, analysis length: {len(analysis)}"
            )
            return None

    except Exception as e:
        logger.error(f"Error in grading_tool_audio for {sid}: {str(e)}", exc_info=True)
        error_msg = str(e)
        if is_synchronous and result_callback:
            await result_callback(None, error_msg)
            return None
        await audio_tool_error(
            AudioToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=f"simulation_{chat_id}",
        )
        return None


@sio.event  # type: ignore
async def grading_tool_audio(sid: str, data: dict[str, Any]) -> None:
    """Handle audio grading event from grading tool (client-to-server)."""
    await _grading_tool_audio_impl(sid, data)


@internal_sio.on("grading_tool_audio")
async def grading_tool_audio_internal(data: dict[str, Any]) -> None:
    """Handle audio grading event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _grading_tool_audio_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/audio", response_model=dict[str, bool])
async def grading_tool_audio_api(request: AudioToolPayload) -> dict[str, bool]:
    """Client-to-server event: Grade audio messages."""
    return {"success": True}


@server_router.post("/audio_complete", response_model=dict[str, bool])
async def audio_tool_complete_api(
    request: AudioToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Audio tool completed successfully."""
    return {"success": True}


@server_router.post("/audio_error", response_model=dict[str, bool])
async def audio_tool_error_api(request: AudioToolErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Audio tool error."""
    return {"success": True}
