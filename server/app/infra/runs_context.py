"""Resolve runs context — today's runs for a profile.

Given a profile_id, fetches today's runs.

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal


@dataclass(frozen=True)
class RunsContext:
    """Today's runs for a profile."""

    runs: object  # GetRunListViewResponse


async def resolve_runs_context(
    conn: asyncpg.Connection,
    *,
    profile_id: UUID,
    group_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> RunsContext:
    """Resolve today's runs for a profile.

    Defaults date_from and date_to to today if not provided.
    """
    now = datetime.now(UTC)
    start = date_from or now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = date_to or now

    runs = await get_run_list_entries_internal(
        conn,
        group_id_filter=group_id,
        date_from=start,
        date_to=end,
        profile_id_filter=profile_id,
    )

    return RunsContext(
        runs=runs,
    )
