"""Drafts endpoint — returns drafts for the current page's artifact type."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.auth.types import GetDraftsApiResponse, QGetProfileContextV4Draft
from app.api.v4.views.drafts.get import (
    get_draft_agent_internal,
    get_draft_auth_internal,
    get_draft_cohort_internal,
    get_draft_department_internal,
    get_draft_document_internal,
    get_draft_eval_internal,
    get_draft_field_internal,
    get_draft_model_internal,
    get_draft_parameter_internal,
    get_draft_persona_internal,
    get_draft_profile_internal,
    get_draft_provider_internal,
    get_draft_rubric_internal,
    get_draft_scenario_internal,
    get_draft_setting_internal,
    get_draft_simulation_internal,
    get_draft_tool_internal,
    get_draft_training_internal,
)
from app.api.v4.views.drafts.types import DraftViewItemBase
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()

# Pathname segment → artifact type (matches drafts_entry.artifact enum)
_PATHNAME_TO_ARTIFACT: dict[str, str] = {
    "personas": "persona",
    "scenarios": "scenario",
    "simulations": "simulation",
    "cohorts": "cohort",
    "agents": "agent",
    "models": "model",
    "providers": "provider",
    "tools": "tool",
    "documents": "document",
    "fields": "field",
    "parameters": "parameter",
    "staff": "profile",
    "settings": "setting",
    "departments": "department",
    "rubrics": "rubric",
    "evals": "eval",
    "auth": "auth",
    "training": "training",
}

# Artifact type → per-artifact draft internal function
_ARTIFACT_INTERNAL_FN = {
    "agent": get_draft_agent_internal,
    "auth": get_draft_auth_internal,
    "cohort": get_draft_cohort_internal,
    "department": get_draft_department_internal,
    "document": get_draft_document_internal,
    "eval": get_draft_eval_internal,
    "field": get_draft_field_internal,
    "model": get_draft_model_internal,
    "parameter": get_draft_parameter_internal,
    "persona": get_draft_persona_internal,
    "profile": get_draft_profile_internal,
    "provider": get_draft_provider_internal,
    "rubric": get_draft_rubric_internal,
    "scenario": get_draft_scenario_internal,
    "setting": get_draft_setting_internal,
    "simulation": get_draft_simulation_internal,
    "tool": get_draft_tool_internal,
    "training": get_draft_training_internal,
}


def _resolve_artifact_type(pathname: str) -> str | None:
    """Parse X-Pathname to determine the artifact type for drafts."""
    parts = [p for p in pathname.strip("/").split("/") if p]
    # Walk segments to find a matching artifact route segment
    for part in parts:
        if part in _PATHNAME_TO_ARTIFACT:
            return _PATHNAME_TO_ARTIFACT[part]
    return None


def _convert_draft(
    item: DraftViewItemBase, artifact_type: str
) -> QGetProfileContextV4Draft:
    """Convert a DraftViewItemBase to the API response format."""
    return QGetProfileContextV4Draft(
        id=item.draft_id,
        artifact_type=artifact_type,
        version=item.version,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


@router.post("/drafts", response_model=GetDraftsApiResponse)
async def get_drafts(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDraftsApiResponse:
    """Return drafts for the current page's artifact type."""
    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        if not profile_id:
            return GetDraftsApiResponse(drafts=[])

        pathname = http_request.headers.get("X-Pathname", "")
        artifact_type = _resolve_artifact_type(pathname)

        if not artifact_type:
            return GetDraftsApiResponse(drafts=[])

        internal_fn = _ARTIFACT_INTERNAL_FN.get(artifact_type)
        if not internal_fn:
            return GetDraftsApiResponse(drafts=[])

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Resolve draft IDs via junction path, filtered by artifact type
        async with pool.acquire() as c:
            draft_id_rows = await c.fetch(
                """SELECT pdc.draft_id
                   FROM profile_profiles_junction ppj
                   JOIN profiles_drafts_connection pdc ON pdc.profiles_id = ppj.profiles_id
                   JOIN drafts_entry de ON de.id = pdc.draft_id
                   WHERE ppj.profile_id = $1
                     AND de.artifact = $2::artifact_type
                   ORDER BY de.updated_at DESC""",
                profile_id,
                artifact_type,
            )

        draft_ids: list[UUID] = [row["draft_id"] for row in draft_id_rows]

        if not draft_ids:
            return GetDraftsApiResponse(drafts=[])

        # Fetch full draft data via per-artifact view internal
        async with pool.acquire() as c:
            draft_items = await internal_fn(c, draft_ids, bypass_cache)

        return GetDraftsApiResponse(
            drafts=[_convert_draft(item, artifact_type) for item in draft_items]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_drafts",
            request=http_request,
        )
