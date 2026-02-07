"""Agent artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="agent",
    plural_name="agents",
    table_name="agent_artifact",
    junction_prefix="agent",
    fk_pattern="agent_%",
    api_routing={
        "base_path": "/api/v4/agents",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single agent by ID",
                "request_model": "GetAgentApiRequest",
                "response_model": "GetAgentApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update an agent",
                "request_model": "SaveAgentApiRequest",
                "response_model": "SaveAgentApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List agents with optional filters",
                "request_model": "GetAgentsListApiRequest",
                "response_model": "GetAgentsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing agent",
                "request_model": "DuplicateAgentApiRequest",
                "response_model": "DuplicateAgentApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete an agent",
                "request_model": "DeleteAgentApiRequest",
                "response_model": "DeleteAgentApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch an agent draft (autosave)",
                "request_model": "PatchAgentDraftApiRequest",
                "response_model": "PatchAgentDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Agents represent AI assistants used in GLOW for various purposes. They can be configured with models, tools, and other resources to define their capabilities and behavior.",
        "use_cases": [
            "Creating AI assistants for various tasks",
            "Configuring AI models and tools for agents",
            "Organizing agents by department",
            "Defining agent behavior through flags and resources",
        ],
        "related_concepts": [
            "Models - Agents are linked to models to define their AI capabilities",
            "Tools - Agents can be associated with tools for extended functionality",
            "Resources - Agents use multiple resource types (names, descriptions, flags, etc.) for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_agents_docs() -> dict[str, Any]:
    """Get agent documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
