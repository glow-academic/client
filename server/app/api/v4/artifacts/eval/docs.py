"""Eval artifact documentation."""

from typing import Any


def get_evals_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the eval artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "evals",
        "type": "artifact",
        "database": {
            "table": "eval_artifact",
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
                {"name": "eval_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
                "agents",
            ],
            "junction_tables": [
                "eval_names",
                "eval_descriptions",
                "eval_flags",
                "eval_departments",
                "eval_agents",
                "eval_groups",
                "eval_runs",
                "draft_evals",
            ],
            "related_artifacts": [
                {
                    "artifact": "groups",
                    "junction_table": "eval_groups",
                    "description": "Evals can be linked to groups",
                },
                {
                    "artifact": "runs",
                    "junction_table": "eval_runs",
                    "description": "Evals can be linked to runs",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_evals",
                    "description": "Draft evals for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/evals",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single eval by ID",
                    "request_model": "GetEvalApiRequest",
                    "response_model": "GetEvalApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update an eval",
                    "request_model": "SaveEvalApiRequest",
                    "response_model": "SaveEvalApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List evals with optional filters",
                    "request_model": "GetEvalsListApiRequest",
                    "response_model": "GetEvalsListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing eval",
                    "request_model": "DuplicateEvalApiRequest",
                    "response_model": "DuplicateEvalApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete an eval",
                    "request_model": "DeleteEvalApiRequest",
                    "response_model": "DeleteEvalApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch an eval draft (autosave)",
                    "request_model": "PatchEvalDraftApiRequest",
                    "response_model": "PatchEvalDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for evals - single name per eval",
                    "junction_table": "eval_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for evals - single description per eval",
                    "junction_table": "eval_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for evals - boolean flags with types",
                    "junction_table": "eval_flags",
                    "note": "Uses type_eval_flags enum for flag types (active, dynamic, groups)",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for evals - department associations",
                    "junction_table": "eval_departments",
                },
                {
                    "name": "agents",
                    "endpoint": "/api/v4/resources/agents",
                    "create_only": True,
                    "description": "Agent resources for evals - multiple agents can be assigned",
                    "junction_table": "eval_agents",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/evals/Evals.tsx",
                "client/components/evals/Eval.tsx",
                "client/components/common/evals/AgentCardGrid.tsx",
                "client/components/common/evals/GroupCardGrid.tsx",
                "client/components/common/evals/ModelRunCardGrid.tsx",
                "client/components/common/evals/RubricCardGrid.tsx",
            ],
            "pages": [
                "client/app/(main)/system/evals/page.tsx",
            ],
            "usage_patterns": "Evals are created and edited through the system/evals page. Users can assign multiple resources (names, descriptions, flags, departments, agents) to evals. Evals are used for evaluation and assessment workflows.",
        },
        "glow_context": {
            "description": "Evals represent evaluation and assessment configurations in GLOW. They are used to define evaluation criteria, link to agents and groups, and track evaluation runs.",
            "use_cases": [
                "Creating evaluation configurations",
                "Linking evals to agents for evaluation workflows",
                "Organizing evals by department",
                "Tracking evaluation runs and results",
                "Using evals in assessment scenarios",
            ],
            "related_concepts": [
                "Agents - Evals can be linked to multiple agents",
                "Groups - Evals can be linked to groups",
                "Runs - Evals track evaluation runs",
                "Rubrics - Evals can reference rubrics for grading",
                "Drafts - Evals support draft autosave functionality",
                "Resources - Evals use multiple resource types (names, descriptions, flags, departments, agents) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Evals do not currently support AI generation",
            },
        },
    }
