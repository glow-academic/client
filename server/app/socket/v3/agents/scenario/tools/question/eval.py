"""Handler for question_eval_start WebSocket event - eval-specific logic for question tool."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool

logger = get_logger(__name__)
internal_sio = get_internal_sio()

server_router = APIRouter()


class QuestionEvalStartPayload(BaseModel):
    """Request to execute question tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class QuestionEvalCompletePayload(BaseModel):
    """Response indicating question eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _question_eval_impl(sid: str, data: QuestionEvalStartPayload) -> None:
    """Handle question_eval_start requests via WebSocket."""
    try:
        logger.info(
            f"Received question_eval_start request from {sid} with data: {data}"
        )
        test_id = data.test_id
        tool_id = data.tool_id
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return
        async with pool.acquire() as conn:
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
                    logger.info(f"Marked tool {tool_id} as called for test {test_id}")
            await emit_to_internal(
                "question_eval_complete",
                QuestionEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Question eval completed",
                ),
                sid=sid,
            )
    except Exception as e:
        logger.error(f"Error in question_eval for {sid}: {str(e)}", exc_info=True)
        await emit_to_internal(
            "question_eval_complete",
            QuestionEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("question_eval_start")  # type: ignore
async def question_eval_internal(data: dict[str, Any]) -> None:
    """Handle question_eval_start event from internal bus."""
    try:
        validated = QuestionEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _question_eval_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in question_eval_internal: {e}")


@server_router.post("/eval", response_model=dict[str, bool])
async def question_eval_api(request: QuestionEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute question tool for eval."""
    return {"success": True}
