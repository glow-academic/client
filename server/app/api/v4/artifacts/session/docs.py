"""Session artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="session",
    plural_name="sessions",
    entity_type="artifact",
    table_name="session_artifact",
    junction_prefix="session",
    fk_pattern="session_%",
    api_routing={
        "base_path": "/api/v4/session",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single session with full detail",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List sessions with filters",
            },
        },
    },
    glow_context={
        "description": "Sessions represent user simulation sessions, tracking all attempts and interactions within a single simulation experience.",
        "use_cases": [
            "Tracking simulation sessions",
            "Viewing session-level attempt history",
            "Analyzing session duration and completion",
        ],
        "related_concepts": [
            "Attempts - Sessions contain multiple attempts",
            "Simulations - Sessions are for specific simulations",
            "Groups - Sessions can belong to groups",
            "Training - Sessions feed into training analytics",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_sessions_docs() -> dict[str, Any]:
    """Get session documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
