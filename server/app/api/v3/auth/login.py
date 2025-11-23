"""Auth login endpoint - returns list of active provider slugs."""

from typing import Annotated

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends
from pydantic import BaseModel


class LoginProvidersResponse(BaseModel):
    """Response with list of active provider slugs (used as kc_idp_hint)."""

    providers: list[str]


router = APIRouter()


@router.get("/login", response_model=LoginProvidersResponse)
async def get_login_providers(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LoginProvidersResponse:
    """Get list of active auth provider slugs for login page."""
    sql_query = load_sql("sql/v3/auth/get_login_providers.sql")
    rows = await conn.fetch(sql_query)
    providers = [row["id"] for row in rows]  # id is the slug alias from SQL
    return LoginProvidersResponse(providers=providers)

