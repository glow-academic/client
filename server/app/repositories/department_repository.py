"""Department repository - thin wrapper around service."""

import asyncpg  # type: ignore
from app.schemas.departments import (CreateDepartmentRequest,
                                     CreateDepartmentResponse,
                                     DeleteDepartmentRequest,
                                     DeleteDepartmentResponse,
                                     DepartmentDetailRequest,
                                     DepartmentDetailResponse,
                                     DepartmentsFilters,
                                     DepartmentsListResponse,
                                     DuplicateDepartmentRequest,
                                     DuplicateDepartmentResponse,
                                     UpdateDepartmentRequest,
                                     UpdateDepartmentResponse)
from app.services.department_service import DepartmentService


class DepartmentRepository:
    """Repository for department operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = DepartmentService(conn)

    async def get_departments_list(
        self, filters: DepartmentsFilters
    ) -> DepartmentsListResponse:
        """Get list of departments."""
        return await self.service.get_departments_list(filters)

    async def get_department_detail(
        self, request: DepartmentDetailRequest
    ) -> DepartmentDetailResponse:
        """Get department detail."""
        return await self.service.get_department_detail(request)

    async def get_department_detail_default(
        self, profile_id: str
    ) -> DepartmentDetailResponse:
        """Get default department detail for a profile."""
        return await self.service.get_department_detail_default(profile_id)

    async def create_department(
        self, request: CreateDepartmentRequest
    ) -> CreateDepartmentResponse:
        """Create a new department."""
        return await self.service.create_department(request)

    async def update_department(
        self, request: UpdateDepartmentRequest
    ) -> UpdateDepartmentResponse:
        """Update a department."""
        return await self.service.update_department(request)

    async def duplicate_department(
        self, request: DuplicateDepartmentRequest
    ) -> DuplicateDepartmentResponse:
        """Duplicate a department."""
        return await self.service.duplicate_department(request)

    async def delete_department(
        self, request: DeleteDepartmentRequest
    ) -> DeleteDepartmentResponse:
        """Delete a department."""
        return await self.service.delete_department(request)


def get_department_repository(conn: asyncpg.Connection) -> DepartmentRepository:
    """Get department repository instance."""
    return DepartmentRepository(conn)
