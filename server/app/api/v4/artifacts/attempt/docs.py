"""Attempt artifact documentation."""

from typing import Any

from app.api.v4.artifacts.attempt import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
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
        "base_path": "/api/v4/attempt",
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
)

router = create_artifact_docs_router(CONFIG)


def get_attempts_docs() -> dict[str, Any]:
    """Get attempt documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
