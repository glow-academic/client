"""Tool artifact documentation."""

from typing import Any


def get_tools_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the tool artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "tools",
        "type": "artifact",
        "database": {
            "table": "tool_artifact",
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
                {"name": "tool_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "schemas",
                "templates",
            ],
            "junction_tables": [
                "tool_names",
                "tool_descriptions",
                "tool_flags",
                "tool_schemas",
                "tool_templates",
                "agent_tools",
                "draft_tools",
            ],
            "related_artifacts": [
                {
                    "artifact": "agents",
                    "junction_table": "agent_tools",
                    "description": "Tools can be assigned to agents",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_tools",
                    "description": "Draft tools for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/tools",
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for tools",
                    "junction_table": "tool_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for tools",
                    "junction_table": "tool_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for tools - boolean flags with types",
                    "junction_table": "tool_flags",
                    "note": "Uses type_tool_flags enum for flag types",
                },
                {
                    "name": "schemas",
                    "endpoint": "/api/v4/resources/schemas",
                    "create_only": True,
                    "description": "Schema resources for tools - tool schemas",
                    "junction_table": "tool_schemas",
                },
                {
                    "name": "templates",
                    "endpoint": "/api/v4/resources/templates",
                    "create_only": True,
                    "description": "Template resources for tools - tool templates",
                    "junction_table": "tool_templates",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Tools are used to extend agent capabilities in GLOW.",
        },
        "glow_context": {
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
                "Resources - Tools use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Tool generation not currently available",
            },
        },
    }
