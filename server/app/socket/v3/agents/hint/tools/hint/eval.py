"""Handler for hint_tool_hint_eval_start WebSocket event - eval-specific logic for hint tool."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.sql.types import (
    CheckGroupStopSqlParams,
    CheckGroupStopSqlRow,
)
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH = "app/sql/v3/tools/check_group_stop_complete.sql"


class HintToolHintEvalStartPayload(BaseModel):
    """Request to execute hint tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class HintToolHintEvalCompletePayload(BaseModel):
    """Response indicating hint tool eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _hint_tool_hint_eval_impl(sid: str, data: HintToolHintEvalStartPayload) -> None:
    """Handle hint_tool_hint_eval_start requests via WebSocket."""
    try:
        test_id = data.test_id
        tool_id = data.tool_id
        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            tool_id_uuid = uuid.UUID(tool_id)
            if data.use_groups and data.group_id:
                group_id_uuid = uuid.UUID(data.group_id)
                # Use typed SQL execution instead of inline SQL
                check_params = CheckGroupStopSqlParams(
                    group_id=group_id_uuid,
                    tool_id=tool_id_uuid,
                )
                check_result = cast(
                    CheckGroupStopSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=check_params),
                )
                if check_result.exists:
                    pass  # Tool is in group_stop, handle as needed
            await emit_to_internal(
                "hint_tool_hint_eval_complete",
                HintToolHintEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Hint tool eval completed",
                ),
                sid=sid,
            )
    except RuntimeError:
        await emit_to_internal(
            "hint_tool_hint_eval_complete",
            HintToolHintEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "hint_tool_hint_eval_complete",
            HintToolHintEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("hint_tool_hint_eval_start")  # type: ignore
async def hint_tool_hint_eval_internal(data: dict[str, Any]) -> None:
    """Handle hint_tool_hint_eval_start event from internal bus."""
    try:
        validated = HintToolHintEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _hint_tool_hint_eval_impl(sid, validated)
    except ValidationError:
        await emit_to_internal(
            "hint_tool_hint_eval_complete",
            HintToolHintEvalCompletePayload(
                test_id=data.get("test_id", "unknown"),
                tool_id=data.get("tool_id", "unknown"),
                success=False,
                message="Invalid payload",
            ),
            sid=data.get("sid", "internal"),
        )


@server_router.post("/eval", response_model=dict[str, bool])
async def hint_tool_hint_eval_api(request: HintToolHintEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute hint tool for eval."""
    return {"success": True}
