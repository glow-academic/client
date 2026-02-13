"""Agent artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.api.v4.resources.names.get import get_names_internal
from app.main import get_db
from app.sql.types import GetAgentDocsSqlParams, GetAgentDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/agents/get_agent_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="agent",
    plural_name="agents",
    table_name="agent_artifact",
    junction_prefix="agent",
    fk_pattern="agent_%",
    api_routing={
        "base_path": "/api/v4/agents",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single agent by ID",
                "request_model": "GetAgentApiRequest",
                "response_model": "GetAgentApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update an agent",
                "request_model": "SaveAgentApiRequest",
                "response_model": "SaveAgentApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List agents with optional filters",
                "request_model": "GetAgentsListApiRequest",
                "response_model": "GetAgentsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing agent",
                "request_model": "DuplicateAgentApiRequest",
                "response_model": "DuplicateAgentApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete an agent",
                "request_model": "DeleteAgentApiRequest",
                "response_model": "DeleteAgentApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch an agent draft (autosave)",
                "request_model": "PatchAgentDraftApiRequest",
                "response_model": "PatchAgentDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Agents represent AI assistants used in GLOW for various purposes. They can be configured with models, tools, and other resources to define their capabilities and behavior.",
        "use_cases": [
            "Creating AI assistants for various tasks",
            "Configuring AI models and tools for agents",
            "Organizing agents by department",
            "Defining agent behavior through flags and resources",
        ],
        "related_concepts": [
            "Models - Agents are linked to models to define their AI capabilities",
            "Tools - Agents can be associated with tools for extended functionality",
            "Resources - Agents use multiple resource types (names, descriptions, flags, etc.) for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Agents",
        list_description="Manage AI agents for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
        detail_title="Agent",
        detail_description="AI agent configuration for teaching assistant training simulations. Customize intelligent agents to power student personas and enhance simulation-based learning experiences.",
        new_title="New Agent",
        new_description="Create a new AI agent for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_agent_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetAgentDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetAgentDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_agents_docs() -> dict[str, Any]:
    """Get agent documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
