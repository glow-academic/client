"""Activity artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="activity",
    plural_name="activity",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v5/activity",
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
    page_metadata=PageMetadataConfig(
        list_title="Activity",
        list_description="View activity logs and user interactions across the platform. Track system events, user actions, and engagement metrics for comprehensive activity monitoring.",
        detail_title="Activity",
        detail_description="Activity details and interaction logs for teaching assistant training platform.",
        new_title="New Activity",
        new_description="Create a new activity log entry for teaching assistant training platform.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_activity_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_activity_docs_static() -> dict[str, Any]:
    """Get activity documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
