"""Department repository - thin wrapper around service."""

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
from sqlalchemy.ext.asyncio import AsyncSession


class DepartmentRepository:
    """Repository for department operations."""

    def __init__(self) -> None:
        """Initialize repository with service."""
        self.service = DepartmentService()

    async def get_departments_list(
        self, filters: DepartmentsFilters, session: AsyncSession
    ) -> DepartmentsListResponse:
        """Get list of departments."""
        return await self.service.get_departments_list(filters, session)

    async def get_department_detail(
        self, request: DepartmentDetailRequest, session: AsyncSession
    ) -> DepartmentDetailResponse:
        """Get department detail."""
        return await self.service.get_department_detail(request, session)

    async def get_department_detail_default(
        self, profile_id: str, session: AsyncSession
    ) -> DepartmentDetailResponse:
        """Get default department detail for a profile."""
        return await self.service.get_department_detail_default(profile_id, session)

    async def create_department(
        self, request: CreateDepartmentRequest, session: AsyncSession
    ) -> CreateDepartmentResponse:
        """Create a new department."""
        return await self.service.create_department(request, session)

    async def update_department(
        self, request: UpdateDepartmentRequest, session: AsyncSession
    ) -> UpdateDepartmentResponse:
        """Update a department."""
        return await self.service.update_department(request, session)

    async def duplicate_department(
        self, request: DuplicateDepartmentRequest, session: AsyncSession
    ) -> DuplicateDepartmentResponse:
        """Duplicate a department."""
        return await self.service.duplicate_department(request, session)

    async def delete_department(
        self, request: DeleteDepartmentRequest, session: AsyncSession
    ) -> DeleteDepartmentResponse:
        """Delete a department."""
        return await self.service.delete_department(request, session)

