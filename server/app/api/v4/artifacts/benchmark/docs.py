"""Benchmark artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
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
)

router = create_artifact_docs_router(CONFIG)


def get_benchmarks_docs() -> dict[str, Any]:
    """Get benchmark documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
