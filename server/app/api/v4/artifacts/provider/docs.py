"""Provider artifact documentation."""

from typing import Any


def get_providers_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the provider artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "providers",
        "type": "artifact",
        "database": {
            "table": "provider_artifact",
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
                {"name": "provider_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
            ],
            "junction_tables": [
                "provider_names",
                "provider_descriptions",
                "provider_flags",
                "model_providers",
                "draft_providers",
            ],
            "related_artifacts": [
                {
                    "artifact": "models",
                    "junction_table": "model_providers",
                    "description": "Providers can be linked to models",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_providers",
                    "description": "Draft providers for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/providers",
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for providers - single name per provider",
                    "junction_table": "provider_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for providers - single description per provider",
                    "junction_table": "provider_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for providers - boolean flags with types",
                    "junction_table": "provider_flags",
                    "note": "Uses type_provider_flags enum for flag types (active)",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/providers/Providers.tsx",
                "client/components/providers/Provider.tsx",
            ],
            "pages": [
                "client/app/(main)/system/providers/page.tsx",
            ],
            "usage_patterns": "Providers are created and edited through the system/providers page. Users can assign resources (names, descriptions, flags) to providers. Providers are linked to models and used in various GLOW workflows.",
        },
        "glow_context": {
            "description": "Providers represent service providers (e.g., AI model providers like OpenAI, Anthropic) used in GLOW. They are linked to models and used throughout the system for various operations.",
            "use_cases": [
                "Creating provider configurations for AI model services",
                "Linking providers to models",
                "Managing provider settings and flags",
                "Using providers in various GLOW workflows",
            ],
            "related_concepts": [
                "Models - Providers are linked to models via model_providers junction table",
                "Drafts - Providers support draft autosave functionality",
                "Resources - Providers use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": True,
                "endpoint": "/socket/v4/providers/generate",
                "resource_types": [
                    "names",
                    "descriptions",
                    "flags",
                ],
                "description": "Providers support AI generation for all resource types via WebSocket",
            },
        },
    }
