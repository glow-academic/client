"""Model artifact documentation."""

from typing import Any


def get_models_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the model artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "models",
        "type": "artifact",
        "database": {
            "table": "model_artifact",
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
                    "name": "model_artifact_pkey",
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
                "providers",
            ],
            "junction_tables": [
                "model_names",
                "model_descriptions",
                "model_flags",
                "model_providers",
                "agent_models",
                "draft_models",
            ],
            "related_artifacts": [
                {
                    "artifact": "agents",
                    "junction_table": "agent_models",
                    "description": "Models can be assigned to agents",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_models",
                    "description": "Draft models for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/models",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single model by ID",
                    "request_model": "GetModelApiRequest",
                    "response_model": "GetModelApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a model",
                    "request_model": "SaveModelApiRequest",
                    "response_model": "SaveModelApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List models with optional filters",
                    "request_model": "GetModelsListApiRequest",
                    "response_model": "GetModelsListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing model",
                    "request_model": "DuplicateModelApiRequest",
                    "response_model": "DuplicateModelApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a model",
                    "request_model": "DeleteModelApiRequest",
                    "response_model": "DeleteModelApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a model draft (autosave)",
                    "request_model": "PatchModelDraftApiRequest",
                    "response_model": "PatchModelDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for models",
                    "junction_table": "model_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for models",
                    "junction_table": "model_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for models - boolean flags with types",
                    "junction_table": "model_flags",
                    "note": "Uses type_model_flags enum for flag types",
                },
                {
                    "name": "providers",
                    "endpoint": "/api/v4/resources/providers",
                    "create_only": True,
                    "description": "Provider resources for models - AI provider associations",
                    "junction_table": "model_providers",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Models represent AI models used in GLOW for various AI operations.",
        },
        "glow_context": {
            "description": "Models represent AI models used in GLOW for various AI operations. They can be associated with providers and assigned to agents.",
            "use_cases": [
                "Defining AI models for use in GLOW",
                "Associating models with providers",
                "Assigning models to agents",
            ],
            "related_concepts": [
                "Agents - Models can be assigned to agents",
                "Providers - Models are associated with providers",
                "Resources - Models use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Model generation not currently available",
            },
        },
    }
