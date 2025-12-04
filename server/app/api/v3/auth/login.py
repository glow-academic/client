"""Auth login endpoint - returns list of active provider options."""

from typing import Annotated
from uuid import UUID

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel


class ProviderOption(BaseModel):
    """Provider option with id (slug), name, and icon URL."""

    id: str  # The slug (e.g., 'microsoft', 'google', 'purdue')
    name: str  # The display name (e.g., 'Microsoft', 'Google', 'Purdue University')
    icon: str | None  # The icon URL (can be None if no icon)
    is_default: bool  # Whether this is a default provider (no department links)


class LoginProvidersResponse(BaseModel):
    """Response with list of active provider options."""

    providers: list[ProviderOption]
    guest_login_enabled: bool
    show_default_account: bool  # Whether to show "continue as default account" button


router = APIRouter()


@router.get("/login", response_model=LoginProvidersResponse)
async def get_login_providers(
    department_id: UUID | None = Query(None, description="Optional department ID to filter providers"),
    conn: Annotated[asyncpg.Connection, Depends(get_db)] = Depends(get_db),
) -> LoginProvidersResponse:
    """Get list of active auth provider options for login page."""
    sql_query = load_sql("sql/v3/auth/get_login_providers.sql")
    rows = await conn.fetch(sql_query, department_id)
    providers = [
        ProviderOption(
            id=row["id"], 
            name=row["name"], 
            icon=row["icon"],
            is_default=row.get("is_default", False)
        )
        for row in rows
    ]
    # Get guest_login_enabled from first row (all rows have same value from CROSS JOIN)
    guest_login_enabled = rows[0]["guest_login_enabled"] if rows else True
    
    # Show "continue as default account" if no default providers exist
    has_default_providers = any(p.is_default for p in providers)
    show_default_account = not has_default_providers
    
    return LoginProvidersResponse(
        providers=providers, 
        guest_login_enabled=guest_login_enabled,
        show_default_account=show_default_account
    )

