"""Handler for document_tool_title_eval_start WebSocket event - eval-specific logic for title tool."""

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


class DocumentTitleEvalStartPayload(BaseModel):
    """Request to execute title tool for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    tool_id: str
    use_groups: bool = False


class DocumentTitleEvalCompletePayload(BaseModel):
    """Response indicating title eval completed."""

    test_id: str
    tool_id: str
    success: bool
    message: str | None = None


async def _document_tool_title_eval_start_impl(
    sid: str, data: DocumentTitleEvalStartPayload
) -> None:
    """Handle document_tool_title_eval_start requests via WebSocket."""
    try:
        logger.info(
            f"Received document_tool_title_eval_start request from {sid} with data: {data}"
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
                "document_tool_title_eval_complete",
                DocumentTitleEvalCompletePayload(
                    test_id=test_id,
                    tool_id=tool_id,
                    success=True,
                    message="Title eval completed",
                ),
                sid=sid,
            )
    except Exception as e:
        logger.error(f"Error in title_eval for {sid}: {str(e)}", exc_info=True)
        await emit_to_internal(
            "document_tool_title_eval_complete",
            DocumentTitleEvalCompletePayload(
                test_id=data.test_id,
                tool_id=data.tool_id,
                success=False,
                message=str(e),
            ),
            sid=sid,
        )


@internal_sio.on("document_tool_title_eval_start")  # type: ignore
async def title_eval_internal(data: dict[str, Any]) -> None:
    """Handle document_tool_title_eval_start event from internal bus."""
    try:
        validated = DocumentTitleEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _document_tool_title_eval_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in title_eval_internal: {e}")


@server_router.post("/eval", response_model=dict[str, bool])
async def title_eval_api(request: DocumentTitleEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute title tool for eval."""
    return {"success": True}
