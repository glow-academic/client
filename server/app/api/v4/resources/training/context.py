"""Training attempt context resolver.

Pre-resolves all IDs needed for attempt creation from a training entry,
replacing the inline context resolution previously done inside create_attempt_v4 SQL.
"""

from dataclasses import dataclass
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetTrainingAttemptContextSqlParams,
    PrepareTrainingStartSqlParams,
    PrepareTrainingStartSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/training/get_training_attempt_context_complete.sql"
)

SQL_PATH_PREPARE_START = (
    "app/sql/v4/queries/generate/training/prepare_training_start_complete.sql"
)


@dataclass
class TrainingAttemptContext:
    """Pre-resolved IDs for attempt creation."""

    chat_entry_id: UUID
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
    chat_entry_id: UUID,
    bypass_cache: bool = False,
) -> TrainingAttemptContext:
    """Resolve all IDs needed before attempt creation.

    Args:
        conn: Database connection
        profile_id: The profile creating the attempt
        chat_entry_id: The training entry to resolve context for
        bypass_cache: Whether to bypass cache

    Returns:
        TrainingAttemptContext with all pre-resolved IDs
    """
    ck = cache_key(
        "resources/training/attempt_context",
        {"profile_id": str(profile_id), "chat_entry_id": str(chat_entry_id)},
    )

    if not bypass_cache:
        cached = await get_cached(ck)
        if cached:
            return TrainingAttemptContext(
                chat_entry_id=UUID(cached["chat_entry_id"]),
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
        p_chat_entry_id=chat_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row or not row.profiles_resource_id:
        raise ValueError(
            f"Training context not found for chat_entry_id={chat_entry_id}"
        )

    ctx = TrainingAttemptContext(
        chat_entry_id=row.chat_entry_id,
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
            "chat_entry_id": str(ctx.chat_entry_id),
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


async def prepare_training_start_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    chat_entry_id: UUID,
    department_id: UUID,
    draft_id: UUID | None = None,
) -> tuple[UUID | None, UUID | None]:
    """Call prepare_training_start SQL function.

    Creates a chat_resolved_entry (if missing) and populates canonical scope links
    (scenarios, rubrics, documents, etc.) from the scenario config.

    Returns (chat_resolved_id, scenario_id).
    """
    from typing import cast

    row = cast(
        PrepareTrainingStartSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_PREPARE_START,
            params=PrepareTrainingStartSqlParams(
                p_profile_id=profile_id,
                p_chat_entry_id=chat_entry_id,
                p_department_id=department_id,
                p_draft_id=draft_id,
            ),
        ),
    )

    if not row:
        return None, None

    return row.out_chat_resolved_id, row.out_scenario_id


async def check_resolved_needs_generation(
    conn: asyncpg.Connection,
    chat_resolved_id: UUID,
) -> bool:
    """Return True if the resolved entry is missing generated persona connections.

    The prepare_training_start SQL copies canonical scope links (scenarios, rubrics,
    documents, etc.) but does NOT create persona or parameter connections — those
    come from generation. If personas are empty, generation is needed.
    """
    row = await conn.fetchval(
        """
        SELECT COUNT(*) = 0
        FROM chat_resolved_profile_personas_connection
        WHERE chat_resolved_id = $1 AND active = true
        """,
        chat_resolved_id,
    )
    return bool(row)
