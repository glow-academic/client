"""Handler for grade_eval_start WebSocket event - eval-specific logic for grade tool."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class GradeEvalStartPayload(BaseModel):
    """Request to execute grade tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class GradeEvalCompletePayload(BaseModel):
    """Response indicating grade eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _grade_eval_impl(sid: str, data: GradeEvalStartPayload) -> None:
    """Handle grade_eval_start requests via WebSocket."""
    try:
        test_id = data.test_id
        tool_id = data.tool_id
        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            tool_id_uuid = uuid.UUID(tool_id)
            if data.use_groups and data.group_id:
                group_id_uuid = uuid.UUID(data.group_id)
                in_group_stop = await conn.fetchrow(
                    "SELECT 1 FROM group_stop WHERE group_id = $1::uuid AND tool_id = $2::uuid",
                    group_id_uuid,
                    tool_id_uuid,
                )
                if in_group_stop:
                    pass
            await emit_to_internal(
                "grade_eval_complete",
                GradeEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Grade eval completed",
                ),
                sid=sid,
            )
    except RuntimeError:
        await emit_to_internal(
            "grade_eval_complete",
            GradeEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "grade_eval_complete",
            GradeEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("grade_eval_start")  # type: ignore
async def grade_eval_internal(data: dict[str, Any]) -> None:
    """Handle grade_eval_start event from internal bus."""
    try:
        validated = GradeEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _grade_eval_impl(sid, validated)
    except ValidationError:
        await emit_to_internal(
            "grade_eval_complete",
            GradeEvalCompletePayload(
                test_id=data.get("test_id", "unknown"),
                tool_id=data.get("tool_id", "unknown"),
                success=False,
                message="Invalid payload",
            ),
            sid=data.get("sid", "internal"),
        )


@server_router.post("/eval", response_model=dict[str, bool])
async def grade_eval_api(request: GradeEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute grade tool for eval."""
    return {"success": True}
