"""Field artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="field",
    plural_name="fields",
    table_name="field_artifact",
    junction_prefix="field",
    fk_pattern="field_%",
    api_routing={
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
                "response_model": "ListFieldApiResponse",
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
    glow_context={
        "description": "Fields represent custom data fields used in GLOW to extend personas and scenarios with additional structured data.",
        "use_cases": [
            "Defining custom data fields for personas",
            "Adding structured data to scenarios",
            "Organizing fields by department",
        ],
        "related_concepts": [
            "Personas - Fields can be assigned to personas",
            "Scenarios - Fields can be assigned to scenarios",
            "Resources - Fields use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_fields_docs() -> dict[str, Any]:
    """Get field documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
