"""Auth login endpoint - returns list of active provider names."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.main import get_db
from app.utils.sql_helper import load_sql


class LoginProvidersResponse(BaseModel):
    """Response with list of active provider names."""

    providers: list[str]


router = APIRouter()


@router.get("/login", response_model=LoginProvidersResponse)
async def get_login_providers(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LoginProvidersResponse:
    """Get list of active auth provider names for login page."""
    sql_query = load_sql("sql/v3/auth/get_login_providers.sql")
    rows = await conn.fetch(sql_query)
    providers = [row["name"] for row in rows]
    return LoginProvidersResponse(providers=providers)

