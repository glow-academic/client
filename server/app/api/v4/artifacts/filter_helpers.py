"""Shared MV-backed filter option queries for analytics artifacts."""

from uuid import UUID

import asyncpg

from app.api.v4.artifacts.types import FilterOption


async def fetch_cohort_filter_options(
    pool: asyncpg.Pool,
    accessible_cohort_ids: list[str],
) -> list[FilterOption]:
    """Fetch cohort filter options from mv_attempt_facts."""
    if not accessible_cohort_ids:
        return []
    async with pool.acquire() as c:
        rows = await c.fetch(
            """
            SELECT DISTINCT maf.cohort_id, cr.name, COUNT(*) as cnt
            FROM mv_attempt_facts maf
            JOIN cohorts_resource cr ON cr.id = maf.cohort_id
            WHERE maf.cohort_id = ANY($1::uuid[])
            GROUP BY maf.cohort_id, cr.name
            ORDER BY cr.name
            """,
            [UUID(cid) for cid in accessible_cohort_ids],
        )
        return [
            FilterOption(
                value=str(r["cohort_id"]),
                label=r["name"],
                count=r["cnt"],
            )
            for r in rows
        ]


async def fetch_department_filter_options(
    pool: asyncpg.Pool,
    accessible_department_ids: list[str],
) -> list[FilterOption]:
    """Fetch department filter options from mv_attempt_facts."""
    if not accessible_department_ids:
        return []
    async with pool.acquire() as c:
        rows = await c.fetch(
            """
            SELECT DISTINCT maf.department_id, dr.name, COUNT(*) as cnt
            FROM mv_attempt_facts maf
            JOIN departments_resource dr ON dr.id = maf.department_id
            WHERE maf.department_id = ANY($1::uuid[])
            GROUP BY maf.department_id, dr.name
            ORDER BY dr.name
            """,
            [UUID(did) for did in accessible_department_ids],
        )
        return [
            FilterOption(
                value=str(r["department_id"]),
                label=r["name"],
                count=r["cnt"],
            )
            for r in rows
        ]


async def fetch_date_range_from_mv(
    pool: asyncpg.Pool,
    accessible_department_ids: list[str],
) -> tuple[str | None, str | None]:
    """Fetch date range from mv_attempt_facts."""
    if not accessible_department_ids:
        return (None, None)
    async with pool.acquire() as c:
        row = await c.fetchrow(
            """
            SELECT
                MIN(attempt_created_at) as earliest,
                MAX(attempt_created_at) as latest
            FROM mv_attempt_facts
            WHERE department_id = ANY($1::uuid[])
            """,
            [UUID(did) for did in accessible_department_ids],
        )
        if row and row["earliest"]:
            return (
                row["earliest"].isoformat(),
                row["latest"].isoformat(),
            )
        return (None, None)
