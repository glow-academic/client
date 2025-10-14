"""Cohort repository - thin wrapper around cohort service."""

from app.schemas.cohorts import (CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse, UpdateCohortRequest,
                                 UpdateCohortResponse)
from app.services.cohort_service import CohortService
from sqlalchemy.orm import Session


class CohortRepository:
    """Repository for cohort data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = CohortService(db)

    def get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Get cohorts list."""
        return self.service.get_cohorts_list(filters)

    def get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Get cohort detail."""
        return self.service.get_cohort_detail(request)

    def get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Get default cohort detail."""
        return self.service.get_cohort_detail_default(request)

    def create_cohort(self, request: CreateCohortRequest) -> CreateCohortResponse:
        """Create cohort."""
        return self.service.create_cohort(request)

    def update_cohort(self, request: UpdateCohortRequest) -> UpdateCohortResponse:
        """Update cohort."""
        return self.service.update_cohort(request)

    def duplicate_cohort(
        self, request: DuplicateCohortRequest
    ) -> DuplicateCohortResponse:
        """Duplicate cohort."""
        return self.service.duplicate_cohort(request)

    def delete_cohort(self, request: DeleteCohortRequest) -> DeleteCohortResponse:
        """Delete cohort."""
        return self.service.delete_cohort(request)

    def leave_cohort(self, request: LeaveCohortRequest) -> LeaveCohortResponse:
        """Leave cohort."""
        return self.service.leave_cohort(request)


def get_cohort_repository(db: Session) -> CohortRepository:
    """Dependency injection for cohort repository."""
    return CohortRepository(db)

