"""Handler for hint tool completion - creates hints in database."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import CreateHintsSqlParams, CreateHintsSqlRow
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH_CREATE_HINTS = "app/sql/v4/simulations/create_hints_complete.sql"


class HintToolCompletePayload(BaseModel):
    """Hint tool complete event payload."""

    sid: str
    resource_id: str  # chat_id for hint agent
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class HintToolErrorPayload(BaseModel):
    """Error response for hint tool."""

    success: bool
    message: str


async def _hint_tool_complete_impl(
    sid: str,
    data: HintToolCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle hint tool completion - parses arguments and creates hints in database."""
    try:
        # Parse tool arguments to extract hint
        try:
            final_args = json.loads(data.arguments_raw) if data.arguments_raw else {}
            if not final_args:
                final_args = json.loads(data.final_content) if data.final_content else {}
            hint_text = final_args.get("hint", "")
        except (json.JSONDecodeError, TypeError):
            await emit_to_internal(
                "hint_hint_error",
                HintToolErrorPayload(
                    success=False,
                    message="Failed to parse tool arguments",
                ),
                sid=sid,
            )
            return

        if not hint_text or not hint_text.strip():
            # No hint to create, just emit completion
            await sio.emit(
                "simulation_hints_progress",
                {
                    "type": "tool_complete",
                    "chat_id": data.resource_id,
                    "tool_name": data.tool_name,
                    "message": "Hint tool called (no hint text provided)",
                },
                room=sid,
            )
            return

        # Get message_id from run_id - query message_runs to get the target message
        # For hint agent, the target message is linked to the run
        async with get_db_connection() as conn:
            # Get message_id from run_id - query for user messages linked to this run
            # For hint agent, we need the target message (user message that triggered hint generation)
            run_id_uuid = uuid.UUID(data.run_id)
            chat_id_uuid = uuid.UUID(data.resource_id)
            
            # Query to get message_id from run_id and chat_id
            # The target message should be a user message in the chat that's linked to this run's group
            query = """
                SELECT DISTINCT m.id as message_id
                FROM message_runs mr
                JOIN messages m ON m.id = mr.message_id
                JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
                JOIN chat_groups cg ON cg.group_id IN (
                    SELECT gr.group_id 
                    FROM group_runs gr 
                    WHERE gr.run_id = $1
                )
                JOIN chats c ON c.id = cg.chat_id
                WHERE mr.run_id = $1
                  AND c.id = $2
                  AND m.role = 'user'::message_role
                ORDER BY m.created_at DESC
                LIMIT 1
            """
            row = await conn.fetchrow(query, run_id_uuid, chat_id_uuid)
            
            if not row or not row.get("message_id"):
                await emit_to_internal(
                    "hint_hint_error",
                    HintToolErrorPayload(
                        success=False,
                        message="Could not find target message for hint creation",
                    ),
                    sid=sid,
                )
                return
            
            message_id = row["message_id"]
            
            # Create hints in database
            create_hints_params = CreateHintsSqlParams(
                message_id=message_id,
                hint_texts=[hint_text],
            )
            create_hints_result = cast(
                CreateHintsSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CREATE_HINTS, params=create_hints_params),
            )
            
            hints_list = create_hints_result.hints or []
            if hints_list:
                await sio.emit(
                    "simulation_hints_progress",
                    {
                        "type": "tool_complete",
                        "chat_id": data.resource_id,
                        "message_id": str(message_id),
                        "tool_name": data.tool_name,
                        "message": "Hint created successfully",
                    },
                    room=sid,
                )

    except Exception as e:
        await emit_to_internal(
            "hint_hint_error",
            HintToolErrorPayload(
                success=False,
                message=f"Failed to finalize hint tool: {str(e)}",
            ),
            sid=sid,
        )


@internal_sio.on("hint_hint_complete")  # type: ignore
async def hint_hint_complete_internal(data: dict[str, Any]) -> None:
    """Handle hint_hint_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintToolCompletePayload,
        handler=_hint_tool_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_hint_error",
        error_response_type=HintToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_hint_complete",
    HintToolCompletePayload,
    "Hint tool completed successfully",
)

