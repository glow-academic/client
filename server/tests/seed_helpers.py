"""Minimal helpers to query CS seed data using typed SQL functions."""

import asyncpg  # type: ignore
from tests.sql.types import (
    GetCsDeptIdSqlRow,
    GetSuperadminAliasSqlParams,
    GetSuperadminAliasSqlRow,
)
from app.utils.sql_helper import execute_sql_typed


async def get_cs_dept_id(conn: asyncpg.Connection) -> str:
    """Get CS department ID from seed data using typed SQL function."""
    result = await execute_sql_typed(
        conn=conn,
        sql_path="tests/sql/v4/integration/helpers/test_get_cs_dept_id_v4_complete.sql",
        params=None,
    )
    typed_result = GetCsDeptIdSqlRow.model_validate(result.model_dump())
    dept_id = typed_result.department_id
    if not dept_id:
        raise ValueError("CS department not found in seed data")
    return str(dept_id)


async def get_superadmin_email(
    conn: asyncpg.Connection, email: str = "redacted@purdue.edu"
) -> str:
    """Get superadmin ID by email using typed SQL function."""
    params = GetSuperadminAliasSqlParams(email=email)
    result = await execute_sql_typed(
        conn=conn,
        sql_path="tests/sql/v4/integration/helpers/test_get_superadmin_alias_v4_complete.sql",
        params=params,
    )
    typed_result = GetSuperadminAliasSqlRow.model_validate(result.model_dump())
    profile_id = typed_result.profile_id
    if not profile_id:
        raise ValueError(f"Profile with email {email} not found in seed data")
    return str(profile_id)


# Alias for backward compatibility
get_superadmin_alias = get_superadmin_email
