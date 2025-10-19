"""Minimal helpers to query CS seed data."""

import asyncpg  # type: ignore


async def get_cs_dept_id(conn: asyncpg.Connection) -> str:
    """Get CS department ID from seed data."""
    dept_id = await conn.fetchval(
        "SELECT id FROM departments WHERE title = 'Computer Science' LIMIT 1"
    )
    if not dept_id:
        raise ValueError("CS department not found in seed data")
    return str(dept_id)


async def get_superadmin_alias(
    conn: asyncpg.Connection, alias: str = "sarava18"
) -> str:
    """Get superadmin ID by alias."""
    profile_id = await conn.fetchval("SELECT id FROM profiles WHERE alias = $1", alias)
    if not profile_id:
        raise ValueError(f"Profile with alias {alias} not found in seed data")
    return str(profile_id)
