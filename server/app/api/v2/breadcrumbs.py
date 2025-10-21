"""Breadcrumb API endpoints."""

from app.schemas.profile import (BreadcrumbItem, BreadcrumbsRequest,
                                 BreadcrumbsResponse)
from app.services.breadcrumb_service import BreadcrumbService
from fastapi import APIRouter

router = APIRouter()


@router.post("/breadcrumbs", response_model=BreadcrumbsResponse)
async def get_breadcrumbs(request: BreadcrumbsRequest) -> BreadcrumbsResponse:
    """Get breadcrumbs for a given pathname.
    
    This is a lightweight endpoint that generates breadcrumbs from URL path.
    No database queries needed - pure string manipulation.
    
    Args:
        request: BreadcrumbsRequest with pathname
        
    Returns:
        BreadcrumbsResponse with list of breadcrumb items
    """
    service = BreadcrumbService()
    breadcrumbs = service.generate_breadcrumbs(request.pathname)
    return BreadcrumbsResponse(breadcrumbs=breadcrumbs)

