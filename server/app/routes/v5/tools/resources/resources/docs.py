"""Resources resource documentation."""

import asyncpg

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.resources.resources.create import create_resource
from app.routes.v5.tools.resources.resources.get import get_resources
from app.routes.v5.tools.resources.resources.search import search_resources


async def get_resources_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the resources resource."""
    resource_table = await get_table_info(conn, "resources_resource")
    tables = [t for t in [resource_table] if t is not None]

    return DocsResponse(
        name="resources",
        type="resource",
        description="Resource type references used by tools.",
        tables=tables,
        operations=[
            get_operation_info(
                create_resource,
                description="Creates a new resources resource.",
            ),
            get_operation_info(
                get_resources,
                description="Batch retrieves resources by IDs.",
            ),
            get_operation_info(
                search_resources,
                description="Filtered paginated search returning matching resources.",
            ),
        ],
    )
