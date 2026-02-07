"""Model artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="model",
    plural_name="models",
    table_name="model_artifact",
    junction_prefix="model",
    fk_pattern="model_%",
    api_routing={
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
    glow_context={
        "description": (
            "Models represent AI models used in GLOW for various"
            " AI operations. They can be associated with"
            " providers and assigned to agents."
        ),
        "use_cases": [
            "Defining AI models for use in GLOW",
            "Associating models with providers",
            "Assigning models to agents",
        ],
        "related_concepts": [
            "Agents - Models can be assigned to agents",
            "Providers - Models are associated with providers",
            "Resources - Models use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_models_docs() -> dict[str, Any]:
    """Get model documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
