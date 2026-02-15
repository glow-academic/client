"""Scenario artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.api.v4.artifacts.scenario import permissions
from app.api.v4.resources.names.get import get_names_internal
from app.main import get_db
from app.sql.types import GetScenarioDocsSqlParams, GetScenarioDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="scenario",
    plural_name="scenarios",
    table_name="scenario_artifact",
    junction_prefix="scenario",
    fk_pattern="scenario_%",
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
        "base_path": "/api/v4/scenarios",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single scenario by ID",
                "request_model": "GetScenarioApiRequest",
                "response_model": "GetScenarioApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a scenario",
                "request_model": "SaveScenarioApiRequest",
                "response_model": "SaveScenarioApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List scenarios with optional filters",
                "request_model": "GetScenariosListApiRequest",
                "response_model": "GetScenariosListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing scenario",
                "request_model": "DuplicateScenarioApiRequest",
                "response_model": "DuplicateScenarioApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a scenario",
                "request_model": "DeleteScenarioApiRequest",
                "response_model": "DeleteScenarioApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a scenario draft (autosave)",
                "request_model": "PatchScenarioDraftApiRequest",
                "response_model": "PatchScenarioDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": (
            "Scenarios represent interactive learning situations used in GLOW for "
            "simulation-based learning. They combine personas, documents, parameters, "
            "and other resources to create rich learning experiences."
        ),
        "use_cases": [
            "Creating interactive learning situations",
            "Combining personas, documents, and parameters",
            "Defining learning objectives and problem statements",
            "Organizing scenarios by department",
        ],
        "related_concepts": [
            "Simulations - Scenarios can be assigned to simulations",
            "Personas - Scenarios can include multiple personas",
            "Documents - Scenarios can include documents",
            "Parameters - Scenarios can include parameters",
            "Resources - Scenarios use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Scenarios",
        list_description="Manage problem-based learning scenarios for teaching assistant training. Create and organize realistic educational challenges and problem statements to practice pedagogical problem-solving and enhance instructional design skills.",
        detail_title="Scenario",
        detail_description="Problem-based learning scenario for teaching assistant training. Practice pedagogical problem-solving and instructional design through realistic educational challenges.",
        new_title="New Scenario",
        new_description="Create a new problem-based learning scenario for teaching assistant training. Design realistic educational challenges and problem statements to practice pedagogical problem-solving and enhance instructional design skills.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_scenario_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetScenarioDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetScenarioDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_scenarios_docs() -> dict[str, Any]:
    """Get scenario documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
