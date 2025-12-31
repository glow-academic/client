"""Handler for image_eval_start WebSocket event - eval-specific logic for image agent."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool

logger = get_logger(__name__)
internal_sio = get_internal_sio()

server_router = APIRouter()


class ImageEvalStartPayload(BaseModel):
    """Request to execute image agent for eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str | None = None
    group_id: str | None = None
    agent_id: str
    use_groups: bool = False
    current_cycle: int = 0


class ImageEvalCompletePayload(BaseModel):
    """Response indicating image eval completed."""

    test_id: str
    agent_id: str
    success: bool
    message: str | None = None


async def _image_eval_impl(sid: str, data: ImageEvalStartPayload) -> None:
    """Handle image_eval_start requests via WebSocket."""
    try:
        logger.info(f"Received image_eval_start request from {sid} with data: {data}")
        test_id = data.test_id
        agent_id = data.agent_id
        eval_id = data.eval_id
        run_id = data.run_id
        current_cycle = data.current_cycle
        
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return
        
        async with pool.acquire() as conn:
            test_id_uuid = uuid.UUID(test_id)
            agent_id_uuid = uuid.UUID(agent_id)
            eval_id_uuid = uuid.UUID(eval_id)
            
            # Get eval dynamic flag and rubric_grade_agent info
            eval_row = await conn.fetchrow(
                "SELECT dynamic FROM evals WHERE id = $1::uuid",
                eval_id_uuid,
            )
            dynamic = eval_row.get("dynamic", False) if eval_row else False
            
            # Get rubric_grade_agent to find agent being evaluated
            if dynamic and run_id:
                rga_row = await conn.fetchrow(
                    """
                    SELECT rga.agent_id::text as agent_id, rga.grade_agent_id::text as grade_agent_id
                    FROM rubric_grade_agents rga
                    JOIN eval_runs_rubric_grade_agents errga ON errga.rubric_grade_agent_id = rga.id
                    WHERE errga.eval_id = $1::uuid AND errga.run_id = $2::uuid
                    LIMIT 1
                    """,
                    eval_id_uuid,
                    uuid.UUID(run_id),
                )
                if rga_row:
                    agent_being_evaluated_id = rga_row["agent_id"]
                    # TODO: Get messages exclude last assistant, re-run agent, use output for grading
                    # For now, placeholder
            
            # Non-dynamic mode: Simply emit to agents/grade/generate.py
            # TODO: Implement actual grading agent call
            # For now, placeholder
            
            # Note: Cycle tracking removed - agents execute sequentially
            
            await emit_to_internal(
                "image_eval_complete",
                ImageEvalCompletePayload(test_id=test_id, agent_id=agent_id, success=True, message="Image eval completed"),
                sid=sid,
            )
    except Exception as e:
        logger.error(f"Error in image_eval for {sid}: {str(e)}", exc_info=True)
        await emit_to_internal(
            "image_eval_complete",
            ImageEvalCompletePayload(test_id=data.test_id, agent_id=data.agent_id, success=False, message=str(e)),
            sid=sid,
        )


@internal_sio.on("image_eval_start")  # type: ignore
async def image_eval_internal(data: dict[str, Any]) -> None:
    """Handle image_eval_start event from internal bus."""
    try:
        validated = ImageEvalStartPayload(**data)
        sid = data.get("sid", "internal")
        await _image_eval_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in image_eval_internal: {e}")


@server_router.post("/eval", response_model=dict[str, bool])
async def image_eval_api(request: ImageEvalStartPayload) -> dict[str, bool]:
    """Internal event: Execute image agent for eval."""
    return {"success": True}
