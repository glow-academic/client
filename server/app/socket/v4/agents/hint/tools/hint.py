"""Handler for hint tool completion - creates hints in database."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (HintErrorApiRequest, HintHintCompleteApiRequest,
                           HintToolCompleteSqlParams, HintToolCompleteSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/hint_tool_complete_complete.sql"


async def _hint_tool_complete_impl(
    sid: str,
    data: HintHintCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle hint tool completion - parses arguments and creates hints in database."""
    try:
        # Parse tool arguments to extract hint (JSON parsing is necessary for tool arguments)
        final_args: dict[str, Any] = {}
        if data.arguments_raw:
            try:
                final_args = json.loads(data.arguments_raw)
            except json.JSONDecodeError:
                pass
        
        if not final_args and data.final_content:
            try:
                final_args = json.loads(data.final_content)
            except json.JSONDecodeError:
                pass
        
        hint_text = final_args.get("hint", "") if isinstance(final_args, dict) else ""

        if not hint_text or not hint_text.strip():
            # No hint to create, just emit completion
            await sio.emit(
                "hints_progress",
                {
                    "type": "tool_complete",
                    "chat_id": data.resource_id,
                    "tool_name": data.tool_name,
                    "message": "Hint tool called (no hint text provided)",
                },
                room=sid,
            )
            return

        # Get message_id and create hints atomically using consolidated SQL function
        async with get_db_connection() as conn:
            run_id_uuid = uuid.UUID(data.run_id)
            chat_id_uuid = uuid.UUID(data.resource_id)

            # Use double-star pattern - SQL handles both operations atomically
            params = HintToolCompleteSqlParams(
                run_id=run_id_uuid,
                chat_id=chat_id_uuid,
                hint_texts=[hint_text],
            )
            result = cast(
                HintToolCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.message_id:
                not_found_error: HintErrorApiRequest = HintErrorApiRequest(
                    success=False,
                    message="Could not find target message for hint creation",
                    resource_id=data.resource_id,
                    group_id=None,
                )
                await emit_to_internal(
                    "hint_error",
                    not_found_error,
                    sid=sid,
                )
                return

            hints_list = result.hints or []
            if hints_list:
                await sio.emit(
                    "hints_progress",
                    {
                        "type": "tool_complete",
                        "chat_id": data.resource_id,
                        "message_id": str(result.message_id),
                        "tool_name": data.tool_name,
                        "message": "Hint created successfully",
                    },
                    room=sid,
                )

    except Exception as e:
        error_payload: HintErrorApiRequest = HintErrorApiRequest(
            success=False,
            message=f"Failed to finalize hint tool: {str(e)}",
            resource_id=data.resource_id,
            group_id=None,
        )
        await emit_to_internal(
            "hint_error",
            error_payload,
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


register_server_endpoint(  # type: ignore[arg-type]
    server_router,
    "/hint_hint_complete",
    HintHintCompleteApiRequest,
    "Hint tool completed successfully",
)
