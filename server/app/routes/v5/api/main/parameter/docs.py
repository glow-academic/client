"""Parameter artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.routes.v5.api.resources.names.get import get_names_internal
from app.infra.globals import get_db
from app.sql.types import GetParameterDocsSqlParams, GetParameterDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/parameters/get_parameter_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="parameter",
    plural_name="parameters",
    table_name="parameter_artifact",
    junction_prefix="parameter",
    fk_pattern="parameter_%",
    api_routing={
        "base_path": "/api/v5/parameters",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single parameter by ID",
                "request_model": "GetParameterApiRequest",
                "response_model": "GetParameterApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a parameter",
                "request_model": "SaveParameterApiRequest",
                "response_model": "SaveParameterApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List parameters with optional filters",
                "request_model": "GetParametersListApiRequest",
                "response_model": "GetParametersListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing parameter",
                "request_model": "DuplicateParameterApiRequest",
                "response_model": "DuplicateParameterApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a parameter",
                "request_model": "DeleteParameterApiRequest",
                "response_model": "DeleteParameterApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a parameter draft (autosave)",
                "request_model": "PatchParameterDraftApiRequest",
                "response_model": "PatchParameterDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Parameters represent configuration values used in GLOW to customize scenarios with specific personas, documents, and other associations.",
        "use_cases": [
            "Configuring scenarios with specific values",
            "Associating personas and documents with parameters",
            "Organizing parameters by department",
        ],
        "related_concepts": [
            "Scenarios - Parameters can be assigned to scenarios",
            "Personas - Parameters can be associated with personas",
            "Documents - Parameters can be associated with documents",
            "Resources - Parameters use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Parameters",
        list_description="Manage system parameters and configuration settings for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
        detail_title="Parameter",
        detail_description="System parameter configuration for teaching assistant training platform. Manage platform-wide settings and learning environment configurations for effective L&D program administration.",
        new_title="New Parameter",
        new_description="Create a new system parameter for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_parameter_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetParameterDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetParameterDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_parameters_docs() -> dict[str, Any]:
    """Get parameter documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
