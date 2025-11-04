"""Analytics refresh v3 API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

router = APIRouter()


class RefreshResponse(BaseModel):
    """Materialized view refresh response."""

    success: bool
    message: str
    status: str


@router.post("/refresh")
async def refresh_analytics(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    try:
        sql = load_sql("sql/v3/analytics/refresh_materialized_view.sql")
        await conn.execute(sql)
        return RefreshResponse(
            success=True,
            message="Analytics materialized view refreshed successfully",
            status="success",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
