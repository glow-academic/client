"""Helper functions for socket integration tests."""

import asyncpg  # type: ignore


async def create_test_profile(
    db: asyncpg.Connection,
    role: str = "member",
    first_name: str = "Test",
    last_name: str = "User",
    email: str | None = None,
) -> str:
    """Create a test profile."""
    import time

    test_email = email or f"test_{role}_{int(time.time())}@purdue.edu"
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, active) "
        "VALUES ($1, $2, $3, true) RETURNING id",
        first_name,
        last_name,
        role,
    )
    # Insert email into profile_emails
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES ($1, $2, true, true)",
        profile_id,
        test_email,
    )
    return str(profile_id)


async def create_test_department(
    db: asyncpg.Connection,
    title: str = "Test Department",
    description: str = "Test Department Description",
) -> str:
    """Create a test department."""
    dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) VALUES ($1, $2, true) RETURNING id",
        title,
        description,
    )
    return str(dept_id)


async def get_or_create_test_profile(
    db: asyncpg.Connection, email: str = "redacted@purdue.edu"
) -> str:
    """Get existing profile by email or create a new one."""
    profile_id = await db.fetchval(
        "SELECT profile_id FROM profile_emails WHERE email = $1 AND active = true",
        email,
    )
    if profile_id:
        return str(profile_id)

    # Create new profile
    return await create_test_profile(db, role="superadmin", email=email)


async def get_or_create_test_department(
    db: asyncpg.Connection, title: str = "Computer Science"
) -> str:
    """Get existing department by title or create a new one."""
    dept_id = await db.fetchval(
        "SELECT id FROM departments WHERE title = $1 LIMIT 1", title
    )
    if dept_id:
        return str(dept_id)

    # Create new department
    return await create_test_department(db, title=title)

