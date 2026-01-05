"""Resolve profile ID from department cookies."""

from typing import cast

import asyncpg  # type: ignore
from utils.sql_helper import execute_sql_typed

from app.sql.types import (
    InfraResolveFromDepartmentProfileSqlParams,
    InfraResolveFromDepartmentProfileSqlRow,
)

SQL_PATH = "app/sql/v4/infrastructure/infrastructure_profile_resolve_from_department_complete.sql"


async def resolve_profile_from_department(
    department_id: str | None,
    auth_mode: str,
    conn: asyncpg.Connection,
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie ("default-guest" or "default-account")
        conn: Database connection

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    if not auth_mode or auth_mode not in ("default-guest", "default-account"):
        return None

    params = InfraResolveFromDepartmentProfileSqlParams(
        department_id=department_id or "",
        auth_mode=auth_mode,
    )
    result = cast(
        InfraResolveFromDepartmentProfileSqlRow | None,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
    if result is None or result.resolved_profile_id is None:
        return None
    return str(result.resolved_profile_id)
