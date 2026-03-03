"""Provider artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.v5.api.resources.names.get import get_names_internal
from app.v5.infra.globals import get_db
from app.v5.sql.types import GetProviderDocsSqlParams, GetProviderDocsSqlRow
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/providers/get_provider_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="provider",
    plural_name="providers",
    table_name="provider_artifact",
    junction_prefix="provider",
    fk_pattern="provider_%",
    api_routing={
        "base_path": "/api/v5/providers",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single provider by ID",
                "request_model": "GetProviderApiRequest",
                "response_model": "GetProviderApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a provider",
                "request_model": "SaveProviderApiRequest",
                "response_model": "SaveProviderApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List providers with optional filters",
                "request_model": "GetProvidersListApiRequest",
                "response_model": "GetProvidersListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing provider",
                "request_model": "DuplicateProviderApiRequest",
                "response_model": "DuplicateProviderApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a provider",
                "request_model": "DeleteProviderApiRequest",
                "response_model": "DeleteProviderApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a provider draft (autosave)",
                "request_model": "PatchProviderDraftApiRequest",
                "response_model": "PatchProviderDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Providers represent service providers (e.g., AI model providers like OpenAI, Anthropic) used in GLOW.",
        "use_cases": [
            "Creating provider configurations for AI model services",
            "Linking providers to models",
            "Managing provider settings and flags",
        ],
        "related_concepts": [
            "Models - Providers are linked to models via model_providers junction table",
            "Resources - Providers use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Providers",
        list_description="Manage AI providers and their configurations for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
        detail_title="Provider",
        detail_description="AI provider configuration for teaching assistant training platform. Manage provider settings, API endpoints, and platform integrations for educational institutions and L&D programs.",
        new_title="New Provider",
        new_description="Create a new AI provider configuration for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_provider_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetProviderDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetProviderDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_providers_docs() -> dict[str, Any]:
    """Get provider documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
