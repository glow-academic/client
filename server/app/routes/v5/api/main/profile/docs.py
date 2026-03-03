"""Profile artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.infra.globals import get_db
from app.routes.v5.tools.resources.names.get import get_names
from app.sql.types import GetProfileDocsSqlParams, GetProfileDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/profile/get_profile_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="profile",
    plural_name="profiles",
    table_name="profile_artifact",
    junction_prefix="profile",
    fk_pattern="profile_%",
    api_routing={
        "base_path": "/api/v5/profiles",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single profile by ID",
                "request_model": "GetProfileApiRequest",
                "response_model": "GetProfileApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a profile",
                "request_model": "SaveProfileRouteApiRequest",
                "response_model": "SaveProfileRouteApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List profiles with optional filters",
                "request_model": "GetProfilesListApiRequest",
                "response_model": "GetProfilesListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing profile",
                "request_model": "DuplicateProfileApiRequest",
                "response_model": "DuplicateProfileApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a profile",
                "request_model": "DeleteProfileApiRequest",
                "response_model": "DeleteProfileApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a profile draft (autosave)",
                "request_model": "PatchProfileDraftApiRequest",
                "response_model": "PatchProfileDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Profiles represent user profiles in GLOW. They contain user identity, roles, and department associations.",
        "use_cases": [
            "Managing user identity and roles",
            "Associating users with departments",
            "Tracking user settings and preferences",
        ],
        "related_concepts": [
            "Departments - Profiles are associated with departments",
            "Roles - Profiles have role-based access control",
            "Resources - Profiles use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Profiles",
        list_description="Manage profiles and role assignments for teaching assistant training programs. Organize members, assign roles and permissions, and coordinate learning cohort participation for effective L&D program administration.",
        detail_title="Profile",
        detail_description="Manage profile, role assignments, and access permissions for teaching assistant training programs. Configure participation in learning cohorts and educational resources.",
        new_title="New Profile",
        new_description="Add a new profile to the training platform. Create profiles, assign roles and permissions, and configure access to learning cohorts and educational resources for teaching assistant development programs.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_profile_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetProfileDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetProfileDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_profiles_docs() -> dict[str, Any]:
    """Get profile documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
