"""Handler for classification_eval_start WebSocket event - eval-specific logic for classification tool."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


# Pydantic model for internal event
class ClassificationEvalStartPayload(BaseModel):
    """Request to execute classification tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class ClassificationEvalCompletePayload(BaseModel):
    """Response indicating classification eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _classification_eval_impl(
    sid: str, data: ClassificationEvalStartPayload
) -> None:
    """
    Handle classification_eval_start requests via WebSocket.
    Directly implements classification tool logic for eval context.
    Marks tool as called and emits completion back to benchmark/next.py.
    """
    try:
        test_id = data.test_id
        tool_id = data.tool_id

        async with get_db_connection() as conn:
            test_id_uuid = uuid.UUID(test_id)
            tool_id_uuid = uuid.UUID(tool_id)

            # TODO: Implement classification tool logic directly
            # This should:
            # 1. Get tool context for eval (via eval-specific SQL)
            # 2. Execute classification logic
            # 3. Update eval-specific records (link to test, etc.)
            # For now, this is a placeholder

            # Note: Tool call tracking removed - tools execute sequentially

            # Emit completion back to benchmark/next.py
            await emit_to_internal(
                "classification_eval_complete",
                ClassificationEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Classification eval completed",
                ),
                sid=sid,
            )

    except RuntimeError:
        await emit_to_internal(
            "classification_eval_complete",
            ClassificationEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "classification_eval_complete",
            ClassificationEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("classification_eval_start")  # type: ignore
async def classification_eval_internal(data: dict[str, Any]) -> None:
    """Handle classification_eval_start event from internal bus (server-to-server)."""
    try:
        validated = ClassificationEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _classification_eval_impl(sid, validated)
    except ValidationError:
        await emit_to_internal(
            "classification_eval_complete",
            ClassificationEvalCompletePayload(
                test_id=data.get("test_id", "unknown"),
                tool_id=data.get("tool_id", "unknown"),
                success=False,
                message="Invalid payload",
            ),
            sid=data.get("sid", "internal"),
        )


# FastAPI endpoint for OpenAPI documentation
@server_router.post("/eval", response_model=dict[str, bool])
async def classification_eval_api(
    request: ClassificationEvalStartPayload,
) -> dict[str, bool]:
    """Internal event: Execute classification tool for eval."""
    return {"success": True}
