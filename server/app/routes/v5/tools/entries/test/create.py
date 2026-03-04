"""Test CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.test.types import CreateTestResponse


async def create_test(
    conn: asyncpg.Connection,
    call_id: UUID,
    profiles_id: UUID,
    name: str = "",
    description: str = "",
    num_invocations: int = 0,
    infinite_mode: bool = False,
    mcp: bool = False,
) -> CreateTestResponse:
    """Create a test entry with profiles connection."""
    test_id = await conn.fetchval(
        """
        INSERT INTO test_entry (
            call_id, name, description, num_invocations,
            infinite_mode, mcp, generated
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
        """,
        call_id,
        name,
        description,
        num_invocations,
        infinite_mode,
        mcp,
    )

    if test_id is None:
        raise ValueError("Failed to create test entry")

    # test_profiles_connection (LEFT JOIN in test_mv but needed for access)
    await conn.execute(
        """
        INSERT INTO test_profiles_connection (attempt_id, profiles_id, generated)
        VALUES ($1, $2, true)
        """,
        test_id,
        profiles_id,
    )

    return CreateTestResponse(id=test_id)
