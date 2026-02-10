"""Tool artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="tool",
    plural_name="tools",
    table_name="tool_artifact",
    junction_prefix="tool",
    fk_pattern="tool_%",
    api_routing={
        "base_path": "/api/v4/artifacts/tools",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single tool by ID",
                "request_model": "GetToolApiRequest",
                "response_model": "GetToolApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a tool",
                "request_model": "SaveToolApiRequest",
                "response_model": "SaveToolApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List tools with optional filters",
                "request_model": "GetToolsListApiRequest",
                "response_model": "GetToolsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing tool",
                "request_model": "DuplicateToolApiRequest",
                "response_model": "DuplicateToolApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a tool",
                "request_model": "DeleteToolApiRequest",
                "response_model": "DeleteToolApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a tool draft (autosave)",
                "request_model": "PatchToolDraftApiRequest",
                "response_model": "PatchToolDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Tools represent extensions to agent capabilities used in GLOW. They can be assigned to agents and include schemas and templates.",
        "use_cases": [
            "Extending agent capabilities",
            "Defining tool schemas and templates",
            "Assigning tools to agents",
        ],
        "related_concepts": [
            "Agents - Tools can be assigned to agents",
            "Schemas - Tools include schemas for structure",
            "Templates - Tools include templates for formatting",
            "Resources - Tools use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_tools_docs() -> dict[str, Any]:
    """Get tool documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
