"""Benchmark docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Entry tool docs — benchmark entries
  3. Permission functions — benchmark eval status
  4. API operations — all public route handlers introspected
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import ComposedDocsResponse
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.benchmark.docs import get_benchmark_docs


async def docs_benchmark_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Benchmark docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Entry docs fetch
      3. Assemble ComposedDocsResponse with permissions + API operations
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context -----------------------------------------------

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Entry docs ----------------------------------------------------

    (benchmark_entry,) = await asyncio.gather(
        get_benchmark_docs(conn),
    )

    # -- Step 3: Assemble response ---------------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.infra.benchmark_permissions import (
        compute_benchmark_eval_status,
    )
    from app.routes.v5.api.main.benchmark.export import export_benchmark
    from app.routes.v5.api.main.benchmark.get import get_benchmark
    from app.routes.v5.api.main.benchmark.refresh import benchmark_refresh
    from app.routes.v5.api.main.benchmark.search import search_benchmark_history

    return ComposedDocsResponse(
        name="benchmark",
        type="analytics",
        description=(
            "Benchmark analytics evaluates AI model performance across "
            "standardized test scenarios with scoring and comparison metrics."
        ),
        entries=[benchmark_entry],
        resources=[],
        permissions=[
            get_operation_info(
                compute_benchmark_eval_status,
                description="Compute eval card status from aggregated test invocation data.",
            ),
        ],
        api_operations=[
            get_operation_info(
                get_benchmark,
                description="POST /get — Get benchmark evaluation results.",
            ),
            get_operation_info(
                search_benchmark_history,
                description="POST /search — Search benchmark run history.",
            ),
            get_operation_info(
                benchmark_refresh,
                description="POST /refresh — Refresh benchmark materialized views.",
            ),
            get_operation_info(
                export_benchmark,
                description="POST /export — Export benchmark data as CSV/ZIP.",
            ),
        ],
    )
