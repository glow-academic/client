"""Department artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.infra.globals import get_db
from app.routes.v5.tools.resources.names.get import get_names
from app.sql.types import GetDepartmentDocsSqlParams, GetDepartmentDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/departments/get_department_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="department",
    plural_name="departments",
    table_name="department_artifact",
    junction_prefix="department",
    fk_pattern="department_%",
    api_routing={
        "base_path": "/api/v5/departments",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single department by ID",
                "request_model": "GetDepartmentApiRequest",
                "response_model": "GetDepartmentApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a department",
                "request_model": "SaveDepartmentApiRequest",
                "response_model": "SaveDepartmentApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List departments with optional filters",
                "request_model": "GetDepartmentsListApiRequest",
                "response_model": "GetDepartmentsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing department",
                "request_model": "DuplicateDepartmentApiRequest",
                "response_model": "DuplicateDepartmentApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a department",
                "request_model": "DeleteDepartmentApiRequest",
                "response_model": "DeleteDepartmentApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a department draft (autosave)",
                "request_model": "PatchDepartmentDraftApiRequest",
                "response_model": "PatchDepartmentDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Departments represent organizational units used in GLOW to group users, resources, and manage access permissions.",
        "use_cases": [
            "Organizing users and resources by department",
            "Managing department-based access and permissions",
            "Associating settings with departments",
        ],
        "related_concepts": [
            "Settings - Departments can be associated with settings",
            "Resources - Departments use multiple resource types (names, descriptions, flags) for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Departments",
        list_description="Manage academic departments and organizational units for teaching assistant training programs. Organize departments, configure department-specific settings, and coordinate L&D programs across different academic units.",
        detail_title="Department",
        detail_description="Academic department for teaching assistant training programs. Manage department-specific settings and coordinate L&D programs across different academic units.",
        new_title="New Department",
        new_description="Create a new academic department for teaching assistant training programs. Set up department-specific configurations, organize teaching staff, and coordinate L&D programs across different academic units.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_department_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetDepartmentDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetDepartmentDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_departments_docs() -> dict[str, Any]:
    """Get department documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
