"""Field detail default endpoint for edit mode."""

from app.api.v3.fields.detail import (
    FieldDetailRequest,
    FieldDetailResponse,
    get_field_detail,
)
from fastapi import APIRouter, Depends, Request, Response
from typing import Annotated
import asyncpg  # type: ignore
from app.main import get_db

router = APIRouter()


@router.post("/detail_default", response_model=FieldDetailResponse)
async def get_field_detail_default(
    request: FieldDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FieldDetailResponse:
    """Get default field detail for edit mode (same as detail)."""
    # For fields, detail_default is the same as detail
    return await get_field_detail(request, http_request, response, conn)

