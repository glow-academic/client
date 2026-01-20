"""Scenario artifact documentation."""

from typing import Any


def get_scenarios_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenario artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "scenario",  # Singular - matches MCP artifact discovery
        "type": "artifact",
        "database": {
            "table": "scenario_artifact",
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
                {"name": "scenario_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
                "personas",
                "documents",
                "parameters",
                "fields",
                "images",
                "objectives",
                "problem_statements",
            ],
            "junction_tables": [
                "scenario_names",
                "scenario_descriptions",
                "scenario_flags",
                "scenario_departments",
                "scenario_personas",
                "scenario_documents",
                "scenario_parameters",
                "scenario_fields",
                "scenario_images",
                "scenario_objectives",
                "scenario_problem_statements",
                "simulation_scenarios",
                "draft_scenarios",
            ],
            "related_artifacts": [
                {
                    "artifact": "simulations",
                    "junction_table": "simulation_scenarios",
                    "description": "Scenarios can be assigned to simulations",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_scenarios",
                    "description": "Draft scenarios for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/scenarios",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single scenario by ID",
                    "request_model": "GetScenarioApiRequest",
                    "response_model": "GetScenarioApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a scenario",
                    "request_model": "SaveScenarioApiRequest",
                    "response_model": "SaveScenarioApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List scenarios with optional filters",
                    "request_model": "GetScenariosListApiRequest",
                    "response_model": "GetScenariosListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing scenario",
                    "request_model": "DuplicateScenarioApiRequest",
                    "response_model": "DuplicateScenarioApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a scenario",
                    "request_model": "DeleteScenarioApiRequest",
                    "response_model": "DeleteScenarioApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a scenario draft (autosave)",
                    "request_model": "PatchScenarioDraftApiRequest",
                    "response_model": "PatchScenarioDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for scenarios",
                    "junction_table": "scenario_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for scenarios",
                    "junction_table": "scenario_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for scenarios - boolean flags with types",
                    "junction_table": "scenario_flags",
                    "note": "Uses type_scenario_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for scenarios - department associations",
                    "junction_table": "scenario_departments",
                },
                {
                    "name": "personas",
                    "endpoint": "/api/v4/resources/personas",
                    "create_only": True,
                    "description": "Persona resources for scenarios - persona associations",
                    "junction_table": "scenario_personas",
                },
                {
                    "name": "documents",
                    "endpoint": "/api/v4/resources/documents",
                    "create_only": True,
                    "description": "Document resources for scenarios - document associations",
                    "junction_table": "scenario_documents",
                },
                {
                    "name": "parameters",
                    "endpoint": "/api/v4/resources/parameters",
                    "create_only": True,
                    "description": "Parameter resources for scenarios - parameter associations",
                    "junction_table": "scenario_parameters",
                },
                {
                    "name": "fields",
                    "endpoint": "/api/v4/resources/fields",
                    "create_only": True,
                    "description": "Field resources for scenarios - field associations",
                    "junction_table": "scenario_fields",
                },
                {
                    "name": "images",
                    "endpoint": "/api/v4/resources/images",
                    "create_only": True,
                    "description": "Image resources for scenarios - image associations",
                    "junction_table": "scenario_images",
                },
                {
                    "name": "objectives",
                    "endpoint": "/api/v4/resources/objectives",
                    "create_only": True,
                    "description": "Objective resources for scenarios - learning objectives",
                    "junction_table": "scenario_objectives",
                },
                {
                    "name": "problem_statements",
                    "endpoint": "/api/v4/resources/problem_statements",
                    "create_only": True,
                    "description": "Problem statement resources for scenarios - problem statements",
                    "junction_table": "scenario_problem_statements",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Scenarios are central to GLOW's simulation-based learning, representing interactive learning situations.",
        },
        "glow_context": {
            "description": "Scenarios represent interactive learning situations used in GLOW for simulation-based learning. They combine personas, documents, parameters, and other resources to create rich learning experiences.",
            "use_cases": [
                "Creating interactive learning situations",
                "Combining personas, documents, and parameters",
                "Defining learning objectives and problem statements",
                "Organizing scenarios by department",
            ],
            "related_concepts": [
                "Simulations - Scenarios can be assigned to simulations",
                "Personas - Scenarios can include multiple personas",
                "Documents - Scenarios can include documents",
                "Parameters - Scenarios can include parameters",
                "Resources - Scenarios use multiple resource types for rich representation",
            ],
            "generation": {
                "available": True,
                "endpoint": "/socket/v4/scenarios/generate",
                "resource_types": [
                    "names",
                    "descriptions",
                    "objectives",
                    "problem_statements",
                ],
                "description": "Scenarios support AI generation for certain resource types via WebSocket",
            },
        },
    }
