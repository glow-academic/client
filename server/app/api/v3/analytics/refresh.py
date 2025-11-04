"""Analytics refresh v3 API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class RefreshRequest(BaseModel):
    """Request to refresh analytics (no parameters needed)."""
    pass


class RefreshResponse(BaseModel):
    """Materialized view refresh response."""

    success: bool
    message: str
    status: str


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics(
    request: RefreshRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    tags = ["analytics"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/analytics/refresh_materialized_view.sql")
        await conn.execute(sql)
        
        result_data = RefreshResponse(
            success=True,
            message="Analytics materialized view refreshed successfully",
            status="success",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
