"""Emails CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.emails.get import get_emails
from app.routes.v5.tools.resources.emails.types import GetEmailResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_email(
    conn: asyncpg.Connection,
    email: str,
    redis: Redis,
    mcp: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetEmailResponse:
    """Create an email resource (insert or get existing)."""
    email_id = await conn.fetchval(
        """
        INSERT INTO emails_resource (email, active, mcp, generated)
        VALUES ($1, true, $2, $2)
        ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
        RETURNING id
    """,
        email,
        mcp,
    )

    await invalidate_tags(["resources", "emails"], redis=redis)
    items = await get_emails(conn, [email_id], redis, bypass_cache=True)
    return items[0]
