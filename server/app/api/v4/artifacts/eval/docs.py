"""Eval artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="eval",
    plural_name="evals",
    table_name="eval_artifact",
    junction_prefix="eval",
    fk_pattern="eval_%",
    api_routing={
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
    glow_context={
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
            "Resources - Evals use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_evals_docs() -> dict[str, Any]:
    """Get eval documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
