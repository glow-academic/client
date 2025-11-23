"""Auth login endpoint - returns list of active provider options."""

from typing import Annotated

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends
from pydantic import BaseModel


class ProviderOption(BaseModel):
    """Provider option with id (slug), name, and icon URL."""

    id: str  # The slug (e.g., 'microsoft', 'google', 'purdue')
    name: str  # The display name (e.g., 'Microsoft', 'Google', 'Purdue University')
    icon: str | None  # The icon URL (can be None if no icon)


class LoginProvidersResponse(BaseModel):
    """Response with list of active provider options."""

    providers: list[ProviderOption]


router = APIRouter()


@router.get("/login", response_model=LoginProvidersResponse)
async def get_login_providers(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LoginProvidersResponse:
    """Get list of active auth provider options for login page."""
    sql_query = load_sql("sql/v3/auth/get_login_providers.sql")
    rows = await conn.fetch(sql_query)
    providers = [
        ProviderOption(id=row["id"], name=row["name"], icon=row["icon"])
        for row in rows
    ]
    return LoginProvidersResponse(providers=providers)

