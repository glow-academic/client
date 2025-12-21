"""Handler for simulation_voice_assistant_delta WebSocket event."""

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import (
    get_pool,
    get_simulation_tool_calls_dict,
    get_simulation_tool_calls_locks,
    sio,
)
from app.socket.v3.simulations.streaming.message import (
    _simulation_message_start_impl,
    _simulation_message_token_impl,
)
from app.socket.v3.simulations.streaming.tool_call import (
    _simulation_tool_call_start_impl,
    _simulation_tool_call_token_impl,
)
from app.socket.v3.simulations.text.send import (
    extract_new_message_chars,
    extract_persona_from_json,
)
from app.utils.agents.tools.create_persona_tools import find_persona_by_name
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceToolCallDeltaPayload(BaseModel):
    """Request to send assistant tool call delta in voice simulation."""

    chat_id: str
    call_id: str
    item_id: str
    delta: str
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


async def _simulation_voice_assistant_delta_impl(
    sid: str, data: VoiceToolCallDeltaPayload
) -> None:
    """Handle incremental tool call argument delta from Realtime API.

    Processes deltas incrementally to stream persona messages in real-time.
    """
    try:
        chat_id = data.chat_id
        call_id = data.call_id
        item_id = data.item_id
        delta = data.delta

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

        # Acquire lock FIRST to prevent concurrent access to the same call_id
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
                # Check if chat_id_str entry still exists (might have been cleaned up)
                if chat_id_str not in tool_calls_dict:
                    # If chat_id_str doesn't exist, it means all tool calls were completed
                    # and cleaned up. This is a late-arriving delta, ignore it.
                    return

                # At this point, chat_id_str is guaranteed to exist in tool_calls_dict
                assert chat_id_str in tool_calls_dict

                # Check if tool call state exists
                if call_id not in tool_calls_dict[chat_id_str]:
                    # First delta for this tool call - initialize state
                    # Validate chat exists and get context
                    sql_context = load_sql(
                        "sql/v3/agents/get_simulation_run_context.sql"
                    )
                    context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))

                    if not context_row:
                        await voice_tool_call_error(
                            VoiceToolCallErrorPayload(
                                success=False,
                                message=f"Chat {chat_id} not found or no scenario configured",
                            ),
                            room=sid,
                        )
                        return

                    # Get run_id (now uses groups/group_runs)
                    sql_get_latest_run = load_sql(
                        "sql/v3/simulations/get_latest_run_for_chat.sql"
                    )
                    latest_run_row = await conn.fetchrow(
                        sql_get_latest_run,
                        str(chat_id_uuid),
                    )
                    run_id = latest_run_row["run_id"] if latest_run_row else None
                    if not run_id:
                        logger.warning(
                            f"No run_id found for chat {chat_id}, "
                            "tool call delta will not be linked to a run"
                        )

                    # Get personas for this chat to look up persona_id from persona name
                    sql_personas = load_sql("sql/v3/voice/get_chat_personas.sql")
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

                    # Get latest message in chat to use as parent for message_tree
                    sql_get_latest_message = load_sql(
                        "sql/v3/simulations/get_latest_message.sql"
                    )
                    latest_message_row = await conn.fetchrow(
                        sql_get_latest_message,
                        str(chat_id_uuid),
                    )

                    parent_message_id = (
                        str(latest_message_row["id"])
                        if latest_message_row and latest_message_row.get("id")
                        else None
                    )

                    tool_calls_dict[chat_id_str][call_id] = {
                        "name": "speak",  # Inferred - voice mode only uses speak tool
                        "call_id": call_id,
                        "item_id": item_id,
                        "response_id": data.response_id,
                        "arguments_raw": "",
                        "message_so_far": "",
                        "persona_so_far": None,
                        "db_message_id": None,
                        "db_tool_call_id": None,  # Database tool call ID
                        "last_processed_index": 0,
                        "in_message": False,
                        "parent_message_id": parent_message_id,
                        "run_id": run_id,  # Cache run_id
                        "personas": personas,  # Cache personas
                        "completed": False,
                    }

                    # Create tool call in database via unified handler
                    if run_id:
                        try:
                            db_tool_call_id_str = (
                                await _simulation_tool_call_start_impl(
                                    sid,
                                    {
                                        "chat_id": chat_id_str,
                                        "run_id": str(run_id),
                                        "call_id": call_id,
                                        "tool_name": "speak",
                                    },
                                    conn=conn,
                                )
                            )
                            if db_tool_call_id_str:
                                tool_calls_dict[chat_id_str][call_id][
                                    "db_tool_call_id"
                                ] = uuid.UUID(db_tool_call_id_str)  # type: ignore[assignment]
                        except Exception as e:
                            logger.warning(
                                f"Failed to create tool call in database: {e}"
                            )

                tool_call_state = tool_calls_dict[chat_id_str][call_id]

                # Check if tool call is already completed (ignore late-arriving deltas)
                if tool_call_state.get("completed"):
                    return

                # Append arguments delta
                prev_raw = tool_call_state["arguments_raw"]
                tool_call_state["arguments_raw"] += delta
                new_raw = tool_call_state["arguments_raw"]

                # Update tool call arguments in database via unified handler
                if tool_call_state.get("db_tool_call_id"):
                    try:
                        await _simulation_tool_call_token_impl(
                            sid,
                            {
                                "tool_call_id": str(tool_call_state["db_tool_call_id"]),
                                "chat_id": chat_id_str,
                                "arguments_raw": new_raw,
                            },
                            conn=conn,
                        )
                    except Exception as e:
                        logger.warning(
                            f"Failed to update tool call arguments in database: {e}"
                        )

                # Extract persona if available
                if not tool_call_state["persona_so_far"]:
                    persona = extract_persona_from_json(new_raw)
                    if persona:
                        tool_call_state["persona_so_far"] = persona

                # Extract new message content incrementally
                new_message_chars, new_index, in_message = extract_new_message_chars(
                    prev_raw, new_raw, tool_call_state["last_processed_index"]
                )
                tool_call_state["last_processed_index"] = new_index
                tool_call_state["in_message"] = in_message

                if new_message_chars:
                    tool_call_state["message_so_far"] += new_message_chars

                    # Create DB message if not created yet
                    if tool_call_state["db_message_id"] is None:
                        # Resolve persona_id if we have persona_so_far
                        persona_id_str = None
                        if tool_call_state["persona_so_far"]:
                            persona_match = find_persona_by_name(
                                tool_call_state["persona_so_far"],
                                tool_call_state["personas"],
                            )
                            if persona_match:
                                persona_id_str = str(persona_match[0])

                        # Use unified streaming handler (handles created_at ordering automatically)
                        db_message_id_str = await _simulation_message_start_impl(
                            sid,
                            {
                                "chat_id": chat_id_str,
                                "run_id": str(tool_call_state["run_id"])
                                if tool_call_state.get("run_id")
                                else None,
                                "role": "assistant",
                                "content": "",
                                "completed": False,
                                "parent_message_id": str(
                                    tool_call_state["parent_message_id"]
                                )
                                if tool_call_state["parent_message_id"]
                                else None,
                                "persona_id": persona_id_str,
                            },
                            conn=conn,
                        )
                        if db_message_id_str:
                            db_message_id = uuid.UUID(db_message_id_str)
                            tool_call_state["db_message_id"] = db_message_id
                        else:
                            logger.error("Failed to create message via unified handler")
                            # Skip token update if message creation failed
                            return

                    # Update DB with accumulated content and emit token via unified handler
                    if tool_call_state.get("db_message_id"):
                        await _simulation_message_token_impl(
                            sid,
                            {
                                "message_id": str(tool_call_state["db_message_id"]),
                                "chat_id": chat_id_str,
                                "token": new_message_chars,
                                "accumulated_content": tool_call_state[
                                    "message_so_far"
                                ],
                            },
                            conn=conn,
                        )

                logger.debug(
                    f"Processed delta for call_id={call_id}, "
                    f"message_length={len(tool_call_state['message_so_far'])}"
                )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_delta for {sid}: {str(e)}",
            exc_info=True,
        )
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_delta(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceToolCallDeltaPayload(**data)
        await _simulation_voice_assistant_delta_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_delta for {sid}: {e}"
        )
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/delta", response_model=dict[str, bool])
async def simulation_voice_assistant_delta_api(
    request: VoiceToolCallDeltaPayload,
) -> dict[str, bool]:
    """Client-to-server event: Send incremental assistant tool call delta in voice simulation."""
    return {"success": True}


@server_router.post("/tool_call_error", response_model=dict[str, bool])
async def voice_tool_call_error_api(
    request: VoiceToolCallErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in voice tool call."""
    return {"success": True}
