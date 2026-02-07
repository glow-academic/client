"""Cohort artifact documentation."""

from typing import Any

from app.api.v4.artifacts.cohort import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="cohort",
    plural_name="cohorts",
    table_name="cohort_artifact",
    junction_prefix="cohort",
    fk_pattern="cohort_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_save",
        "compute_can_draft",
        "has_access",
    ],
    api_routing={
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
    glow_context={
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
    },
)

router = create_artifact_docs_router(CONFIG)


def get_cohorts_docs() -> dict[str, Any]:
    """Get cohort documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
