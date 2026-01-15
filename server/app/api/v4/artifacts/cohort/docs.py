"""Cohort artifact documentation."""

from typing import Any


def get_cohorts_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the cohort artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "cohorts",
        "type": "artifact",
        "database": {
            "table": "cohort_artifact",
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
                {"name": "cohort_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
                "departments",
            ],
            "junction_tables": [
                "cohort_names",
                "cohort_descriptions",
                "cohort_flags",
                "cohort_departments",
                "draft_cohorts",
            ],
            "related_artifacts": [
                {
                    "artifact": "drafts",
                    "junction_table": "draft_cohorts",
                    "description": "Draft cohorts for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/cohorts",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single cohort by ID",
                    "request_model": "GetCohortApiRequest",
                    "response_model": "GetCohortApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a cohort",
                    "request_model": "SaveCohortApiRequest",
                    "response_model": "SaveCohortApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List cohorts with optional filters",
                    "request_model": "GetCohortsListApiRequest",
                    "response_model": "GetCohortsListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing cohort",
                    "request_model": "DuplicateCohortApiRequest",
                    "response_model": "DuplicateCohortApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a cohort",
                    "request_model": "DeleteCohortApiRequest",
                    "response_model": "DeleteCohortApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a cohort draft (autosave)",
                    "request_model": "PatchCohortDraftApiRequest",
                    "response_model": "PatchCohortDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for cohorts",
                    "junction_table": "cohort_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for cohorts",
                    "junction_table": "cohort_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for cohorts - boolean flags with types",
                    "junction_table": "cohort_flags",
                    "note": "Uses type_cohort_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for cohorts - department associations",
                    "junction_table": "cohort_departments",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Cohorts are used to group users or entities in GLOW.",
        },
        "glow_context": {
            "description": "Cohorts represent groups of users or entities used in GLOW for organizational purposes.",
            "use_cases": [
                "Grouping users for organizational purposes",
                "Organizing entities by department",
                "Managing cohort-based access and permissions",
            ],
            "related_concepts": [
                "Departments - Cohorts can be associated with departments",
                "Resources - Cohorts use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Cohort generation not currently available",
            },
        },
    }
