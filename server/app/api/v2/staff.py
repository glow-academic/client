"""Staff v2 API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.staff_repository import get_staff_repository
from app.schemas.staff import (BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("/list", response_model=StaffListResponse)
async def get_staff_list(
    filters: StaffFilters,
    db: Annotated[Session, Depends(get_session)],
) -> StaffListResponse:
    """Get staff list with permissions and relationships."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=StaffDetailResponse)
async def get_staff_detail(
    request: StaffDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> StaffDetailResponse:
    """Get detailed staff information."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-bulk", response_model=StaffDetailBulkResponse)
async def get_staff_detail_bulk(
    request: StaffDetailBulkRequest,
    db: Annotated[Session, Depends(get_session)],
) -> StaffDetailBulkResponse:
    """Get bulk staff detail information."""
    try:
        repo = get_staff_repository(db)
        return repo.get_staff_detail_bulk(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateStaffResponse)
async def update_staff(
    request: UpdateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateStaffResponse:
    """Update a staff member."""
    try:
        repo = get_staff_repository(db)
        return repo.update_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=BulkUpdateStaffResponse)
async def bulk_update_staff(
    request: BulkUpdateStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> BulkUpdateStaffResponse:
    """Bulk update staff members."""
    try:
        repo = get_staff_repository(db)
        return repo.bulk_update_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteStaffResponse)
async def delete_staff(
    request: DeleteStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteStaffResponse:
    """Delete a staff member."""
    try:
        repo = get_staff_repository(db)
        return repo.delete_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=BulkDeleteStaffResponse)
async def bulk_delete_staff(
    request: BulkDeleteStaffRequest,
    db: Annotated[Session, Depends(get_session)],
) -> BulkDeleteStaffResponse:
    """Bulk delete staff members."""
    try:
        repo = get_staff_repository(db)
        return repo.bulk_delete_staff(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

