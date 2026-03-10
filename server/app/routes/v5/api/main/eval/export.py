"""Eval export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.eval.export import export_eval_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.eval.types import ExportEvalApiResponse

router = APIRouter()


class ExportEvalApiRequest(BaseModel):
    """Request model for eval export."""

    eval_id: UUID | None = None


@router.post("/export", response_model=ExportEvalApiResponse)
async def export_evals(
    body: ExportEvalApiRequest,
    http_request: Request,
    response: Response,
) -> ExportEvalApiResponse:
    """Export all evals as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportEvalApiResponse:
        return await export_eval_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            eval_id=body.eval_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="eval",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportEvalApiResponse,
        runner=_runner,
    )
