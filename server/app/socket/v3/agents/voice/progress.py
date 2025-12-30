"""Handler for simulation_voice_progress WebSocket events - consolidates assistant/delta, assistant/done, assistant/audio."""

import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    get_pool,
    get_simulation_tool_calls_dict,
    get_simulation_tool_calls_locks,
    sio,
)

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Helper functions for incremental JSON parsing (from simulation_text/send.py)
def extract_persona_from_json(json_str: str) -> str | None:
    """Extract persona field from partial JSON string."""
    import re

    match = re.search(r'"persona"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', json_str)
    if match:
        persona_str = match.group(1)
        try:
            return persona_str.encode("utf-8").decode("unicode_escape")
        except Exception:
            return persona_str
    return None


def extract_new_message_chars(
    prev_json: str, new_json: str, last_index: int
) -> tuple[str, int, bool]:
    """Extract new message characters from JSON string incrementally."""
    if len(new_json) <= last_index:
        return "", last_index, False

    message_start_pattern = '"message"'
    message_start_idx = new_json.find(message_start_pattern, 0)
    if message_start_idx == -1:
        return "", last_index, False

    colon_idx = new_json.find(":", message_start_idx)
    if colon_idx == -1:
        return "", last_index, False

    quote_idx = new_json.find('"', colon_idx)
    if quote_idx == -1:
        return "", last_index, False

    message_value_start = quote_idx + 1

    if last_index < message_value_start:
        if len(new_json) > message_value_start:
            start_extracting_from = message_value_start
        elif len(new_json) == message_value_start:
            return "", message_value_start, False
        else:
            return "", last_index, False
    else:
        start_extracting_from = last_index

    new_chars = []
    i = start_extracting_from
    in_message = True
    escape_next = False

    while i < len(new_json):
        char = new_json[i]

        if escape_next:
            new_chars.append(char)
            escape_next = False
            i += 1
            continue

        if char == "\\":
            escape_next = True
            new_chars.append(char)
            i += 1
            continue

        if char == '"' and not escape_next:
            break

        new_chars.append(char)
        i += 1

    new_message = "".join(new_chars)
    return new_message, i, in_message


def sanitize_persona_name(name: str) -> str:
    """Sanitize persona name for matching."""
    sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
    sanitized = sanitized.replace(" ", "_").lower()
    return sanitized or "persona"


def find_persona_by_name_inline(
    persona_name: str, personas: list[dict[str, Any]]
) -> tuple[uuid.UUID, str] | None:
    """Find persona by name (case-insensitive, partial match)."""
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


# Pydantic models
class VoiceAssistantDeltaPayload(BaseModel):
    """Request to send assistant tool call delta in voice simulation."""

    chat_id: str
    call_id: str
    item_id: str
    delta: str
    response_id: str


class VoiceAssistantDonePayload(BaseModel):
    """Request to signal that assistant tool call is done in voice simulation."""

    chat_id: str
    call_id: str
    item_id: str
    arguments: str  # Complete JSON string
    response_id: str


class VoiceAssistantAudioLinkPayload(BaseModel):
    """Request to link audio upload to assistant message."""

    chat_id: str
    message_id: str
    upload_id: str


class VoiceProgressErrorPayload(BaseModel):
    """Response indicating an error occurred in voice progress."""

    success: bool
    message: str


# Client emission functions
async def voice_tool_call_error(
    payload: VoiceProgressErrorPayload, room: str
) -> None:
    await sio.emit(
        "simulations_voice_assistant_tool_call_error", payload.model_dump(), room=room
    )


async def voice_assistant_audio_link_error(
    payload: VoiceProgressErrorPayload, room: str
) -> None:
    await sio.emit(
        "simulations_voice_assistant_audio_link_error",
        payload.model_dump(),
        room=room,
    )


