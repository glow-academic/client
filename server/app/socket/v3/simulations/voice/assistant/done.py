"""Handler for simulation_voice_assistant_done WebSocket event."""

import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import (
    _voice_message_ids,
    get_pool,
    get_simulation_tool_calls_dict,
    get_simulation_tool_calls_locks,
    sio,
)
from app.socket.v3.simulations.streaming.message import (
    _simulation_message_complete_impl,
    _simulation_message_start_impl,
)
from app.socket.v3.simulations.streaming.tool_call import (
    _simulation_tool_call_complete_impl,
)
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceToolCallDonePayload(BaseModel):
    """Request to signal that assistant tool call is done in voice simulation."""

    chat_id: str
    call_id: str
    item_id: str
    arguments: str  # Complete JSON string
    response_id: str


class VoiceToolCallErrorPayload(BaseModel):
    """Response indicating an error occurred in assistant tool call."""

    success: bool
    message: str


# Emit helper functions
async def voice_tool_call_error(payload: VoiceToolCallErrorPayload, room: str) -> None:
    await sio.emit(
        "simulations_voice_assistant_tool_call_error", payload.model_dump(), room=room
    )


async def _simulation_voice_assistant_done_impl(
    sid: str, data: VoiceToolCallDonePayload
) -> None:
    """Handle tool call completion from Realtime API.

    Finalizes the message and marks it as completed.
    """
    try:
        chat_id = data.chat_id
        call_id = data.call_id

        if not chat_id:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        if not call_id:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(success=False, message="Missing call_id"),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        # Get tool calls tracking dict and locks for this chat (before acquiring lock)
        tool_calls_dict = get_simulation_tool_calls_dict()
        tool_calls_locks = get_simulation_tool_calls_locks()
        chat_id_str = str(chat_id_uuid)
        if chat_id_str not in tool_calls_dict:
            tool_calls_dict[chat_id_str] = {}
        if chat_id_str not in tool_calls_locks:
            tool_calls_locks[chat_id_str] = {}

        # Get or create lock for this call_id (before acquiring lock)
        if call_id not in tool_calls_locks[chat_id_str]:
            tool_calls_locks[chat_id_str][call_id] = asyncio.Lock()

        call_lock = tool_calls_locks[chat_id_str][call_id]

        # Acquire lock FIRST to prevent concurrent access with delta handler
        async with call_lock:
            # Now acquire database connection INSIDE the lock
            pool = get_pool()
            if not pool:
                logger.error("Database connection pool not available")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Database connection pool not available",
                    ),
                    room=sid,
                )
                return

            async with pool.acquire() as conn:
                # Check if tool call state exists
                if (
                    chat_id_str not in tool_calls_dict
                    or call_id not in tool_calls_dict[chat_id_str]
                ):
                    logger.warning(
                        f"Tool call state not found for call_id={call_id}, "
                        f"chat_id={chat_id_str}. This may happen if delta events were missed."
                    )
                    # Try to process the final arguments directly
                    try:
                        final_args = json.loads(data.arguments)
                        persona_name = final_args.get("persona", "")
                        message_content = final_args.get("message", "")

                        if not persona_name or not message_content:
                            await voice_tool_call_error(
                                VoiceToolCallErrorPayload(
                                    success=False,
                                    message="Invalid arguments: missing persona or message",
                                ),
                                room=sid,
                            )
                            return

                        # Fall back to existing voice_tool_call handler logic
                        # (This is a fallback - ideally we should have received deltas)
                        # Note: We could call the existing voice_tool_call handler here,
                        # but for now we'll just log and return an error
                        await voice_tool_call_error(
                            VoiceToolCallErrorPayload(
                                success=False,
                                message="Tool call state not found. Delta events may have been missed.",
                            ),
                            room=sid,
                        )
                        return
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse final arguments JSON: {e}")
                        await voice_tool_call_error(
                            VoiceToolCallErrorPayload(
                                success=False,
                                message=f"Invalid JSON in arguments: {str(e)}",
                            ),
                            room=sid,
                        )
                        return

                tool_call_state = tool_calls_dict[chat_id_str][call_id]

                # Mark as completed FIRST to prevent late deltas from interfering
                tool_call_state["completed"] = True

                # Finalize tool call in database
                if tool_call_state.get("db_tool_call_id"):
                    try:
                        # Finalize tool call via unified handler
                        await _simulation_tool_call_complete_impl(
                            sid,
                            {
                                "tool_call_id": str(tool_call_state["db_tool_call_id"]),
                                "chat_id": chat_id_str,
                                "arguments_raw": data.arguments,  # Final complete JSON string
                            },
                            conn=conn,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to finalize tool call in database: {e}")

                # Parse final arguments to extract persona and message
                try:
                    final_args = json.loads(data.arguments)
                    persona_name = final_args.get("persona", "")
                    message_content = final_args.get("message", "")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse final arguments JSON: {e}")
                    await voice_tool_call_error(
                        VoiceToolCallErrorPayload(
                            success=False,
                            message=f"Invalid JSON in arguments: {str(e)}",
                        ),
                        room=sid,
                    )
                    return

                if not persona_name:
                    await voice_tool_call_error(
                        VoiceToolCallErrorPayload(
                            success=False, message="Missing persona in arguments"
                        ),
                        room=sid,
                    )
                    return

                if not message_content:
                    await voice_tool_call_error(
                        VoiceToolCallErrorPayload(
                            success=False, message="Missing message in arguments"
                        ),
                        room=sid,
                    )
                    return

                # Get personas for this chat to look up persona_id
                sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
                persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))

                if not persona_rows or len(persona_rows) == 0:
                    await voice_tool_call_error(
                        VoiceToolCallErrorPayload(
                            success=False,
                            message="No personas found for this scenario",
                        ),
                        room=sid,
                    )
                    return

                personas = [dict(row) for row in persona_rows]

                # Normalize persona name
                persona_name_normalized = persona_name.strip() if persona_name else ""

                # Look up persona_id from persona name
                # Inline find_persona_by_name logic
                def sanitize_persona_name(name: str) -> str:
                    sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
                    sanitized = sanitized.replace(" ", "_").lower()
                    return sanitized or "persona"
                
                def find_persona_by_name_inline(
                    persona_name: str, personas: list[dict[str, Any]]
                ) -> tuple[uuid.UUID, str] | None:
                    if not persona_name or not persona_name.strip():
                        return None
                    persona_name_normalized = persona_name.strip()
                    sanitized_search = sanitize_persona_name(persona_name_normalized)
                    for persona in personas:
                        persona_id_str = persona.get("persona_id") or persona.get("id")
                        if not persona_id_str:
                            continue
                        persona_display_name = persona.get("persona_name") or persona.get("name", "")
                        if not persona_display_name:
                            continue
                        if persona_name_normalized.lower() == persona_display_name.lower():
                            try:
                                persona_id = uuid.UUID(str(persona_id_str))
                                return (persona_id, persona_display_name)
                            except (ValueError, TypeError):
                                continue
                        sanitized_persona = sanitize_persona_name(persona_display_name)
                        if sanitized_search == sanitized_persona:
                            try:
                                persona_id = uuid.UUID(str(persona_id_str))
                                return (persona_id, persona_display_name)
                            except (ValueError, TypeError):
                                continue
                    for persona in personas:
                        persona_id_str = persona.get("persona_id") or persona.get("id")
                        if not persona_id_str:
                            continue
                        persona_display_name = persona.get("persona_name") or persona.get("name", "")
                        if not persona_display_name:
                            continue
                        if persona_name_normalized.lower() in persona_display_name.lower():
                            try:
                                persona_id = uuid.UUID(str(persona_id_str))
                                return (persona_id, persona_display_name)
                            except (ValueError, TypeError):
                                continue
                    return None
                
                persona_match = find_persona_by_name_inline(persona_name_normalized, personas)

                if not persona_match:
                    persona_names = [
                        p.get("persona_name") or p.get("name", "")
                        for p in personas
                        if p.get("persona_name") or p.get("name")
                    ]
                    available_list = "\n".join(f"  - {name}" for name in persona_names)
                    error_msg = (
                        f"Persona '{persona_name_normalized}' not found. "
                        f"Available personas:\n{available_list}\n\n"
                        f"Please use the exact persona name from the list above."
                    )
                    await voice_tool_call_error(
                        VoiceToolCallErrorPayload(
                            success=False,
                            message=error_msg,
                        ),
                        room=sid,
                    )
                    return

                persona_id_uuid_obj, persona_display_name = persona_match
                persona_id = str(persona_id_uuid_obj)

                # Ensure we have a DB message (should have been created during deltas)
                if tool_call_state["db_message_id"] is None:
                    logger.warning(
                        f"No DB message found for call_id={call_id}, creating one now"
                    )
                    # Get run_id (now uses groups/group_runs)
                    sql_get_latest_run = load_sql(
                        "sql/v3/simulations/get_latest_run_for_chat.sql"
                    )
                    latest_run_row = await conn.fetchrow(
                        sql_get_latest_run,
                        str(chat_id_uuid),
                    )
                    run_id = latest_run_row["run_id"] if latest_run_row else None

                    # Use unified streaming handler to create message
                    db_message_id_str = await _simulation_message_start_impl(
                        sid,
                        {
                            "chat_id": chat_id_str,
                            "run_id": str(run_id) if run_id else None,
                            "role": "assistant",
                            "content": "",
                            "completed": False,
                            "parent_message_id": str(
                                tool_call_state["parent_message_id"]
                            )
                            if tool_call_state["parent_message_id"]
                            else None,
                            "persona_id": persona_id,
                        },
                        conn=conn,
                    )
                    if db_message_id_str:
                        db_message_id = uuid.UUID(db_message_id_str)
                        tool_call_state["db_message_id"] = db_message_id
                    else:
                        logger.error("Failed to create message via unified handler")
                        return

                db_message_id = tool_call_state["db_message_id"]

                # Use final message content (may be more complete than accumulated)
                final_content = message_content.strip()

                # Complete message via unified handler (handles DB update and client emission)
                await _simulation_message_complete_impl(
                    sid,
                    {
                        "message_id": str(db_message_id),
                        "chat_id": chat_id_str,
                        "final_content": final_content,
                    },
                    conn=conn,
                )

                # Add message ID to accumulator for voice_response_done handler
                if chat_id_str not in _voice_message_ids:
                    _voice_message_ids[chat_id_str] = []
                if str(db_message_id) not in _voice_message_ids[chat_id_str]:
                    _voice_message_ids[chat_id_str].append(str(db_message_id))

                # Note: simulation_new_message is already emitted by _simulation_message_complete_impl
                # No need to emit again here

                # Clean up state and locks
                del tool_calls_dict[chat_id_str][call_id]
                if call_id in tool_calls_locks[chat_id_str]:
                    del tool_calls_locks[chat_id_str][call_id]
                if not tool_calls_dict[chat_id_str]:
                    del tool_calls_dict[chat_id_str]
                if not tool_calls_locks[chat_id_str]:
                    del tool_calls_locks[chat_id_str]

                logger.info(
                    f"Completed tool call call_id={call_id} for chat {chat_id}, "
                    f"message_length={len(final_content)}"
                )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_done for {sid}: {str(e)}",
            exc_info=True,
        )
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_done(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceToolCallDonePayload(**data)
        await _simulation_voice_assistant_done_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_done for {sid}: {e}"
        )
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/done", response_model=dict[str, bool])
async def simulation_voice_assistant_done_api(
    request: VoiceToolCallDonePayload,
) -> dict[str, bool]:
    """Client-to-server event: Signal that assistant tool call is done in voice simulation."""
    return {"success": True}


@server_router.post("/done", response_model=dict[str, bool])
async def simulation_voice_assistant_done_server_api(
    request: VoiceToolCallDonePayload,
) -> dict[str, bool]:
    """Server-to-client event: Assistant tool call done in voice simulation."""
    return {"success": True}
