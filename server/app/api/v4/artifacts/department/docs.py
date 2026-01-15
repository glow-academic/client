"""Department artifact documentation."""

from typing import Any


def get_departments_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the department artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "departments",
        "type": "artifact",
        "database": {
            "table": "department_artifact",
            "primary_key": "id",
            "columns": [
                {
                    "name": "id",
                    "type": "uuid",
                    "nullable": False,
                    "default": "uuidv7()",
                    "description": "Primary key, UUID v7",
                },
                {
                    "name": "created_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Creation timestamp",
                },
                {
                    "name": "updated_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Last update timestamp",
                },
            ],
            "indexes": [
                {"name": "department_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "settings",
            ],
            "junction_tables": [
                "department_names",
                "department_descriptions",
                "department_flags",
                "department_settings",
                "draft_departments",
            ],
            "related_artifacts": [
                {
                    "artifact": "drafts",
                    "junction_table": "draft_departments",
                    "description": "Draft departments for autosave",
                },
            ],
        },
        "api_routing": {
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for departments",
                    "junction_table": "department_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for departments",
                    "junction_table": "department_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for departments - boolean flags with types",
                    "junction_table": "department_flags",
                    "note": "Uses type_department_flags enum for flag types",
                },
                {
                    "name": "settings",
                    "endpoint": "/api/v4/resources/settings",
                    "create_only": True,
                    "description": "Setting resources for departments - department settings",
                    "junction_table": "department_settings",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Departments are used to organize users and resources in GLOW.",
        },
        "glow_context": {
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
            "generation": {
                "available": False,
                "description": "Department generation not currently available",
            },
        },
    }
