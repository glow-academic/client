"""Simulation artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.infra.globals import get_db
from app.routes.v5.api.main.simulation import permissions
from app.routes.v5.tools.resources.names.get import get_names_internal
from app.sql.types import GetSimulationDocsSqlParams, GetSimulationDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/simulations/get_simulation_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="simulation",
    plural_name="simulations",
    table_name="simulation_artifact",
    junction_prefix="simulation",
    fk_pattern="simulation_%",
    permissions_module=permissions,
    permission_functions=[
        "has_access",
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_draft",
    ],
    api_routing={
        "base_path": "/api/v5/simulations",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single simulation by ID",
                "request_model": "GetSimulationApiRequest",
                "response_model": "GetSimulationApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a simulation",
                "request_model": "SaveSimulationApiRequest",
                "response_model": "SaveSimulationApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List simulations with optional filters",
                "request_model": "GetSimulationsListApiRequest",
                "response_model": "GetSimulationsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing simulation",
                "request_model": "DuplicateSimulationApiRequest",
                "response_model": "DuplicateSimulationApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a simulation",
                "request_model": "DeleteSimulationApiRequest",
                "response_model": "DeleteSimulationApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a simulation draft (autosave)",
                "request_model": "PatchSimulationDraftApiRequest",
                "response_model": "PatchSimulationDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Simulations represent collections of scenarios used in GLOW for comprehensive simulation-based learning experiences.",
        "use_cases": [
            "Creating comprehensive learning experiences",
            "Grouping multiple scenarios together",
            "Organizing simulations by department",
        ],
        "related_concepts": [
            "Scenarios - Simulations contain multiple scenarios",
            "Resources - Simulations use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Simulations",
        list_description="Manage teaching practice simulations for graduate teaching assistant training. Create and organize realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
        detail_title="Simulation",
        detail_description="Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.",
        new_title="New Simulation",
        new_description="Create a new teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_simulation_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetSimulationDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetSimulationDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_simulations_docs() -> dict[str, Any]:
    """Get simulation documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
