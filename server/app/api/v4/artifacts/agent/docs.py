"""Agent artifact documentation."""

from typing import Any


def get_agents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the agent artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "agents",
        "type": "artifact",
        "database": {
            "table": "agent_artifact",
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
                    "name": "agent_artifact_pkey",
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
                "models",
                "tools",
            ],
            "junction_tables": [
                "agent_names",
                "agent_descriptions",
                "agent_flags",
                "agent_departments",
                "agent_models",
                "agent_tools",
                "draft_agents",
            ],
            "related_artifacts": [
                {
                    "artifact": "drafts",
                    "junction_table": "draft_agents",
                    "description": "Draft agents for autosave",
                },
            ],
        },
        "api_routing": {
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for agents",
                    "junction_table": "agent_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for agents",
                    "junction_table": "agent_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for agents - boolean flags with types",
                    "junction_table": "agent_flags",
                    "note": "Uses type_agent_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for agents - department associations",
                    "junction_table": "agent_departments",
                },
                {
                    "name": "models",
                    "endpoint": "/api/v4/resources/models",
                    "create_only": True,
                    "description": "Model resources for agents - AI model associations",
                    "junction_table": "agent_models",
                },
                {
                    "name": "tools",
                    "endpoint": "/api/v4/resources/tools",
                    "create_only": True,
                    "description": "Tool resources for agents - tool associations",
                    "junction_table": "agent_tools",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/agents/Agent.tsx",
            ],
            "pages": [
                "client/app/(main)/engine/agents/new/page.tsx",
                "client/app/(main)/engine/agents/a/[agentId]/page.tsx",
            ],
            "usage_patterns": "Agents are created and edited through the engine/agents pages. Agents represent AI assistants that can be configured with models, tools, and other resources.",
        },
        "glow_context": {
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
            "generation": {
                "available": False,
                "description": "Agent generation not currently available",
            },
        },
    }
