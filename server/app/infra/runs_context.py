"""Resolve runs context — today's runs + debug info for a profile.

Given a profile_id, fetches today's runs and associated debug info entries.

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.debug_info.search import search_debug_info
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal


@dataclass(frozen=True)
class RunsContext:
    """Today's runs + debug info for a profile."""

    runs: object  # GetRunListViewResponse
    debug_info: list  # list[GetDebugInfoResponse]


async def resolve_runs_context(
    conn: asyncpg.Connection,
    *,
    profile_id: UUID,
    group_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> RunsContext:
    """Resolve today's runs and debug info for a profile.

    Defaults date_from and date_to to today if not provided.
    """
    now = datetime.now(UTC)
    start = date_from or now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = date_to or now

    runs, debug_info = await asyncio.gather(
        get_run_list_entries_internal(
            conn,
            group_id_filter=group_id,
            date_from=start,
            date_to=end,
            profile_id_filter=profile_id,
        ),
        search_debug_info(
            conn,
            date_from=start,
            date_to=end,
        ),
    )

    return RunsContext(
        runs=runs,
        debug_info=debug_info,
    )
