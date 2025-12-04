"""Handler for start_voice WebSocket event."""

import json
import uuid
from typing import Any

from app.api.v3.realtime.ephemeral_key import _generate_ephemeral_key_internal
from app.main import _voice_sessions, get_pool, sio
from app.utils.agents.build_orchestrator_agent import build_orchestrator_agent
from app.utils.agents.tools.create_persona_tools import create_persona_tools
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class StartVoicePayload(BaseModel):
    """Client-to-server payload for start_voice."""

    chat_id: str


class StartVoiceErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


class StartVoiceResponsePayload(BaseModel):
    """Server-to-client response payload."""

    success: bool
    message: str
    ephemeral_key: str
    persona_tools: list[dict[str, str]]  # List of {name, description, parameters} for each tool
    config: dict[str, Any]  # Session config (model, audio format, etc.)


# Emit helper functions
async def start_voice_error(payload: StartVoiceErrorPayload, room: str) -> None:
    await sio.emit("start_voice_error", payload.model_dump(), room=room)


async def start_voice_response(
    payload: StartVoiceResponsePayload, room: str
) -> None:
    await sio.emit("start_voice_response", payload.model_dump(), room=room)


async def _start_voice_impl(sid: str, data: StartVoicePayload) -> None:
    """Handle voice session start requests via WebSocket."""
    try:
        logger.info(f"Received start_voice request from {sid} with data: {data}")

        chat_id = data.chat_id
        if not chat_id:
            logger.error(f"Missing chat_id in request from {sid}")
            await start_voice_error(
                StartVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        # Get connection pool
        pool = get_pool()
        if not pool:
            await start_voice_error(
                StartVoiceErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Generate ephemeral key first
            try:
                ephemeral_key, expires_in = await _generate_ephemeral_key_internal()
                logger.info(f"Generated ephemeral key for chat {chat_id} (expires in {expires_in}s)")
            except Exception as e:
                logger.error(f"Failed to generate ephemeral key: {e}", exc_info=True)
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Failed to generate ephemeral key: {str(e)}",
                    ),
                    room=sid,
                )
                return

            # Get chat context (similar to send_message)
            sql_context = load_sql("sql/v3/agents/get_simulation_run_context.sql")
            context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))

            if not context_row:
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Chat {chat_id} not found or no scenario configured",
                    ),
                    room=sid,
                )
                return

            # Get all personas for this scenario
            sql_personas = load_sql("sql/v3/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))

            if not persona_rows or len(persona_rows) == 0:
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="No personas found for this scenario",
                    ),
                    room=sid,
                )
                return

            personas = [dict(row) for row in persona_rows]

            # Build context for orchestrator agent
            context = {
                "model_name": context_row["model_name"],
                "provider_name": context_row["provider"],
                "base_url": context_row.get("base_url", ""),
                "api_key": context_row["api_key"],
                "temperature": float(context_row.get("temperature", 0.7)),
                "reasoning": context_row.get("reasoning"),
            }

            # Create persona tools
            persona_tools = create_persona_tools(personas, chat_id_uuid, conn)

            # Build orchestrator agent (we'll use it when processing realtime events)
            orchestrator_agent = build_orchestrator_agent(context, persona_tools)

            # Store orchestrator agent in a session store (we'll use Redis or in-memory dict)
            # For now, we'll store it per chat_id in a global dict
            # In production, use Redis for multi-server support
            _voice_sessions[str(chat_id_uuid)] = {
                "orchestrator_agent": orchestrator_agent,
                "personas": personas,
                "context": context,
            }

            # Format persona tools for client (include parameters for RealtimeAgent)
            persona_tools_response = []
            for tool in persona_tools:
                # Handle different tool types - only FunctionTool has description
                tool_description = ""
                if hasattr(tool, "description"):
                    tool_description = tool.description or f"Tool for {tool.name}"
                else:
                    tool_description = f"Tool for {tool.name}"

                # Extract parameters schema if available
                tool_parameters = {}
                if hasattr(tool, "parameters") and tool.parameters:
                    # Convert Pydantic model to JSON schema
                    if hasattr(tool.parameters, "model_json_schema"):
                        tool_parameters = tool.parameters.model_json_schema()
                    elif hasattr(tool.parameters, "schema"):
                        tool_parameters = tool.parameters.schema()

                persona_tools_response.append(
                    {
                        "name": tool.name,
                        "description": tool_description,
                        "parameters": tool_parameters,
                    }
                )

            # Build session config
            session_config = {
                "model": "gpt-realtime",
                "inputAudioFormat": "pcm16",
                "outputAudioFormat": "pcm16",
                "inputAudioTranscription": {
                    "model": "gpt-4o-mini-transcribe",
                },
                "turnDetection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefixPaddingMs": 300,
                    "silenceDurationMs": 500,
                },
            }

            logger.info(
                f"Started voice session for chat {chat_id} with {len(persona_tools)} persona tools"
            )

            await start_voice_response(
                StartVoiceResponsePayload(
                    success=True,
                    message="Voice session started successfully",
                    ephemeral_key=ephemeral_key,
                    persona_tools=persona_tools_response,
                    config=session_config,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in start_voice for {sid}: {str(e)}", exc_info=True)
        await start_voice_error(
            StartVoiceErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def start_voice(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StartVoicePayload(**data)
        await _start_voice_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in start_voice for {sid}: {e}")
        await start_voice_error(
            StartVoiceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

