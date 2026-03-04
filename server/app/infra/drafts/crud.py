"""Generic CRUD for all *_drafts_entry tables.

All drafts tables have identical schemas:
  id, version, created_at, generated, mcp, active, group_id, session_id

This module provides create, get, and search as parameterized functions
that accept the table name.
"""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.drafts.types import CreateDraftResponse, GetDraftResponse

# Allowlist of valid drafts table names to prevent SQL injection
VALID_TABLES = frozenset(
    [
        "agent_drafts_entry",
        "auth_drafts_entry",
        "chat_drafts_entry",
        "cohort_drafts_entry",
        "department_drafts_entry",
        "document_drafts_entry",
        "eval_drafts_entry",
        "field_drafts_entry",
        "invocation_drafts_entry",
        "model_drafts_entry",
        "parameter_drafts_entry",
        "persona_drafts_entry",
        "profile_drafts_entry",
        "provider_drafts_entry",
        "rubric_drafts_entry",
        "scenario_drafts_entry",
        "setting_drafts_entry",
        "simulation_drafts_entry",
        "tool_drafts_entry",
    ]
)


def _validate_table(table: str) -> str:
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid drafts table: {table}")
    return table


async def create_draft(
    conn: asyncpg.Connection,
    table: str,
    group_id: UUID,
    session_id: UUID,
    version: int = 0,
    mcp: bool = False,
) -> CreateDraftResponse:
    """Create a draft entry in the specified drafts table."""
    t = _validate_table(table)

    draft_id = await conn.fetchval(
        f"""
        INSERT INTO {t} (group_id, session_id, version, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        group_id,
        session_id,
        version,
        mcp,
    )

    if draft_id is None:
        raise ValueError(f"Failed to create draft in {t}")

    return CreateDraftResponse(id=draft_id)


async def get_drafts(
    conn: asyncpg.Connection,
    table: str,
    ids: list[UUID],
) -> list[GetDraftResponse]:
    """Get draft entries by IDs."""
    if not ids:
        return []

    t = _validate_table(table)

    rows = await conn.fetch(
        f"""
        SELECT id, version, group_id, session_id, created_at, active, mcp, generated
        FROM {t}
        WHERE id = ANY($1)
        """,
        ids,
    )

    return [
        GetDraftResponse(
            id=r["id"],
            version=r["version"],
            group_id=r["group_id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]


async def search_drafts(
    conn: asyncpg.Connection,
    table: str,
    group_id: UUID | None = None,
    session_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    mcp: bool | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetDraftResponse]:
    """Search drafts with declarative filters."""
    t = _validate_table(table)

    rows = await conn.fetch(
        f"""
        SELECT id, version, group_id, session_id, created_at, active, mcp, generated
        FROM {t}
        WHERE ($1::uuid IS NULL OR group_id = $1)
          AND ($2::uuid IS NULL OR session_id = $2)
          AND ($3::timestamptz IS NULL OR created_at >= $3)
          AND ($4::timestamptz IS NULL OR created_at <= $4)
          AND ($5::boolean IS NULL OR mcp = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        """,
        group_id,
        session_id,
        date_from,
        date_to,
        mcp,
        limit,
        offset,
    )

    return [
        GetDraftResponse(
            id=r["id"],
            version=r["version"],
            group_id=r["group_id"],
            session_id=r["session_id"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]
