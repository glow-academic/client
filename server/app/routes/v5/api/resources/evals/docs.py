"""Evals resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="evals",
    table_name="evals_resource",
    description="Eval resources for evaluation configuration.",
    used_by_artifacts=["eval"],
)


def get_evals_docs() -> dict[str, Any]:
    """Get evals documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)
