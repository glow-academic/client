"""Rubric artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="rubric",
    plural_name="rubrics",
    table_name="rubric_artifact",
    junction_prefix="rubric",
    fk_pattern="rubric_%",
    api_routing={
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
    glow_context={
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
            "Resources - Rubrics use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_rubrics_docs() -> dict[str, Any]:
    """Get rubric documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
