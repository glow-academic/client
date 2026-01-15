"""Simulation artifact documentation."""

from typing import Any


def get_simulations_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the simulation artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "simulations",
        "type": "artifact",
        "database": {
            "table": "simulation_artifact",
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
                {"name": "simulation_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
                "scenarios",
            ],
            "junction_tables": [
                "simulation_names",
                "simulation_descriptions",
                "simulation_flags",
                "simulation_departments",
                "simulation_scenarios",
                "draft_simulations",
            ],
            "related_artifacts": [
                {
                    "artifact": "drafts",
                    "junction_table": "draft_simulations",
                    "description": "Draft simulations for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/simulations",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single simulation by ID",
                    "request_model": "GetSimulationApiRequest",
                    "response_model": "GetSimulationApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a simulation",
                    "request_model": "SaveSimulationApiRequest",
                    "response_model": "SaveSimulationApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List simulations with optional filters",
                    "request_model": "GetSimulationsListApiRequest",
                    "response_model": "GetSimulationsListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing simulation",
                    "request_model": "DuplicateSimulationApiRequest",
                    "response_model": "DuplicateSimulationApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a simulation",
                    "request_model": "DeleteSimulationApiRequest",
                    "response_model": "DeleteSimulationApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a simulation draft (autosave)",
                    "request_model": "PatchSimulationDraftApiRequest",
                    "response_model": "PatchSimulationDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for simulations",
                    "junction_table": "simulation_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for simulations",
                    "junction_table": "simulation_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for simulations - boolean flags with types",
                    "junction_table": "simulation_flags",
                    "note": "Uses type_simulation_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for simulations - department associations",
                    "junction_table": "simulation_departments",
                },
                {
                    "name": "scenarios",
                    "endpoint": "/api/v4/resources/scenarios",
                    "create_only": True,
                    "description": "Scenario resources for simulations - scenario associations",
                    "junction_table": "simulation_scenarios",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Simulations are collections of scenarios used for comprehensive learning experiences in GLOW.",
        },
        "glow_context": {
            "description": "Simulations represent collections of scenarios used in GLOW for comprehensive simulation-based learning experiences.",
            "use_cases": [
                "Creating comprehensive learning experiences",
                "Grouping multiple scenarios together",
                "Organizing simulations by department",
            ],
            "related_concepts": [
                "Scenarios - Simulations contain multiple scenarios",
                "Resources - Simulations use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Simulation generation not currently available",
            },
        },
    }
