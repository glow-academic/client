"""Handler for simulation_voice_assistant_done WebSocket event."""

import asyncio
import json
import uuid
from typing import Any

from app.main import (_voice_message_ids, get_pool,
                      get_simulation_tool_calls_dict,
                      get_simulation_tool_calls_locks, sio)
from app.socket.v3.simulations.text.send import (
    SimulationMessageCompletePayload, SimulationNewMessagePayload,
    simulation_message_complete, simulation_new_message)
from app.utils.agents.tools.create_persona_tools import find_persona_by_name
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceToolCallDonePayload(BaseModel):
    """Client-to-server payload for simulation_voice_assistant_done."""

    chat_id: str
    call_id: str
    item_id: str
    arguments: str  # Complete JSON string
    response_id: str


class VoiceToolCallErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


# Emit helper functions
async def voice_tool_call_error(payload: VoiceToolCallErrorPayload, room: str) -> None:
    await sio.emit("voice_tool_call_error", payload.model_dump(), room=room)


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

                # Normalize persona name
                persona_name_normalized = persona_name.strip() if persona_name else ""

                # Look up persona_id from persona name
                persona_match = find_persona_by_name(persona_name_normalized, personas)

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
                    sql_create_message = load_sql(
                        "sql/v3/simulations/create_message.sql"
                    )
                    assistant_message_row = await conn.fetchrow(
                        sql_create_message, "assistant", "", False, None
                    )
                    db_message_id = assistant_message_row["id"]
                    tool_call_state["db_message_id"] = db_message_id

                    # Get run_id from chat_runs (voice mode pattern - same as user_message.py)
                    latest_run_row = await conn.fetchrow(
                        """
                        SELECT rc.run_id::text as run_id
                        FROM chat_runs rc
                        JOIN runs r ON r.id = rc.run_id
                        WHERE rc.chat_id = $1::uuid
                        ORDER BY r.created_at DESC
                        LIMIT 1
                        """,
                        str(chat_id_uuid),
                    )
                    run_id = latest_run_row["run_id"] if latest_run_row else None

                    # Link message to run if run_id exists
                    if run_id:
                        sql_link = load_sql(
                            "sql/v3/simulations/link_message_to_run.sql"
                        )
                        await conn.execute(sql_link, str(db_message_id), str(run_id))

                    # Link to persona
                    sql_link_persona = load_sql(
                        "sql/v3/simulations/link_message_to_persona.sql"
                    )
                    try:
                        await conn.execute(
                            sql_link_persona, str(db_message_id), persona_id
                        )
                    except Exception as link_err:
                        logger.warning(f"Failed to link message to persona: {link_err}")

                    # Create branch from latest message (which may be user or assistant)
                    # This ensures sequential branching: User1 -> Assistant1 -> Assistant2
                    # Query finds message with no active children, excluding current message
                    latest_message_row = await conn.fetchrow(
                        """
                        SELECT m.id
                        FROM messages m
                        JOIN message_runs mr ON mr.message_id = m.id
                        JOIN chat_runs cr ON cr.run_id = mr.run_id
                        WHERE cr.chat_id = $1::uuid
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

                    # Emit new message event FIRST (before completing) to match simulation mode
                    await simulation_new_message(
                        SimulationNewMessagePayload(
                            message_id=str(db_message_id),
                            chat_id=chat_id_str,
                            role="assistant",
                            content="",  # Empty initially, will be updated
                            completed=False,
                            created_at=assistant_message_row["created_at"].isoformat(),
                            persona_id=persona_id,
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                db_message_id = tool_call_state["db_message_id"]

                # Use final message content (may be more complete than accumulated)
                final_content = message_content.strip()

                # Update message in database with final content
                sql_update = load_sql("sql/v3/simulations/update_message_content.sql")
                await conn.execute(sql_update, final_content, str(db_message_id))

                # Complete message
                sql_complete = load_sql("sql/v3/simulations/complete_message.sql")
                await conn.execute(sql_complete, final_content, str(db_message_id))

                # Add message ID to accumulator for voice_response_done handler
                if chat_id_str not in _voice_message_ids:
                    _voice_message_ids[chat_id_str] = []
                if str(db_message_id) not in _voice_message_ids[chat_id_str]:
                    _voice_message_ids[chat_id_str].append(str(db_message_id))

                # Emit completion event
                await simulation_message_complete(
                    SimulationMessageCompletePayload(
                        message_id=str(db_message_id),
                        chat_id=chat_id_str,
                        final_content=final_content,
                    ),
                    room=f"simulation_{chat_id_uuid}",
                )

                # Emit updated message with completed=True
                # Get created_at from database
                message_row = await conn.fetchrow(
                    "SELECT created_at FROM messages WHERE id = $1::uuid", db_message_id
                )
                created_at_iso = (
                    message_row["created_at"].isoformat()
                    if message_row and message_row.get("created_at")
                    else ""
                )

                await simulation_new_message(
                    SimulationNewMessagePayload(
                        message_id=str(db_message_id),
                        chat_id=chat_id_str,
                        role="assistant",
                        content=final_content,
                        completed=True,
                        created_at=created_at_iso,
                        persona_id=persona_id,
                    ),
                    room=f"simulation_{chat_id_uuid}",
                )

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
