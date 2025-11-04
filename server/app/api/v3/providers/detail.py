"""Provider detail endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class ProviderDetailRequest(BaseModel):
    providerId: str
    profileId: str


class ProviderDetailResponse(BaseModel):
    name: str
    description: str
    api_key: str
    base_url: str | None


router = APIRouter()


@router.post("/detail")
async def get_provider_detail(
    request: ProviderDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderDetailResponse:
    """Get detailed provider information."""
    try:
        sql = load_sql("sql/v3/providers/get_provider_detail_complete.sql")
        provider = await conn.fetchrow(sql, request.providerId)

        if not provider:
            raise HTTPException(status_code=404, detail=f"Provider not found: {request.providerId}")

        return ProviderDetailResponse(
            name=provider["name"],
            description=provider["description"],
            api_key=provider["api_key"],  # Returned encrypted
            base_url=provider["base_url"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

