from typing import Any

from app.v5.api.resources._shared.docs_helper import build_resource_docs

ARG_POSITIONS_DOCS = build_resource_docs(
    name="arg_positions",
    table_name="arg_positions_resource",
    supports_search=True,
    supports_get=True,
)


def get_arg_positions_docs() -> dict[str, Any]:
    """Get arg_positions documentation (static portions, for MCP)."""
    return ARG_POSITIONS_DOCS
