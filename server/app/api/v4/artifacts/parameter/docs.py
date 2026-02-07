"""Parameter artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="parameter",
    plural_name="parameters",
    table_name="parameter_artifact",
    junction_prefix="parameter",
    fk_pattern="parameter_%",
    api_routing={
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
    glow_context={
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
            "Resources - Parameters use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_parameters_docs() -> dict[str, Any]:
    """Get parameter documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
