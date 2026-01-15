"""Parameter artifact documentation."""

from typing import Any


def get_parameters_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the parameter artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "parameters",
        "type": "artifact",
        "database": {
            "table": "parameter_artifact",
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
                {"name": "parameter_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
                "personas",
                "documents",
            ],
            "junction_tables": [
                "parameter_names",
                "parameter_descriptions",
                "parameter_flags",
                "parameter_departments",
                "parameter_personas",
                "parameter_documents",
                "scenario_parameters",
                "draft_parameters",
            ],
            "related_artifacts": [
                {
                    "artifact": "scenarios",
                    "junction_table": "scenario_parameters",
                    "description": "Parameters can be assigned to scenarios",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_parameters",
                    "description": "Draft parameters for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/parameters",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single parameter by ID",
                    "request_model": "GetParameterApiRequest",
                    "response_model": "GetParameterApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a parameter",
                    "request_model": "SaveParameterApiRequest",
                    "response_model": "SaveParameterApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List parameters with optional filters",
                    "request_model": "GetParametersListApiRequest",
                    "response_model": "GetParametersListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing parameter",
                    "request_model": "DuplicateParameterApiRequest",
                    "response_model": "DuplicateParameterApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a parameter",
                    "request_model": "DeleteParameterApiRequest",
                    "response_model": "DeleteParameterApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a parameter draft (autosave)",
                    "request_model": "PatchParameterDraftApiRequest",
                    "response_model": "PatchParameterDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for parameters",
                    "junction_table": "parameter_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for parameters",
                    "junction_table": "parameter_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for parameters - boolean flags with types",
                    "junction_table": "parameter_flags",
                    "note": "Uses type_parameter_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for parameters - department associations",
                    "junction_table": "parameter_departments",
                },
                {
                    "name": "personas",
                    "endpoint": "/api/v4/resources/personas",
                    "create_only": True,
                    "description": "Persona resources for parameters - persona associations",
                    "junction_table": "parameter_personas",
                },
                {
                    "name": "documents",
                    "endpoint": "/api/v4/resources/documents",
                    "create_only": True,
                    "description": "Document resources for parameters - document associations",
                    "junction_table": "parameter_documents",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/parameters/Parameter.tsx",
            ],
            "pages": [],
            "usage_patterns": "Parameters are used to configure scenarios with specific values and associations.",
        },
        "glow_context": {
            "description": "Parameters represent configuration values used in GLOW to customize scenarios with specific personas, documents, and other associations.",
            "use_cases": [
                "Configuring scenarios with specific values",
                "Associating personas and documents with parameters",
                "Organizing parameters by department",
            ],
            "related_concepts": [
                "Scenarios - Parameters can be assigned to scenarios",
                "Personas - Parameters can be associated with personas",
                "Documents - Parameters can be associated with documents",
                "Resources - Parameters use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Parameter generation not currently available",
            },
        },
    }
