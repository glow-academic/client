"""Handler for hint tool completion - creates hints in database."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (CreateHintsSqlParams, CreateHintsSqlRow,
                           GetHintMessageIdSqlParams, GetHintMessageIdSqlRow,
                           HintHintCompleteApiRequest)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH_CREATE_HINTS = "app/sql/v4/simulations/create_hints_complete.sql"
SQL_PATH_GET_MESSAGE_ID = "app/sql/v4/simulations/get_hint_message_id_complete.sql"
SQL_PATH_HINT_COMPLETE = "app/sql/v4/agents/hint_hint_complete_complete.sql"


async def _hint_tool_complete_impl(
    sid: str,
    data: HintHintCompleteApiRequest,
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
                "hint_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Failed to parse tool arguments",
                    "resource_id": data.resource_id,
                    "group_id": None,
                },
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

        # Get message_id from run_id and chat_id using SQL function
        async with get_db_connection() as conn:
            run_id_uuid = uuid.UUID(data.run_id)
            chat_id_uuid = uuid.UUID(data.resource_id)

            # Get message_id using SQL function
            get_message_params = GetHintMessageIdSqlParams(
                run_id=run_id_uuid,
                chat_id=chat_id_uuid,
            )
            message_result = await execute_sql_typed(conn, SQL_PATH_GET_MESSAGE_ID, params=get_message_params)

            if not message_result:
                await emit_to_internal(
                    "hint_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Could not find target message for hint creation",
                        "resource_id": data.resource_id,
                        "group_id": None,
                    },
                    sid=sid,
                )
                return

            message_result_typed = cast(GetHintMessageIdSqlRow, message_result)
            if not message_result_typed.message_id:
                await emit_to_internal(
                    "hint_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Could not find target message for hint creation",
                        "resource_id": data.resource_id,
                        "group_id": None,
                    },
                    sid=sid,
                )
                return

            message_id = message_result_typed.message_id

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
            "hint_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize hint tool: {str(e)}",
                "resource_id": data.resource_id,
                "group_id": None,
            },
            sid=sid,
        )


@internal_sio.on("hint_hint_complete")  # type: ignore
async def hint_hint_complete_internal(data: dict[str, Any]) -> None:
    """Handle hint_hint_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintHintCompleteApiRequest,
        handler=_hint_tool_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/hint_hint_complete",
    HintHintCompleteApiRequest,
    "Hint tool completed successfully",
)
