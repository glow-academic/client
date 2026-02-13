"""Benchmark artifact documentation."""

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
    name="benchmark",
    plural_name="benchmarks",
    entity_type="analytics",
    api_routing={
        "base_path": "/api/v4/benchmark",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get benchmark data for an eval",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh benchmark materialized views",
            },
        },
    },
    glow_context={
        "description": "Benchmarks provide evaluation-level analytics for comparing agent performance across test runs.",
        "use_cases": [
            "Running automated benchmark tests",
            "Comparing agent performance across evals",
            "Tracking benchmark progress and results",
            "Viewing test summaries and scores",
        ],
        "related_concepts": [
            "Evals - Benchmarks are run against evals",
            "Tests - Benchmarks contain individual test cases",
            "Agents - Benchmarks compare agent performance",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Benchmark",
        list_description="Run and manage evaluations for teaching assistant training platform. Execute benchmark tests, analyze performance metrics, and evaluate system effectiveness for educational institutions and L&D programs.",
        detail_title="Benchmark",
        detail_description="Benchmark evaluation for teaching assistant training platform. View benchmark results and performance metrics.",
        new_title="New Benchmark",
        new_description="Create a new benchmark evaluation for teaching assistant training platform. Execute benchmark tests and analyze performance metrics.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_benchmark_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_benchmarks_docs() -> dict[str, Any]:
    """Get benchmark documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
