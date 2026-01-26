"""Simulation completion handler - listens to generate_*_complete events and emits simulation-specific events."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_complete")  # type: ignore
@internal_sio.on("generate_audio_complete")  # type: ignore
@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_simulations_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete internal events - filter by simulation artifact_type and voice resource_type."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "simulation":
        return  # Not for us

    resource_type = data.get("resource_type")
    modality = data.get("modality")
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client
    
    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    
    # Extract completion data
    chat_id = data.get("chat_id") or data.get("group_id")
    run_id = data.get("run_id")
    completion_type = data.get("event_type") or data.get("type")
    message_id = data.get("message_id")

    if modality in ("text", "call") and resource_type == "simulation":
        if completion_type == "run_complete" and message_id and chat_id:
            async with get_db_connection() as conn:
                is_general_sql = load_sql(
                    "app/sql/v4/queries/attempts/general/is_general_chat_complete.sql"
                )
                is_general_row = await conn.fetchrow(is_general_sql, uuid.UUID(chat_id))
                is_general = bool(is_general_row["is_general"]) if is_general_row else False
                sql_path = (
                    "app/sql/v4/queries/attempts/general/complete_assistant_message_complete.sql"
                    if is_general
                    else "app/sql/v4/queries/attempts/practice/complete_assistant_message_complete.sql"
                )
                sql = load_sql(sql_path)
                await conn.fetchrow(
                    sql,
                    uuid.UUID(message_id),
                    data.get("assistant_output"),
                    data.get("input_text_tokens") or 0,
                    data.get("output_text_tokens") or 0,
                )
        await sio.emit(
            "simulation_text_run_complete",
            {
                "chat_id": chat_id,
                "run_id": run_id,
                "message_id": message_id,
                "type": completion_type,
                "success": True,
            },
            room=sid,
        )
        return

    if modality != "audio" or resource_type != "voice":
        return  # Not for us

    # Emit completion event to client
    await sio.emit(
        "simulation_voice_complete",
        {
            "chat_id": chat_id,
            "run_id": run_id,
            "type": completion_type,
            "success": True,
            "message_id": message_id,
        },
        room=sid,
    )
