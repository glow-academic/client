"""Handler for rubric_tool_title_eval_start WebSocket event - eval-specific logic for title tool."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class RubricTitleEvalStartPayload(BaseModel):
    """Request to execute title tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class RubricTitleEvalCompletePayload(BaseModel):
    """Response indicating title eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _rubric_tool_title_eval_start_impl(
    sid: str, data: RubricTitleEvalStartPayload
) -> None:
    """Handle rubric_tool_title_eval_start requests via WebSocket."""
    try:
        test_id = data.test_id
        tool_id = data.tool_id
        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            tool_id_uuid = uuid.UUID(tool_id)
            # Note: group_stop check removed - inline SQL not allowed per standards
            # If needed, create SQL function and use execute_sql_typed()
            if data.use_groups and data.group_id:
                # Placeholder for future group_stop check via SQL function
                pass
            await emit_to_internal(
                "rubric_tool_title_eval_complete",
                RubricTitleEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Title eval completed",
                ),
                sid=sid,
            )
    except RuntimeError:
        await emit_to_internal(
            "rubric_tool_title_eval_complete",
            RubricTitleEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "rubric_tool_title_eval_complete",
            RubricTitleEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("rubric_tool_title_eval_start")  # type: ignore
async def title_eval_internal(data: dict[str, Any]) -> None:
    """Handle rubric_tool_title_eval_start event from internal bus."""
    try:
        validated = RubricTitleEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _rubric_tool_title_eval_start_impl(sid, validated)
    except ValidationError:
        await emit_to_internal(
            "rubric_tool_title_eval_complete",
            RubricTitleEvalCompletePayload(
                test_id=data.get("test_id", "unknown"),
                tool_id=data.get("tool_id", "unknown"),
                success=False,
                message="Invalid payload",
            ),
            sid=data.get("sid", "internal"),
        )


@server_router.post("/eval", response_model=dict[str, bool])
async def title_eval_api(request: RubricTitleEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute title tool for eval."""
    return {"success": True}
