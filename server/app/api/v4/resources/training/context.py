"""Training attempt context resolver.

Pre-resolves all IDs needed for attempt creation from a training entry,
replacing the inline context resolution previously done inside create_attempt_v4 SQL.
"""

from dataclasses import dataclass
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetTrainingAttemptContextSqlParams,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/training/get_training_attempt_context_complete.sql"
)


@dataclass
class TrainingAttemptContext:
    """Pre-resolved IDs for attempt creation."""

    training_entry_id: UUID
    is_practice: bool
    practice_id: UUID | None
    home_id: UUID | None
    simulations_resource_id: UUID | None
    profiles_resource_id: UUID
    cohorts_resource_id: UUID | None
    departments_resource_id: UUID | None
    roles_resource_id: UUID | None


async def get_training_attempt_context_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_entry_id: UUID,
    bypass_cache: bool = False,
) -> TrainingAttemptContext:
    """Resolve all IDs needed before attempt creation.

    Args:
        conn: Database connection
        profile_id: The profile creating the attempt
        training_entry_id: The training entry to resolve context for
        bypass_cache: Whether to bypass cache

    Returns:
        TrainingAttemptContext with all pre-resolved IDs
    """
    ck = cache_key(
        "resources/training/attempt_context",
        {"profile_id": str(profile_id), "training_entry_id": str(training_entry_id)},
    )

    if not bypass_cache:
        cached = await get_cached(ck)
        if cached:
            return TrainingAttemptContext(
                training_entry_id=UUID(cached["training_entry_id"]),
                is_practice=cached["is_practice"],
                practice_id=UUID(cached["practice_id"])
                if cached.get("practice_id")
                else None,
                home_id=UUID(cached["home_id"]) if cached.get("home_id") else None,
                simulations_resource_id=UUID(cached["simulations_resource_id"])
                if cached.get("simulations_resource_id")
                else None,
                profiles_resource_id=UUID(cached["profiles_resource_id"]),
                cohorts_resource_id=UUID(cached["cohorts_resource_id"])
                if cached.get("cohorts_resource_id")
                else None,
                departments_resource_id=UUID(cached["departments_resource_id"])
                if cached.get("departments_resource_id")
                else None,
                roles_resource_id=UUID(cached["roles_resource_id"])
                if cached.get("roles_resource_id")
                else None,
            )

    params = GetTrainingAttemptContextSqlParams(
        p_profile_id=profile_id,
        p_training_entry_id=training_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row or not row.profiles_resource_id:
        raise ValueError(
            f"Training context not found for training_entry_id={training_entry_id}"
        )

    ctx = TrainingAttemptContext(
        training_entry_id=row.training_entry_id,
        is_practice=row.is_practice or False,
        practice_id=row.practice_id,
        home_id=row.home_id,
        simulations_resource_id=row.simulations_resource_id,
        profiles_resource_id=row.profiles_resource_id,
        cohorts_resource_id=row.cohorts_resource_id,
        departments_resource_id=row.departments_resource_id,
        roles_resource_id=row.roles_resource_id,
    )

    await set_cached(
        ck,
        {
            "training_entry_id": str(ctx.training_entry_id),
            "is_practice": ctx.is_practice,
            "practice_id": str(ctx.practice_id) if ctx.practice_id else None,
            "home_id": str(ctx.home_id) if ctx.home_id else None,
            "simulations_resource_id": str(ctx.simulations_resource_id)
            if ctx.simulations_resource_id
            else None,
            "profiles_resource_id": str(ctx.profiles_resource_id),
            "cohorts_resource_id": str(ctx.cohorts_resource_id)
            if ctx.cohorts_resource_id
            else None,
            "departments_resource_id": str(ctx.departments_resource_id)
            if ctx.departments_resource_id
            else None,
            "roles_resource_id": str(ctx.roles_resource_id)
            if ctx.roles_resource_id
            else None,
        },
        ttl=300,
        tags=["training", "attempt"],
    )

    return ctx
