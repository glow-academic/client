"""Staff repository - thin wrapper around staff service."""

from app.schemas.staff import (BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from app.services.staff_service import StaffService
from sqlalchemy.orm import Session


class StaffRepository:
    """Repository for staff data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = StaffService(db)

    def get_staff_list(self, filters: StaffFilters) -> StaffListResponse:
        """Get staff list."""
        return self.service.get_staff_list(filters)

    def get_staff_detail(self, request: StaffDetailRequest) -> StaffDetailResponse:
        """Get staff detail."""
        return self.service.get_staff_detail(request)

    def get_staff_detail_bulk(
        self, request: StaffDetailBulkRequest
    ) -> StaffDetailBulkResponse:
        """Get staff detail bulk."""
        return self.service.get_staff_detail_bulk(request)

    def update_staff(self, request: UpdateStaffRequest) -> UpdateStaffResponse:
        """Update staff."""
        return self.service.update_staff(request)

    def bulk_update_staff(
        self, request: BulkUpdateStaffRequest
    ) -> BulkUpdateStaffResponse:
        """Bulk update staff."""
        return self.service.bulk_update_staff(request)

    def delete_staff(self, request: DeleteStaffRequest) -> DeleteStaffResponse:
        """Delete staff."""
        return self.service.delete_staff(request)

    def bulk_delete_staff(
        self, request: BulkDeleteStaffRequest
    ) -> BulkDeleteStaffResponse:
        """Bulk delete staff."""
        return self.service.bulk_delete_staff(request)


def get_staff_repository(db: Session) -> StaffRepository:
    """Dependency injection for staff repository."""
    return StaffRepository(db)

