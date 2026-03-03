"""Auth artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.routes.v5.tools.resources.names.get import get_names_internal
from app.infra.globals import get_db
from app.sql.types import GetAuthDocsSqlParams, GetAuthDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/auth/get_auth_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="auth",
    plural_name="auths",
    table_name="auth_artifact",
    junction_prefix="auth",
    fk_pattern="auth_%",
    api_routing={
        "base_path": "/api/v5/auths",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single auth entry by ID",
                "request_model": "GetAuthApiRequest",
                "response_model": "GetAuthApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update an auth entry",
                "request_model": "SaveAuthApiRequest",
                "response_model": "SaveAuthApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List auth entries with optional filters",
                "request_model": "GetAuthListApiRequest",
                "response_model": "GetAuthListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing auth entry",
                "request_model": "DuplicateAuthApiRequest",
                "response_model": "DuplicateAuthApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete an auth entry",
                "request_model": "DeleteAuthApiRequest",
                "response_model": "DeleteAuthApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch an auth draft (autosave)",
                "request_model": "PatchAuthDraftApiRequest",
                "response_model": "PatchAuthDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Auth entries represent authentication configurations used in GLOW for various authentication purposes.",
        "use_cases": [
            "Configuring authentication methods",
            "Managing authentication credentials",
            "Defining authentication protocols and slugs",
        ],
        "related_concepts": [
            "Resources - Auth entries use multiple resource types (names, descriptions, flags) for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Auth",
        list_description="Manage authentication methods and identity providers for teaching assistant training platform. Configure SSO, OAuth, and other authentication mechanisms for secure access to educational institutions and L&D programs.",
        detail_title="Auth",
        detail_description="Authentication method configuration for teaching assistant training platform. Manage identity providers and secure access mechanisms for educational institutions and L&D programs.",
        new_title="Create Auth",
        new_description="Create a new authentication method for teaching assistant training platform. Configure SSO, OAuth, and other identity providers for secure access to educational institutions and L&D programs.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_auth_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetAuthDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetAuthDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_auths_docs() -> dict[str, Any]:
    """Get auth documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
