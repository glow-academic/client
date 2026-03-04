"""Eval benchmark entry sync — pre-create benchmark + invocation entries on eval save.

Insert-only. No reads from _entry tables. No deactivation of old entries.
All entries from the same sync share a canonical created_at timestamp (set in SQL).
"""

import asyncio
from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/queries/entries/benchmark_sync/sync_benchmark_entries_complete.sql"


class SyncBenchmarkEntriesSqlParams(BaseModel):
    """SQL parameters for syncing benchmark entries."""

    evals_resource_id: UUID
    department_ids: list[UUID]
    models: list[tuple[Any, ...]]
    invocations: list[tuple[Any, ...]]

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.evals_resource_id,
            self.department_ids,
            self.models,
            self.invocations,
        )


class SyncBenchmarkEntriesSqlRow(BaseModel):
    """SQL row returned from syncing benchmark entries."""

    entry_count: int | None = None


async def sync_benchmark_entries(
    conn: asyncpg.Connection,
    evals_resource_id: UUID,
    model_ids: list[UUID],
    model_flag_ids: list[UUID],
    model_rubric_ids: list[UUID],
    model_position_ids: list[UUID],
    department_ids: list[UUID],
) -> int:
    """Sync benchmark entries by pre-creating benchmark + invocation entries.

    Three-pass approach:
    1. Parallel fetch model_flags, model_rubrics, model_positions
    2. Group sub-resources by model_id
    3. Build composite tuples and call SQL function
    """
    from app.infra.globals import get_pool, get_redis_client
    from app.routes.v5.tools.resources.model_flags.get import get_model_flags
    from app.routes.v5.tools.resources.model_positions.get import (
        get_model_positions,
    )
    from app.routes.v5.tools.resources.model_rubrics.get import (
        get_model_rubrics,
    )

    if not model_ids:
        return 0

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # ── Pass 1: Parallel fetch all sub-resources ──
    async def _fetch_model_flags() -> list[Any]:
        async with pool.acquire() as c:
            return await get_model_flags(c, model_flag_ids, get_redis_client(), bypass_cache=True)

    async def _fetch_model_rubrics() -> list[Any]:
        async with pool.acquire() as c:
            return await get_model_rubrics(
                c, model_rubric_ids, get_redis_client(), bypass_cache=True
            )

    async def _fetch_model_positions() -> list[Any]:
        async with pool.acquire() as c:
            return await get_model_positions(
                c, model_position_ids, get_redis_client(), bypass_cache=True
            )

    gather_results = await asyncio.gather(
        _fetch_model_flags(),
        _fetch_model_rubrics(),
        _fetch_model_positions(),
    )
    model_flags: list[Any] = cast(list[Any], gather_results[0])
    model_rubrics: list[Any] = cast(list[Any], gather_results[1])
    model_positions: list[Any] = cast(list[Any], gather_results[2])

    # ── Pass 2: Group sub-resources by model_id ──

    # model_id → list of flag resource IDs
    flags_by_model: dict[UUID, list[UUID]] = {}
    for mf in model_flags:
        if mf.model_id and mf.id:
            mid = UUID(str(mf.model_id))
            flags_by_model.setdefault(mid, []).append(mf.id)

    # model_id → list of rubric resource IDs
    rubrics_by_model: dict[UUID, list[UUID]] = {}
    for mr in model_rubrics:
        if mr.model_id and mr.id:
            mid = UUID(str(mr.model_id))
            rubrics_by_model.setdefault(mid, []).append(mr.id)

    # model_id → list of position resource IDs + position values
    positions_by_model: dict[UUID, list[tuple[UUID, int]]] = {}
    for mp in model_positions:
        if mp.model_id and mp.id:
            mid = UUID(str(mp.model_id))
            positions_by_model.setdefault(mid, []).append(
                (mp.id, mp.value if mp.value is not None else 0)
            )

    # ── Pass 3: Build composite tuples ──

    # Build model tuples: (resource_id, position, position_resource_ids[], rubric_resource_ids[], flag_resource_ids[])
    model_tuples: list[tuple[Any, ...]] = []
    for model_id in model_ids:
        # Get position value (first position for this model, or 0)
        position = 0
        position_resource_ids: list[UUID] = []
        for pos_id, pos_val in positions_by_model.get(model_id, []):
            position_resource_ids.append(pos_id)
            position = pos_val  # Use last position value

        rubric_resource_ids = rubrics_by_model.get(model_id, [])
        flag_resource_ids = flags_by_model.get(model_id, [])

        model_tuples.append(
            (
                model_id,
                position,
                position_resource_ids,
                rubric_resource_ids,
                flag_resource_ids,
            )
        )

    # Build invocation tuples: one per model
    # (model_index, model_flag_ids[], model_rubric_ids[], model_position_ids[])
    invocation_tuples: list[tuple[Any, ...]] = []
    for idx, model_id in enumerate(model_ids):
        model_index = idx + 1  # 1-based index into models array
        inv_flag_ids = flags_by_model.get(model_id, [])
        inv_rubric_ids = rubrics_by_model.get(model_id, [])
        inv_position_ids = [pid for pid, _ in positions_by_model.get(model_id, [])]

        invocation_tuples.append(
            (
                model_index,
                inv_flag_ids,
                inv_rubric_ids,
                inv_position_ids,
            )
        )

    # ── Execute SQL ──
    params = SyncBenchmarkEntriesSqlParams(
        evals_resource_id=evals_resource_id,
        department_ids=department_ids or [],
        models=model_tuples,
        invocations=invocation_tuples,
    )

    result = cast(
        SyncBenchmarkEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    return result.entry_count if result and result.entry_count else 0
