"""Field artifact documentation."""

from typing import Any


def get_fields_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the field artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "fields",
        "type": "artifact",
        "database": {
            "table": "field_artifact",
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
                {
                    "name": "field_artifact_pkey",
                    "type": "PRIMARY KEY",
                    "columns": ["id"],
                }
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
            ],
            "junction_tables": [
                "field_names",
                "field_descriptions",
                "field_flags",
                "field_departments",
                "persona_fields",
                "scenario_fields",
                "draft_fields",
            ],
            "related_artifacts": [
                {
                    "artifact": "personas",
                    "junction_table": "persona_fields",
                    "description": "Fields can be assigned to personas",
                },
                {
                    "artifact": "scenarios",
                    "junction_table": "scenario_fields",
                    "description": "Fields can be assigned to scenarios",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_fields",
                    "description": "Draft fields for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/fields",
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
                    "response_model": "GetFieldsListApiResponse",
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for fields",
                    "junction_table": "field_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for fields",
                    "junction_table": "field_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for fields - boolean flags with types",
                    "junction_table": "field_flags",
                    "note": "Uses type_field_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for fields - department associations",
                    "junction_table": "field_departments",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Fields are used to define custom data fields that can be assigned to personas and scenarios.",
        },
        "glow_context": {
            "description": "Fields represent custom data fields used in GLOW to extend personas and scenarios with additional structured data.",
            "use_cases": [
                "Defining custom data fields for personas",
                "Adding structured data to scenarios",
                "Organizing fields by department",
            ],
            "related_concepts": [
                "Personas - Fields can be assigned to personas",
                "Scenarios - Fields can be assigned to scenarios",
                "Resources - Fields use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Field generation not currently available",
            },
        },
    }
