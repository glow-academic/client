"""Test artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.v5.api.main.test import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
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
        "base_path": "/api/v5/test",
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

router = APIRouter()


@router.post("/docs")
async def get_test_docs_endpoint() -> dict[str, Any]:
    return build_artifact_docs_static(CONFIG)


def get_tests_docs() -> dict[str, Any]:
    """Get test documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
