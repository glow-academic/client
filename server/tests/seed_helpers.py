"""Minimal helpers returning well-known seed IDs.

These are constants from the test seed modules — no DB queries needed.
"""

# From database/modules/08-profiles/default-superadmin.sql (profile_artifact.id)
TEST_SUPERADMIN_PROFILE_ID = "019b3be4-36f0-788c-9df2-481eb5917940"

# From database/modules/10-setups/university/01-departments/ (department_artifact.id)
TEST_CS_DEPT_ID = "019b3be4-3247-7cb0-bd74-9b2467b5e32d"


async def get_cs_dept_id(conn: object) -> str:
    """Return CS department ID from seed data."""
    return TEST_CS_DEPT_ID


async def get_superadmin_email(conn: object, email: str = "") -> str:
    """Return superadmin profile ID from seed data."""
    return TEST_SUPERADMIN_PROFILE_ID


# Alias for backward compatibility
get_superadmin_alias = get_superadmin_email
