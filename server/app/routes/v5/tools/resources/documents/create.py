"""Documents CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.documents.get import get_documents
from app.routes.v5.tools.resources.documents.types import GetDocumentResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_document(
    conn: asyncpg.Connection,
    redis: Redis,
    name: str = "",
    description: str = "",
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetDocumentResponse:
    """Create a document resource (plain INSERT — no unique constraint)."""
    document_id = await conn.fetchval(
        """
        INSERT INTO documents_resource (name, description, active, mcp, generated)
        VALUES ($1, $2, true, $3, $3)
        RETURNING id
    """,
        name,
        description,
        mcp,
    )

    await invalidate_tags(["resources", "documents"], redis=redis)
    items = await get_documents(conn, [document_id], redis, bypass_cache=True)
    return items[0]
