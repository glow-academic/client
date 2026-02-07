"""Department artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="department",
    plural_name="departments",
    table_name="department_artifact",
    junction_prefix="department",
    fk_pattern="department_%",
    api_routing={
        "base_path": "/api/v4/departments",
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
)

router = create_artifact_docs_router(CONFIG)


def get_departments_docs() -> dict[str, Any]:
    """Get department documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
