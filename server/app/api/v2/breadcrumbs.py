"""Breadcrumb API endpoints."""

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.profile import (BreadcrumbItem, BreadcrumbsRequest,
                                 BreadcrumbsResponse)
from app.services.breadcrumb_service import BreadcrumbService
from fastapi import APIRouter, Depends

router = APIRouter()


@router.post("/breadcrumbs", response_model=BreadcrumbsResponse)
async def get_breadcrumbs(
    request: BreadcrumbsRequest, conn: asyncpg.Connection = Depends(get_db)
) -> BreadcrumbsResponse:
    """Get breadcrumbs for a given pathname.
    
    Generates breadcrumbs from URL path and enriches with database entity names.
    
    Args:
        request: BreadcrumbsRequest with pathname
        conn: Database connection from dependency injection
        
    Returns:
        BreadcrumbsResponse with list of breadcrumb items
    """
    service = BreadcrumbService(conn)
    breadcrumbs = await service.generate_breadcrumbs(request.pathname)
    return BreadcrumbsResponse(breadcrumbs=breadcrumbs)