# Client event handlers
@sio.event  # type: ignore
async def simulation_voice_assistant_delta(sid: str, data: dict[str, Any]) -> None:
    """Handle incremental tool call argument delta from Realtime API."""
    try:
        validated = VoiceAssistantDeltaPayload(**data)
        await _simulation_voice_assistant_delta_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_delta for {sid}: {e}"
        )
        await voice_tool_call_error(
            VoiceProgressErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_done(sid: str, data: dict[str, Any]) -> None:
    """Handle tool call completion from Realtime API."""
    try:
        validated = VoiceAssistantDonePayload(**data)
        await _simulation_voice_assistant_done_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_done for {sid}: {e}"
        )
        await voice_tool_call_error(
            VoiceProgressErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_audio_link(
    sid: str, data: dict[str, Any]
) -> None:
    """Handle linking audio upload to assistant message."""
    try:
        validated = VoiceAssistantAudioLinkPayload(**data)
        await _simulation_voice_assistant_audio_link_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_audio_link for {sid}: {e}"
        )
        await voice_assistant_audio_link_error(
            VoiceProgressErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


async def _simulation_voice_assistant_delta_impl(
    sid: str, data: VoiceAssistantDeltaPayload
) -> None:
    """Handle incremental tool call argument delta from Realtime API."""
    try:
        chat_id = data.chat_id
        call_id = data.call_id
        item_id = data.item_id
        delta = data.delta

        if not chat_id or not call_id:
            await voice_tool_call_error(
                VoiceProgressErrorPayload(
                    success=False, message="Missing chat_id or call_id"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        chat_id_str = str(chat_id_uuid)

        # Get tool calls tracking dict and locks
        tool_calls_dict = get_simulation_tool_calls_dict()
        tool_calls_locks = get_simulation_tool_calls_locks()
        if chat_id_str not in tool_calls_dict:
            tool_calls_dict[chat_id_str] = {}
        if chat_id_str not in tool_calls_locks:
            tool_calls_locks[chat_id_str] = {}

        if call_id not in tool_calls_locks[chat_id_str]:
            tool_calls_locks[chat_id_str][call_id] = asyncio.Lock()

        call_lock = tool_calls_locks[chat_id_str][call_id]

        async with call_lock:
            pool = get_pool()
            if not pool:
                logger.error("Database connection pool not available")
                await voice_tool_call_error(
                    VoiceProgressErrorPayload(
                        success=False,
                        message="Database connection pool not available",
                    ),
                    room=sid,
                )
                return

            async with pool.acquire() as conn:
                if chat_id_str not in tool_calls_dict:
                    return

                # Initialize tool call state if needed
                if call_id not in tool_calls_dict[chat_id_str]:
                    # Get run_id
                    sql_get_latest_run = load_sql(
                        "app/sql/v3/simulations/get_latest_run_for_chat.sql"
                    )
                    latest_run_row = await conn.fetchrow(
                        sql_get_latest_run, str(chat_id_uuid)
                    )
                    run_id = latest_run_row["run_id"] if latest_run_row else None

                    # Get personas
                    sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
                    persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
                    personas = [dict(row) for row in persona_rows] if persona_rows else []

                    # Get latest message for parent
                    sql_get_latest_message = load_sql(
                        "app/sql/v3/simulations/get_latest_message.sql"
                    )
                    latest_message_row = await conn.fetchrow(
                        sql_get_latest_message, str(chat_id_uuid)
                    )
                    parent_message_id = (
                        str(latest_message_row["id"])
                        if latest_message_row and latest_message_row.get("id")
                        else None
                    )

                    tool_calls_dict[chat_id_str][call_id] = {
                        "name": "speak",
                        "call_id": call_id,
                        "item_id": item_id,
                        "response_id": data.response_id,
                        "arguments_raw": "",
                        "message_so_far": "",
                        "persona_so_far": None,
                        "db_message_id": None,
                        "db_tool_call_id": None,
                        "last_processed_index": 0,
                        "in_message": False,
                        "parent_message_id": parent_message_id,
                        "run_id": run_id,
                        "personas": personas,
                        "completed": False,
                    }

                tool_call_state = tool_calls_dict[chat_id_str][call_id]

                if tool_call_state.get("completed"):
                    return

                # Append arguments delta
                prev_raw = tool_call_state["arguments_raw"]
                tool_call_state["arguments_raw"] += delta
                new_raw = tool_call_state["arguments_raw"]

                # Extract persona if available
                if not tool_call_state["persona_so_far"]:
                    persona = extract_persona_from_json(new_raw)
                    if persona:
                        tool_call_state["persona_so_far"] = persona

                # Extract new message content incrementally
                (
                    new_message_chars,
                    new_index,
                    in_message,
                ) = extract_new_message_chars(
                    prev_raw, new_raw, tool_call_state["last_processed_index"]
                )
                tool_call_state["last_processed_index"] = new_index
                tool_call_state["in_message"] = in_message

                if new_message_chars:
                    tool_call_state["message_so_far"] += new_message_chars

                # Resolve persona_id
                persona_id_uuid = None
                if tool_call_state["persona_so_far"]:
                    persona_match = find_persona_by_name_inline(
                        tool_call_state["persona_so_far"],
                        tool_call_state["personas"],
                    )
                    if persona_match:
                        persona_id_uuid = persona_match[0]

                # Upsert via SQL
                sql_upsert = load_sql(
                    "app/sql/v3/simulation_voice/voice_progress_upsert_complete.sql"
                )
                result_row = await conn.fetchrow(
                    sql_upsert,
                    str(chat_id_uuid),
                    str(tool_call_state["run_id"]) if tool_call_state.get("run_id") else None,
                    call_id,
                    "speak",
                    new_raw,
                    tool_call_state["message_so_far"],
                    persona_id_uuid,
                    uuid.UUID(tool_call_state["parent_message_id"])
                    if tool_call_state.get("parent_message_id")
                    else None,
                    None,  # upload_id - not provided in delta
                    uuid.UUID(tool_call_state["db_message_id"])
                    if tool_call_state.get("db_message_id")
                    else None,
                    False,  # is_complete - false for delta
                )

                if result_row:
                    message_id = result_row["message_id"]
                    tool_call_id = result_row.get("tool_call_id")
                    if message_id and not tool_call_state.get("db_message_id"):
                        tool_call_state["db_message_id"] = uuid.UUID(message_id)
                    if tool_call_id and not tool_call_state.get("db_tool_call_id"):
                        tool_call_state["db_tool_call_id"] = uuid.UUID(tool_call_id)

                    # Emit token to client (reuse text simulation events)
                    from app.socket.v3.agents.simulation_text.progress import (
                        SimulationMessageTokenPayload,
                        simulation_message_token,
                    )

                    await simulation_message_token(
                        SimulationMessageTokenPayload(
                            message_id=message_id,
                            chat_id=chat_id_str,
                            token=new_message_chars if new_message_chars else "",
                            accumulated_content=tool_call_state["message_so_far"],
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_delta for {sid}: {str(e)}",
            exc_info=True,
        )
        await voice_tool_call_error(
            VoiceProgressErrorPayload(success=False, message=str(e)), room=sid
        )


async def _simulation_voice_assistant_done_impl(
    sid: str, data: VoiceAssistantDonePayload
) -> None:
    """Handle tool call completion from Realtime API."""
    try:
        chat_id = data.chat_id
        call_id = data.call_id

        if not chat_id or not call_id:
            await voice_tool_call_error(
                VoiceProgressErrorPayload(
                    success=False, message="Missing chat_id or call_id"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        chat_id_str = str(chat_id_uuid)

        # Get tool calls tracking dict and locks
        tool_calls_dict = get_simulation_tool_calls_dict()
        tool_calls_locks = get_simulation_tool_calls_locks()
        if chat_id_str not in tool_calls_dict:
            tool_calls_dict[chat_id_str] = {}
        if chat_id_str not in tool_calls_locks:
            tool_calls_locks[chat_id_str] = {}

        if call_id not in tool_calls_locks[chat_id_str]:
            tool_calls_locks[chat_id_str][call_id] = asyncio.Lock()

        call_lock = tool_calls_locks[chat_id_str][call_id]

        async with call_lock:
            pool = get_pool()
            if not pool:
                logger.error("Database connection pool not available")
                await voice_tool_call_error(
                    VoiceProgressErrorPayload(
                        success=False,
                        message="Database connection pool not available",
                    ),
                    room=sid,
                )
                return

            async with pool.acquire() as conn:
                # Parse final arguments
                try:
                    final_args = json.loads(data.arguments)
                    persona_name = final_args.get("persona", "")
                    message_content = final_args.get("message", "")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse final arguments JSON: {e}")
                    await voice_tool_call_error(
                        VoiceProgressErrorPayload(
                            success=False,
                            message=f"Invalid JSON in arguments: {str(e)}",
                        ),
                        room=sid,
                    )
                    return

                if not persona_name or not message_content:
                    await voice_tool_call_error(
                        VoiceProgressErrorPayload(
                            success=False,
                            message="Missing persona or message in arguments",
                        ),
                        room=sid,
                    )
                    return

                # Get tool call state
                if (
                    chat_id_str not in tool_calls_dict
                    or call_id not in tool_calls_dict[chat_id_str]
                ):
                    logger.warning(
                        f"Tool call state not found for call_id={call_id}, chat_id={chat_id_str}"
                    )
                    # Try to process directly
                    sql_get_latest_run = load_sql(
                        "app/sql/v3/simulations/get_latest_run_for_chat.sql"
                    )
                    latest_run_row = await conn.fetchrow(
                        sql_get_latest_run, str(chat_id_uuid)
                    )
                    run_id = latest_run_row["run_id"] if latest_run_row else None

                    sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
                    persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
                    personas = [dict(row) for row in persona_rows] if persona_rows else []

                    persona_match = find_persona_by_name_inline(
                        persona_name.strip(), personas
                    )
                    if not persona_match:
                        await voice_tool_call_error(
                            VoiceProgressErrorPayload(
                                success=False,
                                message=f"Persona '{persona_name}' not found",
                            ),
                            room=sid,
                        )
                        return

                    persona_id_uuid = persona_match[0]

                    # Upsert via SQL
                    sql_upsert = load_sql(
                        "app/sql/v3/simulation_voice/voice_progress_upsert_complete.sql"
                    )
                    result_row = await conn.fetchrow(
                        sql_upsert,
                        str(chat_id_uuid),
                        str(run_id) if run_id else None,
                        call_id,
                        "speak",
                        data.arguments,
                        message_content,
                        persona_id_uuid,
                        None,  # parent_message_id
                        None,  # upload_id
                        None,  # message_id - create new
                        True,  # is_complete
                    )

                    if result_row:
                        message_id = result_row["message_id"]
                        # Emit completion to client
                        from app.socket.v3.agents.simulation_text.complete import (
                            SimulationMessageCompletePayload,
                            simulation_message_complete,
                            simulation_new_message,
                            SimulationNewMessagePayload,
                        )

                        await simulation_message_complete(
                            SimulationMessageCompletePayload(
                                message_id=message_id,
                                chat_id=chat_id_str,
                                final_content=message_content,
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )

                        sql_get_created_at = load_sql(
                            "app/sql/v3/messages/get_message_created_at.sql"
                        )
                        message_row = await conn.fetchrow(
                            sql_get_created_at, uuid.UUID(message_id)
                        )
                        created_at = (
                            message_row["created_at"].isoformat()
                            if message_row and message_row.get("created_at")
                            else ""
                        )

                        await simulation_new_message(
                            SimulationNewMessagePayload(
                                message_id=message_id,
                                chat_id=chat_id_str,
                                role="assistant",
                                content=message_content,
                                completed=True,
                                created_at=created_at,
                                persona_id=str(persona_id_uuid),
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )

                        # Add to voice message IDs accumulator
                        async with _voice_message_ids_lock:
                            if chat_id_str not in _voice_message_ids:
                                _voice_message_ids[chat_id_str] = []
                            if message_id not in _voice_message_ids[chat_id_str]:
                                _voice_message_ids[chat_id_str].append(message_id)

                    return

                tool_call_state = tool_calls_dict[chat_id_str][call_id]
                tool_call_state["completed"] = True

                # Use final message content
                final_content = message_content.strip()

                # Get personas for persona lookup
                sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
                persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
                personas = [dict(row) for row in persona_rows] if persona_rows else []

                persona_match = find_persona_by_name_inline(
                    persona_name.strip(), personas
                )
                if not persona_match:
                    await voice_tool_call_error(
                        VoiceProgressErrorPayload(
                            success=False, message=f"Persona '{persona_name}' not found"
                        ),
                        room=sid,
                    )
                    return

                persona_id_uuid = persona_match[0]

                # Upsert via SQL
                sql_upsert = load_sql(
                    "app/sql/v3/simulation_voice/voice_progress_upsert_complete.sql"
                )
                result_row = await conn.fetchrow(
                    sql_upsert,
                    str(chat_id_uuid),
                    str(tool_call_state["run_id"])
                    if tool_call_state.get("run_id")
                    else None,
                    call_id,
                    "speak",
                    data.arguments,
                    final_content,
                    persona_id_uuid,
                    uuid.UUID(tool_call_state["parent_message_id"])
                    if tool_call_state.get("parent_message_id")
                    else None,
                    None,  # upload_id
                    uuid.UUID(tool_call_state["db_message_id"])
                    if tool_call_state.get("db_message_id")
                    else None,
                    True,  # is_complete
                )

                if result_row:
                    message_id = result_row["message_id"]

                    # Emit completion to client
                    from app.socket.v3.agents.simulation_text.complete import (
                        SimulationMessageCompletePayload,
                        simulation_message_complete,
                        simulation_new_message,
                        SimulationNewMessagePayload,
                    )

                    await simulation_message_complete(
                        SimulationMessageCompletePayload(
                            message_id=message_id,
                            chat_id=chat_id_str,
                            final_content=final_content,
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    sql_get_created_at = load_sql(
                        "app/sql/v3/messages/get_message_created_at.sql"
                    )
                    message_row = await conn.fetchrow(
                        sql_get_created_at, uuid.UUID(message_id)
                    )
                    created_at = (
                        message_row["created_at"].isoformat()
                        if message_row and message_row.get("created_at")
                        else ""
                    )

                    await simulation_new_message(
                        SimulationNewMessagePayload(
                            message_id=message_id,
                            chat_id=chat_id_str,
                            role="assistant",
                            content=final_content,
                            completed=True,
                            created_at=created_at,
                            persona_id=str(persona_id_uuid),
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    # Add to voice message IDs accumulator
                    async with _voice_message_ids_lock:
                        if chat_id_str not in _voice_message_ids:
                            _voice_message_ids[chat_id_str] = []
                        if message_id not in _voice_message_ids[chat_id_str]:
                            _voice_message_ids[chat_id_str].append(message_id)

                # Clean up state
                del tool_calls_dict[chat_id_str][call_id]
                if call_id in tool_calls_locks[chat_id_str]:
                    del tool_calls_locks[chat_id_str][call_id]
                if not tool_calls_dict[chat_id_str]:
                    del tool_calls_dict[chat_id_str]
                if not tool_calls_locks[chat_id_str]:
                    del tool_calls_locks[chat_id_str]

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_done for {sid}: {str(e)}",
            exc_info=True,
        )
        await voice_tool_call_error(
            VoiceProgressErrorPayload(success=False, message=str(e)), room=sid
        )


async def _simulation_voice_assistant_audio_link_impl(
    sid: str, data: VoiceAssistantAudioLinkPayload
) -> None:
    """Handle linking audio upload to assistant message."""
    try:
        chat_id = data.chat_id
        message_id = data.message_id
        upload_id = data.upload_id

        if not chat_id or not message_id or not upload_id:
            await voice_assistant_audio_link_error(
                VoiceProgressErrorPayload(
                    success=False, message="Missing chat_id, message_id, or upload_id"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        message_id_uuid = uuid.UUID(message_id)
        upload_id_uuid = uuid.UUID(upload_id)

        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            await voice_assistant_audio_link_error(
                VoiceProgressErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Validate message belongs to chat
            sql_validate_message = load_sql(
                "app/sql/v3/simulations/validate_message_belongs_to_chat.sql"
            )
            message_row = await conn.fetchrow(
                sql_validate_message, str(chat_id_uuid), str(message_id_uuid)
            )

            if not message_row:
                logger.warning(
                    f"Message {message_id} does not belong to chat {chat_id}"
                )
                await voice_assistant_audio_link_error(
                    VoiceProgressErrorPayload(
                        success=False,
                        message=f"Message {message_id} does not belong to chat {chat_id}",
                    ),
                    room=sid,
                )
                return

            # Validate upload exists
            sql_get_upload = load_sql("app/sql/v3/uploads/get_upload_id.sql")
            upload_row = await conn.fetchrow(sql_get_upload, str(upload_id_uuid))

            if not upload_row:
                logger.warning(f"Upload {upload_id} does not exist")
                await voice_assistant_audio_link_error(
                    VoiceProgressErrorPayload(
                        success=False, message=f"Upload {upload_id} does not exist"
                    ),
                    room=sid,
                )
                return

            # Get run_id for SQL
            sql_get_latest_run = load_sql(
                "app/sql/v3/simulations/get_latest_run_for_chat.sql"
            )
            latest_run_row = await conn.fetchrow(
                sql_get_latest_run, str(chat_id_uuid)
            )
            run_id = latest_run_row["run_id"] if latest_run_row else None

            # Upsert via SQL (with upload_id for audio linking)
            sql_upsert = load_sql(
                "app/sql/v3/simulation_voice/voice_progress_upsert_complete.sql"
            )
            result_row = await conn.fetchrow(
                sql_upsert,
                str(chat_id_uuid),
                str(run_id) if run_id else None,
                None,  # call_id - not provided for audio link
                None,  # tool_name - not provided for audio link
                None,  # arguments_raw - not provided for audio link
                None,  # message_content - not provided for audio link
                None,  # persona_id - not provided for audio link
                None,  # parent_message_id - not provided for audio link
                upload_id_uuid,  # upload_id - provided for audio linking
                message_id_uuid,  # message_id - provided
                False,  # is_complete - false for audio link
            )

            if result_row and result_row.get("upload_linked"):
                logger.info(
                    f"Linked audio upload {upload_id} to assistant message {message_id}"
                )
            else:
                logger.warning(
                    f"Failed to link audio upload {upload_id} to message {message_id}"
                )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_audio_link for {sid}: {str(e)}",
            exc_info=True,
        )
        await voice_assistant_audio_link_error(
            VoiceProgressErrorPayload(success=False, message=str(e)), room=sid
        )


# Debug info handling (moved from debug.py)
class VoiceDebugInfoPayload(BaseModel):
    """Request to send debug info in voice simulation."""

    chat_id: str
    content: str


class VoiceDebugInfoErrorPayload(BaseModel):
    """Response indicating an error occurred while processing debug info."""

    success: bool
    message: str


async def simulation_voice_debug_info_error(
    payload: VoiceDebugInfoErrorPayload, room: str
) -> None:
    await sio.emit("simulations_voice_debug_error", payload.model_dump(), room=room)


async def _simulation_voice_debug_info_impl(
    sid: str, data: VoiceDebugInfoPayload
) -> None:
    """Handle debug_info tool call from Realtime API.

    When debug_info tool is called, save it to the current model run.
    """
    try:
        logger.info(
            f"Received simulation_voice_debug_info from {sid}: chat_id={data.chat_id}, content_length={len(data.content)}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await simulation_voice_debug_info_error(
                VoiceDebugInfoErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        content = data.content
        if not content:
            await simulation_voice_debug_info_error(
                VoiceDebugInfoErrorPayload(success=False, message="Missing content"),
                room=sid,
            )
            return

        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            await simulation_voice_debug_info_error(
                VoiceDebugInfoErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            chat_id_uuid = uuid.UUID(chat_id)

            # Get the latest run for this chat
            sql_get_latest_run = load_sql(
                "app/sql/v3/simulations/get_latest_run_for_chat.sql"
            )
            run_row = await conn.fetchrow(sql_get_latest_run, str(chat_id_uuid))

            if not run_row:
                logger.warning(
                    f"No run found for chat {chat_id}, cannot save debug info"
                )
                # Don't error - just log and return
                return

            run_id = uuid.UUID(run_row["run_id"])

            # Insert debug info
            sql_insert_debug_info = load_sql(
                "app/sql/v3/model_runs/insert_debug_info.sql"
            )
            await conn.execute(sql_insert_debug_info, run_id, content)

            logger.info(
                f"Saved debug info for run {run_id} in chat {chat_id}: {content[:100]}..."
            )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_debug_info for {sid}: {str(e)}", exc_info=True
        )
        await simulation_voice_debug_info_error(
            VoiceDebugInfoErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_voice_debug_info(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceDebugInfoPayload(**data)
        await _simulation_voice_debug_info_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_debug_info for {sid}: {e}")
        await simulation_voice_debug_info_error(
            VoiceDebugInfoErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/debug", response_model=dict[str, bool])
async def simulation_voice_debug_info_api(
    request: VoiceDebugInfoPayload,
) -> dict[str, bool]:
    """Client-to-server event: Send debug information from voice simulation."""
    return {"success": True}


@server_router.post("/debug_error", response_model=dict[str, bool])
async def simulation_voice_debug_info_error_api(
    request: VoiceDebugInfoErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while processing debug info in voice simulation."""
    return {"success": True}


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/delta", response_model=dict[str, bool])
async def simulation_voice_assistant_delta_api(
    request: VoiceAssistantDeltaPayload,
) -> dict[str, bool]:
    """Client-to-server event: Send incremental assistant tool call delta in voice simulation."""
    return {"success": True}


@client_router.post("/done", response_model=dict[str, bool])
async def simulation_voice_assistant_done_api(
    request: VoiceAssistantDonePayload,
) -> dict[str, bool]:
    """Client-to-server event: Signal that assistant tool call is done in voice simulation."""
    return {"success": True}


@client_router.post("/audio_link", response_model=dict[str, bool])
async def simulation_voice_assistant_audio_link_api(
    request: VoiceAssistantAudioLinkPayload,
) -> dict[str, bool]:
    """Client-to-server event: Link audio upload to assistant message."""
    return {"success": True}


@server_router.post("/tool_call_error", response_model=dict[str, bool])
async def voice_tool_call_error_api(
    request: VoiceProgressErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in voice tool call."""
    return {"success": True}


@server_router.post("/audio_link_error", response_model=dict[str, bool])
async def voice_assistant_audio_link_error_api(
    request: VoiceProgressErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred linking audio."""
    return {"success": True}
