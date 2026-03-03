"""Pricing artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="pricing",
    plural_name="pricing",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v5/pricing",
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
    page_metadata=PageMetadataConfig(
        list_title="Pricing",
        list_description="Manage pricing and subscription plans for GLOW teaching assistant training platform. Configure access levels, feature sets, and billing options for educational institutions and learning and development programs.",
        detail_title="Pricing",
        detail_description="Pricing details for teaching assistant training platform. View cost analytics and billing information.",
        new_title="New Pricing",
        new_description="Configure new pricing for teaching assistant training platform.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_pricing_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_pricing_docs_static() -> dict[str, Any]:
    """Get pricing documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
