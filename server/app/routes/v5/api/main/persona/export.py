"""Persona export endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.infra.persona.audit import run_persona_operation_with_audit
from app.infra.persona.export import export_persona_impl
from app.routes.v5.api.main.persona.types import (
    ExportPersonaApiRequest,
    ExportPersonaApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportPersonaApiResponse)
async def export_personas(
    body: ExportPersonaApiRequest,
    http_request: Request,
    response: Response,
) -> ExportPersonaApiResponse:
    """Export all personas as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportPersonaApiResponse:
        return await export_persona_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            persona_id=body.persona_id,
        )

    return await run_persona_operation_with_audit(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportPersonaApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
