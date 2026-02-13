"""Reports artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.reports import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="reports",
    plural_name="reports",
    entity_type="analytics",
    permissions_module=permissions,
    permission_functions=[
        "compute_reports_header_metrics",
        "compute_overview_section",
        "compute_leaderboard_section",
        "compute_trends_section",
        "compute_history_section",
    ],
    api_routing={
        "base_path": "/api/v4/reports",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get reports data with sections",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh reports materialized views",
            },
            "export": {
                "path": "/export",
                "method": "POST",
                "description": "Export reports data",
            },
        },
    },
    glow_context={
        "description": "Reports provide comprehensive analytics reports with overview, leaderboard, trends, and history sections.",
        "use_cases": [
            "Generating comprehensive performance reports",
            "Exporting report data for external analysis",
            "Viewing trend analysis over time",
            "Reviewing historical performance data",
        ],
        "related_concepts": [
            "Dashboard - Reports expand on dashboard metrics",
            "Leaderboard - Reports include leaderboard data",
            "Training - Reports cover training metrics",
            "Attempts - Reports aggregate attempt data",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Reports",
        list_description="Comprehensive learning analytics and reports for teaching assistant training. Track simulation-based practice sessions, review pedagogical assessments, analyze teaching effectiveness, and monitor professional development progress.",
        detail_title="Report",
        detail_description="Learning analytics report for teaching assistant training. Review pedagogical assessments and teaching effectiveness.",
        new_title="New Report",
        new_description="Generate a new learning analytics report for teaching assistant training.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_reports_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_reports_docs_static() -> dict[str, Any]:
    """Get reports documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
