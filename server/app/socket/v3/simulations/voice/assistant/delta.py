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
from app.socket.v3.simulations.text.send import (
    SimulationMessageTokenPayload,
    SimulationNewMessagePayload,
    extract_new_message_chars,
    extract_persona_from_json,
    simulation_message_token,
    simulation_new_message,
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
                    sql_get_latest_run = load_sql("sql/v3/simulations/get_latest_run_for_chat.sql")
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
                    latest_message_row = await conn.fetchrow(
                        """
                        SELECT m.id
                        FROM messages m
                        JOIN message_runs mr ON mr.message_id = m.id
                        JOIN runs r ON r.id = mr.run_id
                        JOIN group_runs gr ON gr.run_id = r.id
                        JOIN groups g ON g.id = gr.group_id
                        JOIN chats c ON c.group_id = g.id
                        WHERE c.id = $1::uuid
                          AND NOT EXISTS (
                              SELECT 1 FROM message_tree mt 
                              WHERE mt.parent_id = m.id AND mt.active = true
                          )
                        ORDER BY m.created_at DESC
                        LIMIT 1
                        """,
                        chat_id_uuid,
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
                    
                    # Create tool call in database
                    if run_id:
                        try:
                            sql_create_tool_call = load_sql(
                                "sql/v3/tool_calls/create_tool_call.sql"
                            )
                            tool_call_row = await conn.fetchrow(
                                sql_create_tool_call,
                                call_id,
                                "speak",
                            )
                            if tool_call_row:
                                tool_calls_dict[chat_id_str][call_id]["db_tool_call_id"] = tool_call_row["id"]
                                # Link tool call to run
                                sql_link_tool_call = load_sql(
                                    "sql/v3/tool_calls/link_tool_call_to_run.sql"
                                )
                                await conn.execute(
                                    sql_link_tool_call,
                                    str(tool_call_row["id"]),
                                    run_id,
                                )
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
                
                # Update tool call arguments in database
                if tool_call_state.get("db_tool_call_id"):
                    try:
                        sql_update_args = load_sql(
                            "sql/v3/tool_calls/update_tool_call_arguments.sql"
                        )
                        await conn.execute(
                            sql_update_args,
                            str(tool_call_state["db_tool_call_id"]),
                            new_raw,
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
                        sql_create_message = load_sql(
                            "sql/v3/simulations/create_message.sql"
                        )
                        assistant_message_row = await conn.fetchrow(
                            sql_create_message, "assistant", "", False, None
                        )
                        db_message_id = assistant_message_row["id"]
                        assistant_created_at = assistant_message_row["created_at"]
                        tool_call_state["db_message_id"] = db_message_id

                        # Ensure assistant message created_at is after latest user message
                        # This fixes ordering issues in voice mode where messages are created concurrently
                        latest_user_message_row = await conn.fetchrow(
                            """
                            SELECT m.created_at
                            FROM messages m
                            JOIN message_runs mr ON mr.message_id = m.id
                            JOIN runs r ON r.id = mr.run_id
                            JOIN group_runs gr ON gr.run_id = r.id
                            JOIN groups g ON g.id = gr.group_id
                            JOIN chats c ON c.group_id = g.id
                            WHERE c.id = $1::uuid
                              AND m.role = 'user'
                              AND m.id != $2::uuid
                            ORDER BY m.created_at DESC
                            LIMIT 1
                            """,
                            chat_id_uuid,
                            db_message_id,
                        )

                        if latest_user_message_row:
                            user_created_at = latest_user_message_row["created_at"]
                            # If user message was created after or very close to assistant message,
                            # update assistant message created_at to be after user message
                            # Use 1ms offset to ensure proper ordering
                            if user_created_at >= assistant_created_at:
                                await conn.execute(
                                    """
                                    UPDATE messages
                                    SET created_at = $1::timestamp + INTERVAL '1 millisecond'
                                    WHERE id = $2::uuid
                                    """,
                                    user_created_at,
                                    db_message_id,
                                )
                                # Fetch updated created_at for emission
                                updated_row = await conn.fetchrow(
                                    "SELECT created_at FROM messages WHERE id = $1::uuid",
                                    db_message_id,
                                )
                                if updated_row:
                                    assistant_created_at = updated_row["created_at"]
                                logger.info(
                                    f"Updated assistant message {db_message_id} created_at to be after "
                                    f"user message {user_created_at} to ensure proper ordering"
                                )

                        # Link message to run if run_id exists
                        if tool_call_state.get("run_id"):
                            sql_link = load_sql(
                                "sql/v3/simulations/link_message_to_run.sql"
                            )
                            await conn.execute(
                                sql_link,
                                str(db_message_id),
                                str(tool_call_state["run_id"]),
                            )

                        # Link to persona if we have it
                        if tool_call_state["persona_so_far"]:
                            persona_match = find_persona_by_name(
                                tool_call_state["persona_so_far"],
                                tool_call_state["personas"],
                            )
                            if persona_match:
                                persona_id, _ = persona_match
                                sql_link_persona = load_sql(
                                    "sql/v3/simulations/link_message_to_persona.sql"
                                )
                                try:
                                    await conn.execute(
                                        sql_link_persona,
                                        str(db_message_id),
                                        str(persona_id),
                                    )
                                except Exception as link_err:
                                    logger.warning(
                                        f"Failed to link message to persona: {link_err}"
                                    )

                        # Create branch from latest message (which may be user or assistant)
                        # This ensures sequential branching: User1 -> Assistant1 -> Assistant2
                        # Query finds message with no active children, excluding current message
                        latest_message_row = await conn.fetchrow(
                            """
                            SELECT m.id
                            FROM messages m
                            JOIN message_runs mr ON mr.message_id = m.id
                            JOIN runs r ON r.id = mr.run_id
                            JOIN group_runs gr ON gr.run_id = r.id
                            JOIN groups g ON g.id = gr.group_id
                            JOIN chats c ON c.group_id = g.id
                            WHERE c.id = $1::uuid
                              AND m.id != $2::uuid
                              AND NOT EXISTS (
                                  SELECT 1 FROM message_tree mt 
                                  WHERE mt.parent_id = m.id AND mt.active = true
                              )
                            ORDER BY m.created_at DESC
                            LIMIT 1
                            """,
                            chat_id_uuid,
                            db_message_id,
                        )

                        # Use latest message as parent (ensures sequential branching),
                        # fallback to original parent_message_id
                        parent_id_str = None
                        if latest_message_row and latest_message_row.get("id"):
                            parent_id_str = str(latest_message_row["id"])
                        elif tool_call_state["parent_message_id"]:
                            parent_id_str = str(tool_call_state["parent_message_id"])

                        if parent_id_str:
                            assistant_id_str = str(db_message_id)
                            if parent_id_str != assistant_id_str:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch, parent_id_str, assistant_id_str
                                )
                                logger.info(
                                    f"Created branch from message {parent_id_str} to assistant message {assistant_id_str}"
                                )

                        # Emit new message event
                        persona_id_str = None
                        if tool_call_state["persona_so_far"]:
                            persona_match = find_persona_by_name(
                                tool_call_state["persona_so_far"],
                                tool_call_state["personas"],
                            )
                            if persona_match:
                                persona_id_str = str(persona_match[0])

                        await simulation_new_message(
                            SimulationNewMessagePayload(
                                message_id=str(db_message_id),
                                chat_id=chat_id_str,
                                role="assistant",
                                content="",
                                completed=False,
                                created_at=assistant_created_at.isoformat(),
                                persona_id=persona_id_str,
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )

                    # Update DB with accumulated content
                    sql_update = load_sql(
                        "sql/v3/simulations/update_message_content.sql"
                    )
                    await conn.execute(
                        sql_update,
                        tool_call_state["message_so_far"],
                        str(tool_call_state["db_message_id"]),
                    )

                    # Emit token event
                    await simulation_message_token(
                        SimulationMessageTokenPayload(
                            message_id=str(tool_call_state["db_message_id"]),
                            chat_id=chat_id_str,
                            token=new_message_chars,
                            accumulated_content=tool_call_state["message_so_far"],
                        ),
                        room=f"simulation_{chat_id_uuid}",
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
