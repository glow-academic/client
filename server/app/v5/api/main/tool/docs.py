"""Tool artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.v5.api.resources.names.get import get_names_internal
from app.v5.infra.globals import get_db
from app.v5.sql.types import GetToolDocsSqlParams, GetToolDocsSqlRow
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/tools/get_tool_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="tool",
    plural_name="tools",
    table_name="tool_artifact",
    junction_prefix="tool",
    fk_pattern="tool_%",
    api_routing={
        "base_path": "/api/v5/artifacts/tools",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single tool by ID",
                "request_model": "GetToolApiRequest",
                "response_model": "GetToolApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a tool",
                "request_model": "SaveToolApiRequest",
                "response_model": "SaveToolApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List tools with optional filters",
                "request_model": "GetToolsListApiRequest",
                "response_model": "GetToolsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing tool",
                "request_model": "DuplicateToolApiRequest",
                "response_model": "DuplicateToolApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a tool",
                "request_model": "DeleteToolApiRequest",
                "response_model": "DeleteToolApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a tool draft (autosave)",
                "request_model": "PatchToolDraftApiRequest",
                "response_model": "PatchToolDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Tools represent extensions to agent capabilities used in GLOW. They can be assigned to agents and include schemas and templates.",
        "use_cases": [
            "Extending agent capabilities",
            "Defining tool schemas and templates",
            "Assigning tools to agents",
        ],
        "related_concepts": [
            "Agents - Tools can be assigned to agents",
            "Schemas - Tools include schemas for structure",
            "Templates - Tools include templates for formatting",
            "Resources - Tools use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Tools",
        list_description="Manage tools for teaching assistant training platform. Configure and organize tools for enhanced functionality.",
        detail_title="Tool",
        detail_description="View and edit tool details for teaching assistant training platform.",
        new_title="Create Tool",
        new_description="Create a new tool for teaching assistant training platform.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_tool_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetToolDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetToolDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_tools_docs() -> dict[str, Any]:
    """Get tool documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
