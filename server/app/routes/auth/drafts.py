"""Drafts endpoint — returns drafts for the current page's artifact type."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.routes.auth.route_permissions import compute_page_metadata
from app.routes.auth.types import GetDraftsApiResponse, QGetProfileContextV4Draft
from app.routes.v5.api.entries.agent_drafts.get import get_agent_drafts_entries_internal
from app.routes.v5.api.entries.auth_drafts.get import get_auth_drafts_entries_internal
from app.routes.v5.api.entries.cohort_drafts.get import get_cohort_drafts_entries_internal
from app.routes.v5.api.entries.department_drafts.get import (
    get_department_drafts_entries_internal,
)
from app.routes.v5.api.entries.document_drafts.get import get_document_drafts_entries_internal
from app.routes.v5.api.entries.eval_drafts.get import get_eval_drafts_entries_internal
from app.routes.v5.api.entries.field_drafts.get import get_field_drafts_entries_internal
from app.routes.v5.api.entries.model_drafts.get import get_model_drafts_entries_internal
from app.routes.v5.api.entries.parameter_drafts.get import (
    get_parameter_drafts_entries_internal,
)
from app.routes.v5.api.entries.persona_drafts.get import get_persona_drafts_entries_internal
from app.routes.v5.api.entries.profile_drafts.get import get_profile_drafts_entries_internal
from app.routes.v5.api.entries.provider_drafts.get import get_provider_drafts_entries_internal
from app.routes.v5.api.entries.rubric_drafts.get import get_rubric_drafts_entries_internal
from app.routes.v5.api.entries.scenario_drafts.get import get_scenario_drafts_entries_internal
from app.routes.v5.api.entries.setting_drafts.get import get_setting_drafts_entries_internal
from app.routes.v5.api.entries.simulation_drafts.get import (
    get_simulation_drafts_entries_internal,
)
from app.routes.v5.api.entries.tool_drafts.get import get_tool_drafts_entries_internal
from app.routes.v5.api.entries.training_drafts.get import get_training_drafts_entries_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool

router = APIRouter()

# Artifact type → per-artifact draft internal function
_ARTIFACT_INTERNAL_FN = {
    "agent": get_agent_drafts_entries_internal,
    "auth": get_auth_drafts_entries_internal,
    "cohort": get_cohort_drafts_entries_internal,
    "department": get_department_drafts_entries_internal,
    "document": get_document_drafts_entries_internal,
    "eval": get_eval_drafts_entries_internal,
    "field": get_field_drafts_entries_internal,
    "model": get_model_drafts_entries_internal,
    "parameter": get_parameter_drafts_entries_internal,
    "persona": get_persona_drafts_entries_internal,
    "profile": get_profile_drafts_entries_internal,
    "provider": get_provider_drafts_entries_internal,
    "rubric": get_rubric_drafts_entries_internal,
    "scenario": get_scenario_drafts_entries_internal,
    "setting": get_setting_drafts_entries_internal,
    "simulation": get_simulation_drafts_entries_internal,
    "tool": get_tool_drafts_entries_internal,
    "chat": get_training_drafts_entries_internal,
}


def _convert_draft(item: Any, artifact_type: str) -> QGetProfileContextV4Draft:
    """Convert a draft entries item to the API response format."""
    group_id = getattr(item, "group_id", None)
    return QGetProfileContextV4Draft(
        id=item.draft_id,
        artifact_type=artifact_type,
        version=item.version,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
        group_id=str(group_id) if group_id else None,
    )


@router.post("/drafts", response_model=GetDraftsApiResponse)
async def get_drafts(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDraftsApiResponse:
    """Return drafts for the current page's artifact type."""
    try:
        try:
            profile_id_str = http_request.state.profile_id
        except AttributeError:
            profile_id_str = None

        if not profile_id_str:
            return GetDraftsApiResponse(drafts=[])

        profile_id = UUID(profile_id_str)

        pathname = http_request.headers.get("X-Pathname", "")
        metadata = compute_page_metadata(pathname, [])
        artifact_type = metadata.artifact_type
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
        # Both table names are safe — derived from _ARTIFACT_INTERNAL_FN dict (fixed set)
        entry_table = f"{artifact_type}_drafts_entry"
        ownership_table = f"{artifact_type}_drafts_profiles_connection"
        async with pool.acquire() as c:
            draft_id_rows = await c.fetch(
                f"""SELECT pdc.draft_id
                   FROM profile_profiles_junction ppj
                   JOIN {ownership_table} pdc ON pdc.profiles_id = ppj.profiles_id
                   JOIN {entry_table} de ON de.id = pdc.draft_id
                   WHERE ppj.profile_id = $1
                   ORDER BY de.updated_at DESC""",
                profile_id,
            )

        draft_ids: list[UUID] = [row["draft_id"] for row in draft_id_rows]

        if not draft_ids:
            return GetDraftsApiResponse(drafts=[])

        # Fetch full draft data via per-artifact entries internal
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
