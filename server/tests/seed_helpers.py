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


async def get_superadmin_email(
    conn: asyncpg.Connection, email: str = "redacted@purdue.edu"
) -> str:
    """Get superadmin ID by email."""
    profile_id = await conn.fetchval(
        "SELECT profile_id FROM profile_emails WHERE email = $1 AND active = true",
        email
    )
    if not profile_id:
        raise ValueError(f"Profile with email {email} not found in seed data")
    return str(profile_id)


# Alias for backward compatibility
get_superadmin_alias = get_superadmin_email
