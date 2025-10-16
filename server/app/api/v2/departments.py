"""Department v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.repositories.department_repository import get_department_repository
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

router = APIRouter()


@router.post("/list", response_model=DepartmentsListResponse)
async def list_departments(
    filters: DepartmentsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentsListResponse:
    """Get list of departments with computed fields."""
    repo = get_department_repository(conn)
    return await repo.get_departments_list(filters)


@router.post("/detail", response_model=DepartmentDetailResponse)
async def get_department_detail(
    request: DepartmentDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get department detail with agent role assignments."""
    repo = get_department_repository(conn)
    return await repo.get_department_detail(request)


@router.post("/detail-default", response_model=DepartmentDetailResponse)
async def get_department_detail_default(
    request: DepartmentDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get default department detail for a profile."""
    repo = get_department_repository(conn)
    return await repo.get_department_detail_default(request.profileId)


@router.post("/create", response_model=CreateDepartmentResponse)
async def create_department(
    request: CreateDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDepartmentResponse:
    """Create a new department with agent role assignments."""
    repo = get_department_repository(conn)
    return await repo.create_department(request)


@router.post("/update", response_model=UpdateDepartmentResponse)
async def update_department(
    request: UpdateDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDepartmentResponse:
    """Update a department with agent role assignments."""
    repo = get_department_repository(conn)
    return await repo.update_department(request)


@router.post("/duplicate", response_model=DuplicateDepartmentResponse)
async def duplicate_department(
    request: DuplicateDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentResponse:
    """Duplicate a department with all agent role assignments."""
    repo = get_department_repository(conn)
    return await repo.duplicate_department(request)


@router.post("/delete", response_model=DeleteDepartmentResponse)
async def delete_department(
    request: DeleteDepartmentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDepartmentResponse:
    """Delete a department (with usage check)."""
    repo = get_department_repository(conn)
    return await repo.delete_department(request)
