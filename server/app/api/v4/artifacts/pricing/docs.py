"""Pricing artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="pricing",
    plural_name="pricing",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v4/pricing",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get pricing data and cost analytics",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh pricing materialized views",
            },
        },
    },
    glow_context={
        "description": "Pricing provides cost analytics and usage tracking for AI model runs, including per-run, group, and daily aggregations.",
        "use_cases": [
            "Tracking AI model usage costs",
            "Viewing cost breakdowns by group and run",
            "Monitoring daily cost trends",
            "Analyzing cost per department",
        ],
        "related_concepts": [
            "Models - Pricing tracks costs per model",
            "Providers - Pricing is organized by provider",
            "Groups - Pricing aggregates at group level",
            "Dashboard - Pricing feeds into dashboard cost metrics",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_pricing_docs_static() -> dict[str, Any]:
    """Get pricing documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
