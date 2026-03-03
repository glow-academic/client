"""Health artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
)

CONFIG = ArtifactDocsConfig(
    name="health",
    plural_name="health",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v5/health",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get health metrics and service status",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh health materialized views",
            },
        },
    },
    glow_context={
        "description": "Health provides system health monitoring including service status, error rates, and performance metrics.",
        "use_cases": [
            "Monitoring system health and uptime",
            "Tracking error rates and latency",
            "Viewing service-level metrics",
            "Detecting performance degradation",
        ],
        "related_concepts": [
            "Dashboard - Health metrics feed into dashboard",
            "Pricing - Health includes cost monitoring",
        ],
    },
)

router = APIRouter()


@router.post("/docs")
async def get_health_docs_endpoint() -> dict[str, Any]:
    return build_artifact_docs_static(CONFIG)


def get_health_docs_static() -> dict[str, Any]:
    """Get health documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
