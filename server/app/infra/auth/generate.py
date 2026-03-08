"""Resolve group messages — composes canonical black boxes.

Given a group_id with pagination:
  1. get_groups → group info (name, created_at, session_id)
  2. search_runs → run IDs for the group
  3. search_messages → paginated messages filtered to user/assistant roles

No inline SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.groups.get import get_groups
from app.routes.v5.tools.entries.messages.search import search_messages
from app.routes.v5.tools.entries.messages.types import SearchMessageResponse
from app.routes.v5.tools.entries.runs.search import search_runs


@dataclass(frozen=True)
class GroupMessagesResult:
    """Result of a group messages lookup."""

    group_id: UUID
    group_name: str
    group_created_at: datetime
    session_id: UUID
    messages: list[SearchMessageResponse]
    total_message_count: int


async def resolve_group_messages(
    conn: asyncpg.Connection,
    *,
    group_id: UUID,
    page_limit: int = 50,
    page_offset: int = 0,
) -> GroupMessagesResult | None:
    """Fetch paginated messages for a group using canonical black boxes.

    Returns None if the group is not found.
    """
    # Step 1: Get group info
    groups = await get_groups(conn, [group_id])
    if not groups:
        return None

    group = groups[0]

    # Step 2: Get run IDs for this group
    runs, _ = await search_runs(
        conn, group_ids=[group_id], limit=100000, bypass_mv=True
    )
    if not runs:
        return GroupMessagesResult(
            group_id=group.id,
            group_name=group.name,
            group_created_at=group.created_at,
            session_id=group.session_id,
            messages=[],
            total_message_count=0,
        )

    run_ids = [r.run_id for r in runs]

    # Step 3: Get paginated messages (user/assistant only)
    messages, total_count = await search_messages(
        conn,
        run_ids=run_ids,
        roles=["user", "assistant"],
        sort_order="asc",
        limit=page_limit,
        offset=page_offset,
        bypass_mv=True,
    )

    return GroupMessagesResult(
        group_id=group.id,
        group_name=group.name,
        group_created_at=group.created_at,
        session_id=group.session_id,
        messages=messages,
        total_message_count=total_count,
    )
