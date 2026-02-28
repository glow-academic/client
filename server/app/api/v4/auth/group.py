"""Resolve group_id endpoint — looks up draft group_id or creates a new one."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.api.v4.auth.types import ResolveGroupApiRequest, ResolveGroupApiResponse
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_pool

router = APIRouter()

# Mapping from artifact_type to its drafts_entry table name
_DRAFT_TABLE_MAP: dict[str, str] = {
    "agent": "agent_drafts_entry",
    "cohort": "cohort_drafts_entry",
    "department": "department_drafts_entry",
    "document": "document_drafts_entry",
    "eval": "eval_drafts_entry",
    "field": "field_drafts_entry",
    "model": "model_drafts_entry",
    "parameter": "parameter_drafts_entry",
    "persona": "persona_drafts_entry",
    "profile": "profile_drafts_entry",
    "provider": "provider_drafts_entry",
    "rubric": "rubric_drafts_entry",
    "scenario": "scenario_drafts_entry",
    "setting": "setting_drafts_entry",
    "simulation": "simulation_drafts_entry",
    "tool": "tool_drafts_entry",
    "chat": "chat_drafts_entry",
    "auth": "auth_drafts_entry",
}

# All known draft entry tables (for UNION lookup when artifact_type unknown)
_ALL_DRAFT_TABLES = list(_DRAFT_TABLE_MAP.values())


@router.post("/group", response_model=ResolveGroupApiResponse)
async def resolve_group(
    request: ResolveGroupApiRequest,
    http_request: Request,
) -> ResolveGroupApiResponse:
    """Resolve a group_id: look up from draft if available, otherwise create new."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        group_id = None

        # Try to find group_id from an existing draft
        if request.draft_id is not None:
            async with pool.acquire() as conn:
                if request.artifact_type and request.artifact_type in _DRAFT_TABLE_MAP:
                    # Narrow lookup: query the specific draft table
                    table = _DRAFT_TABLE_MAP[request.artifact_type]
                    group_id = await conn.fetchval(
                        f"SELECT group_id FROM {table} WHERE id = $1",  # noqa: S608
                        request.draft_id,
                    )
                else:
                    # Broad lookup: try all draft tables via UNION
                    parts = [
                        f"SELECT group_id FROM {t} WHERE id = $1"
                        for t in _ALL_DRAFT_TABLES
                    ]
                    union_query = " UNION ALL ".join(parts) + " LIMIT 1"
                    group_id = await conn.fetchval(union_query, request.draft_id)

        # If no group_id found (no draft, or draft has no group), create a new one
        if not group_id:
            async with pool.acquire() as conn:
                group_id = await conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) "
                    "VALUES (NOW(), NOW()) RETURNING id"
                )

        return ResolveGroupApiResponse(group_id=str(group_id))

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="resolve_group",
            request=http_request,
        )
