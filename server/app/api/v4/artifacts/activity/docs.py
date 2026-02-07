"""Activity artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="activity",
    plural_name="activity",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v4/activity",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get activity data with filters",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh activity materialized views",
            },
        },
    },
    glow_context={
        "description": "Activity provides real-time and historical activity tracking for GLOW, including problem resolution workflows.",
        "use_cases": [
            "Tracking user activity across the platform",
            "Monitoring problem resolution workflows",
            "Viewing activity metrics and trends",
        ],
        "related_concepts": [
            "Dashboard - Activity feeds into dashboard metrics",
            "Sessions - Activity is tracked per session",
            "Attempts - Activity includes attempt completions",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_activity_docs_static() -> dict[str, Any]:
    """Get activity documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
