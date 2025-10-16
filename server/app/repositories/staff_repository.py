"""Staff repository - thin wrapper around staff service."""

import asyncpg  # type: ignore
from app.schemas.staff import (BulkCreateStaffRequest, BulkCreateStaffResponse,
                               BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               CreateStaffRequest, CreateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from app.services.staff_service import StaffService


class StaffRepository:
    """Repository for staff data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = StaffService(conn)

    async def get_staff_list(self, filters: StaffFilters) -> StaffListResponse:
        """Get staff list."""
        return await self.service.get_staff_list(filters)

    async def get_staff_detail(self, request: StaffDetailRequest) -> StaffDetailResponse:
        """Get staff detail."""
        return await self.service.get_staff_detail(request)

    async def get_staff_detail_bulk(
        self, request: StaffDetailBulkRequest
    ) -> StaffDetailBulkResponse:
        """Get staff detail bulk."""
        return await self.service.get_staff_detail_bulk(request)

    async def create_staff(self, request: CreateStaffRequest) -> CreateStaffResponse:
        """Create staff."""
        return await self.service.create_staff(request)

    async def bulk_create_staff(
        self, request: BulkCreateStaffRequest
    ) -> BulkCreateStaffResponse:
        """Bulk create staff."""
        return await self.service.bulk_create_staff(request)

    async def update_staff(self, request: UpdateStaffRequest) -> UpdateStaffResponse:
        """Update staff."""
        return await self.service.update_staff(request)

    async def bulk_update_staff(
        self, request: BulkUpdateStaffRequest
    ) -> BulkUpdateStaffResponse:
        """Bulk update staff."""
        return await self.service.bulk_update_staff(request)

    async def delete_staff(self, request: DeleteStaffRequest) -> DeleteStaffResponse:
        """Delete staff."""
        return await self.service.delete_staff(request)

    async def bulk_delete_staff(
        self, request: BulkDeleteStaffRequest
    ) -> BulkDeleteStaffResponse:
        """Bulk delete staff."""
        return await self.service.bulk_delete_staff(request)


def get_staff_repository(conn: asyncpg.Connection) -> StaffRepository:
    """Dependency injection for staff repository."""
    return StaffRepository(conn)
