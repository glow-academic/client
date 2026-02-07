"""Provider artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="provider",
    plural_name="providers",
    table_name="provider_artifact",
    junction_prefix="provider",
    fk_pattern="provider_%",
    api_routing={
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
)

router = create_artifact_docs_router(CONFIG)


def get_providers_docs() -> dict[str, Any]:
    """Get provider documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
