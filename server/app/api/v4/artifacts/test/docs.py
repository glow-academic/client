"""Test artifact documentation."""

from typing import Any

from app.api.v4.artifacts.test import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="test",
    plural_name="tests",
    entity_type="artifact",
    table_name="test_artifact",
    junction_prefix="test",
    fk_pattern="test_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_test_status",
    ],
    api_routing={
        "base_path": "/api/v4/test",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single test with full detail",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List tests with filters",
            },
            "archive": {
                "path": "/archive",
                "method": "POST",
                "description": "Archive a test",
            },
        },
    },
    glow_context={
        "description": "Tests represent individual benchmark test cases within evals, tracking automated test execution and results.",
        "use_cases": [
            "Running individual benchmark tests",
            "Tracking test pass/fail status",
            "Viewing test execution details",
            "Archiving completed tests",
        ],
        "related_concepts": [
            "Benchmarks - Tests belong to benchmark runs",
            "Evals - Tests are defined within evals",
            "Agents - Tests evaluate agent performance",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_tests_docs() -> dict[str, Any]:
    """Get test documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
