"""Department v2 API endpoints."""

from app.db import get_session
from app.repositories.department_repository import DepartmentRepository
from app.schemas.departments import (CreateDepartmentRequest,
                                     CreateDepartmentResponse,
                                     DeleteDepartmentRequest,
                                     DeleteDepartmentResponse,
                                     DepartmentDetailDefaultRequest,
                                     DepartmentDetailRequest,
                                     DepartmentDetailResponse,
                                     DepartmentsFilters,
                                     DepartmentsListResponse,
                                     DuplicateDepartmentRequest,
                                     DuplicateDepartmentResponse,
                                     UpdateDepartmentRequest,
                                     UpdateDepartmentResponse)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/list", response_model=DepartmentsListResponse)
async def list_departments(
    filters: DepartmentsFilters,
    session: AsyncSession = Depends(get_session),
) -> DepartmentsListResponse:
    """Get list of departments with computed fields."""
    repo = DepartmentRepository()
    return await repo.get_departments_list(filters, session)


@router.post("/detail", response_model=DepartmentDetailResponse)
async def get_department_detail(
    request: DepartmentDetailRequest,
    session: AsyncSession = Depends(get_session),
) -> DepartmentDetailResponse:
    """Get department detail with agent role assignments."""
    repo = DepartmentRepository()
    return await repo.get_department_detail(request, session)


@router.post("/detail-default", response_model=DepartmentDetailResponse)
async def get_department_detail_default(
    request: DepartmentDetailDefaultRequest,
    session: AsyncSession = Depends(get_session),
) -> DepartmentDetailResponse:
    """Get default department detail for a profile."""
    repo = DepartmentRepository()
    return await repo.get_department_detail_default(request.profileId, session)


@router.post("/create", response_model=CreateDepartmentResponse)
async def create_department(
    request: CreateDepartmentRequest,
    session: AsyncSession = Depends(get_session),
) -> CreateDepartmentResponse:
    """Create a new department with agent role assignments."""
    repo = DepartmentRepository()
    return await repo.create_department(request, session)


@router.post("/update", response_model=UpdateDepartmentResponse)
async def update_department(
    request: UpdateDepartmentRequest,
    session: AsyncSession = Depends(get_session),
) -> UpdateDepartmentResponse:
    """Update a department with agent role assignments."""
    repo = DepartmentRepository()
    return await repo.update_department(request, session)


@router.post("/duplicate", response_model=DuplicateDepartmentResponse)
async def duplicate_department(
    request: DuplicateDepartmentRequest,
    session: AsyncSession = Depends(get_session),
) -> DuplicateDepartmentResponse:
    """Duplicate a department with all agent role assignments."""
    repo = DepartmentRepository()
    return await repo.duplicate_department(request, session)


@router.post("/delete", response_model=DeleteDepartmentResponse)
async def delete_department(
    request: DeleteDepartmentRequest,
    session: AsyncSession = Depends(get_session),
) -> DeleteDepartmentResponse:
    """Delete a department (with usage check)."""
    repo = DepartmentRepository()
    return await repo.delete_department(request, session)

