"""Cohort artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.v5.api.main.cohort import permissions
from app.v5.api.resources.names.get import get_names_internal
from app.main import get_db
from app.v5.sql.types import GetCohortDocsSqlParams, GetCohortDocsSqlRow
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/cohorts/get_cohort_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="cohort",
    plural_name="cohorts",
    table_name="cohort_artifact",
    junction_prefix="cohort",
    fk_pattern="cohort_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_draft",
        "has_access",
    ],
    api_routing={
        "base_path": "/api/v5/cohorts",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single cohort by ID",
                "request_model": "GetCohortApiRequest",
                "response_model": "GetCohortApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a cohort",
                "request_model": "SaveCohortApiRequest",
                "response_model": "SaveCohortApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List cohorts with optional filters",
                "request_model": "GetCohortsListApiRequest",
                "response_model": "GetCohortsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing cohort",
                "request_model": "DuplicateCohortApiRequest",
                "response_model": "DuplicateCohortApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a cohort",
                "request_model": "DeleteCohortApiRequest",
                "response_model": "DeleteCohortApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a cohort draft (autosave)",
                "request_model": "PatchCohortDraftApiRequest",
                "response_model": "PatchCohortDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Cohorts represent groups of users or entities used in GLOW for organizational purposes.",
        "use_cases": [
            "Grouping users for organizational purposes",
            "Organizing entities by department",
            "Managing cohort-based access and permissions",
        ],
        "related_concepts": [
            "Departments - Cohorts can be associated with departments",
            "Resources - Cohorts use multiple resource types (names, descriptions, flags) for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Cohorts",
        list_description="Manage learning cohorts for teaching assistant training programs. Organize groups of teaching assistants, track cohort progress, and coordinate group-based learning activities for effective L&D program administration.",
        detail_title="Cohort",
        detail_description="Edit learning cohort for teaching assistant training programs. Manage group settings and coordinate group-based learning activities for effective L&D program administration.",
        new_title="New Cohort",
        new_description="Create a new learning cohort for teaching assistant training programs. Organize groups of teaching assistants, configure cohort settings, and set up group-based learning activities for effective L&D program administration.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_cohort_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetCohortDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetCohortDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_cohorts_docs() -> dict[str, Any]:
    """Get cohort documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
