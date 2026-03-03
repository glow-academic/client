"""Attempt artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.v5.api.main.attempt import permissions
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="attempt",
    plural_name="attempts",
    entity_type="artifact",
    table_name="attempt_artifact",
    junction_prefix="attempt",
    fk_pattern="attempt_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_content_display",
        "compute_chat_position_and_current",
        "compute_attempt_aggregates",
        "compute_total_possible_points",
        "compute_percentage",
        "compute_current_chat_index",
        "compute_total_time_limit",
        "compute_achieved_standards",
        "compute_passed_standards",
    ],
    api_routing={
        "base_path": "/api/v5/attempt",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single attempt with full detail",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List attempts with filters",
            },
            "archive": {
                "path": "/archive",
                "method": "POST",
                "description": "Archive an attempt",
            },
        },
    },
    glow_context={
        "description": "Attempts represent individual user attempts at simulations. They track progress, scores, chat history, and completion status.",
        "use_cases": [
            "Tracking student simulation attempts",
            "Viewing attempt scores and rubric results",
            "Managing chat history within attempts",
            "Archiving completed attempts",
        ],
        "related_concepts": [
            "Sessions - Attempts belong to sessions",
            "Simulations - Attempts are for specific simulations",
            "Chats - Attempts contain multiple chat interactions",
            "Rubrics - Attempts are graded against rubrics",
            "Training - Attempts feed into training analytics",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Attempts",
        list_description="View and manage practice attempts for teaching assistant training. Track simulation history, review performance, and monitor learning progress.",
        detail_title="Attempt",
        detail_description="Practice attempt details for teaching assistant training. Review performance and learning outcomes.",
        new_title="New Attempt",
        new_description="Start a new practice attempt for teaching assistant training.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_attempt_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_attempts_docs() -> dict[str, Any]:
    """Get attempt documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
