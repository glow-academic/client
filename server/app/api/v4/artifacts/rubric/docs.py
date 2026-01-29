"""Rubric artifact documentation."""

from typing import Any


def get_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the rubric artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "rubrics",
        "type": "artifact",
        "database": {
            "table": "rubric_artifact",
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
                    "name": "rubric_artifact_pkey",
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
                "points",
                "standard_groups",
            ],
            "junction_tables": [
                "rubric_names",
                "rubric_descriptions",
                "rubric_flags",
                "rubric_departments",
                "rubric_points",
                "rubric_standard_groups",
                "draft_rubrics",
            ],
            "related_artifacts": [
                {
                    "artifact": "drafts",
                    "junction_table": "draft_rubrics",
                    "description": "Draft rubrics for autosave",
                },
            ],
        },
        "api_routing": {
            "base_path": "/api/v4/rubrics",
            "endpoints": {
                "get": {
                    "path": "/get",
                    "method": "POST",
                    "description": "Get a single rubric by ID",
                    "request_model": "GetRubricApiRequest",
                    "response_model": "GetRubricApiResponse",
                },
                "save": {
                    "path": "/save",
                    "method": "POST",
                    "description": "Create or update a rubric",
                    "request_model": "SaveRubricApiRequest",
                    "response_model": "SaveRubricApiResponse",
                },
                "list": {
                    "path": "/list",
                    "method": "POST",
                    "description": "List rubrics with optional filters",
                    "request_model": "GetRubricsListApiRequest",
                    "response_model": "GetRubricsListApiResponse",
                },
                "duplicate": {
                    "path": "/duplicate",
                    "method": "POST",
                    "description": "Duplicate an existing rubric",
                    "request_model": "DuplicateRubricApiRequest",
                    "response_model": "DuplicateRubricApiResponse",
                },
                "delete": {
                    "path": "/delete",
                    "method": "POST",
                    "description": "Delete a rubric",
                    "request_model": "DeleteRubricApiRequest",
                    "response_model": "DeleteRubricApiResponse",
                },
                "draft": {
                    "path": "/draft",
                    "method": "PATCH",
                    "description": "Create or patch a rubric draft (autosave)",
                    "request_model": "PatchRubricDraftApiRequest",
                    "response_model": "PatchRubricDraftApiResponse",
                },
            },
        },
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for rubrics",
                    "junction_table": "rubric_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for rubrics",
                    "junction_table": "rubric_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for rubrics - boolean flags with types",
                    "junction_table": "rubric_flags",
                    "note": "Uses type_rubric_flags enum for flag types",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for rubrics - department associations",
                    "junction_table": "rubric_departments",
                },
                {
                    "name": "points",
                    "endpoint": "/api/v4/resources/points",
                    "create_only": True,
                    "description": "Point resources for rubrics - scoring points",
                    "junction_table": "rubric_points",
                },
                {
                    "name": "standard_groups",
                    "endpoint": "/api/v4/resources/standard_groups",
                    "create_only": True,
                    "description": "Standard group resources for rubrics - standard groupings",
                    "junction_table": "rubric_standard_groups",
                },
            ]
        },
        "frontend": {
            "components": [],
            "pages": [],
            "usage_patterns": "Rubrics are used for assessment and grading in GLOW.",
        },
        "glow_context": {
            "description": "Rubrics represent assessment and grading criteria used in GLOW for evaluating student performance.",
            "use_cases": [
                "Defining assessment criteria",
                "Creating grading rubrics",
                "Organizing rubrics by department",
                "Associating points and standard groups with rubrics",
            ],
            "related_concepts": [
                "Points - Rubrics can be associated with points for scoring",
                "Standard Groups - Rubrics can be associated with standard groups",
                "Resources - Rubrics use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": False,
                "description": "Rubric generation not currently available",
            },
        },
    }
