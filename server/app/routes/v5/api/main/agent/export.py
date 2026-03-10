"""Agent export endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.agent.export import export_agent_impl
from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.agent.types import (
    ExportAgentApiRequest,
    ExportAgentApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportAgentApiResponse)
async def export_agents(
    body: ExportAgentApiRequest,
    http_request: Request,
    response: Response,
) -> ExportAgentApiResponse:
    """Export all agents as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportAgentApiResponse:
        return await export_agent_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            agent_id=body.agent_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="agent",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportAgentApiResponse,
        runner=_runner,
    )
