"""Field artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.v5.api.resources.names.get import get_names_internal
from app.v5.infra.globals import get_db
from app.v5.sql.types import GetFieldDocsSqlParams, GetFieldDocsSqlRow
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/fields/get_field_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="field",
    plural_name="fields",
    table_name="field_artifact",
    junction_prefix="field",
    fk_pattern="field_%",
    api_routing={
        "base_path": "/api/v5/fields",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single field by ID",
                "request_model": "GetFieldApiRequest",
                "response_model": "GetFieldApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a field",
                "request_model": "SaveFieldApiRequest",
                "response_model": "SaveFieldApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List fields with optional filters",
                "request_model": "GetFieldsListApiRequest",
                "response_model": "ListFieldApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing field",
                "request_model": "DuplicateFieldApiRequest",
                "response_model": "DuplicateFieldApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a field",
                "request_model": "DeleteFieldApiRequest",
                "response_model": "DeleteFieldApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a field draft (autosave)",
                "request_model": "PatchFieldDraftApiRequest",
                "response_model": "PatchFieldDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Fields represent custom data fields used in GLOW to extend personas and scenarios with additional structured data.",
        "use_cases": [
            "Defining custom data fields for personas",
            "Adding structured data to scenarios",
            "Organizing fields by department",
        ],
        "related_concepts": [
            "Personas - Fields can be assigned to personas",
            "Scenarios - Fields can be assigned to scenarios",
            "Resources - Fields use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Fields",
        list_description="Manage custom fields and data configuration for teaching assistant training platform. Configure custom field definitions to track additional educational data, assessment criteria, and learning metrics for comprehensive L&D program management.",
        detail_title="Field",
        detail_description="Custom field configuration for teaching assistant training platform. Manage field definitions to track additional educational data, assessment criteria, and learning metrics.",
        new_title="Create Field",
        new_description="Create a new custom field for teaching assistant training platform. Define custom field configurations to track additional educational data, assessment criteria, and learning metrics for comprehensive L&D program management.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_field_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetFieldDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetFieldDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_fields_docs() -> dict[str, Any]:
    """Get field documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
