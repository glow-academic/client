"""Cohort repository - thin wrapper around cohort service."""

import asyncpg  # type: ignore
from app.schemas.cohorts import (AddProfilesToCohortRequest,
                                 AddProfilesToCohortResponse,
                                 CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortDetailWithProfilesRequest,
                                 CohortDetailWithProfilesResponse,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse,
                                 RemoveProfilesFromCohortRequest,
                                 RemoveProfilesFromCohortResponse,
                                 UpdateCohortRequest, UpdateCohortResponse)
from app.services.cohort_service import CohortService


class CohortRepository:
    """Repository for cohort data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = CohortService(conn)

    async def get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Get cohorts list."""
        return await self.service.get_cohorts_list(filters)

    async def get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Get cohort detail."""
        return await self.service.get_cohort_detail(request)

    async def get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Get default cohort detail."""
        return await self.service.get_cohort_detail_default(request)

    async def get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Get cohort detail with available profiles."""
        return await self.service.get_cohort_detail_with_profiles(request)

    async def create_cohort(self, request: CreateCohortRequest) -> CreateCohortResponse:
        """Create cohort."""
        return await self.service.create_cohort(request)

    async def update_cohort(self, request: UpdateCohortRequest) -> UpdateCohortResponse:
        """Update cohort."""
        return await self.service.update_cohort(request)

    async def duplicate_cohort(
        self, request: DuplicateCohortRequest
    ) -> DuplicateCohortResponse:
        """Duplicate cohort."""
        return await self.service.duplicate_cohort(request)

    async def delete_cohort(self, request: DeleteCohortRequest) -> DeleteCohortResponse:
        """Delete cohort."""
        return await self.service.delete_cohort(request)

    async def leave_cohort(self, request: LeaveCohortRequest) -> LeaveCohortResponse:
        """Leave cohort."""
        return await self.service.leave_cohort(request)

    async def add_profiles_to_cohort(
        self, request: AddProfilesToCohortRequest
    ) -> AddProfilesToCohortResponse:
        """Add profiles to cohort."""
        return await self.service.add_profiles_to_cohort(request)

    async def remove_profiles_from_cohort(
        self, request: RemoveProfilesFromCohortRequest
    ) -> RemoveProfilesFromCohortResponse:
        """Remove profiles from cohort."""
        return await self.service.remove_profiles_from_cohort(request)


def get_cohort_repository(conn: asyncpg.Connection) -> CohortRepository:
    """Dependency injection for cohort repository."""
    return CohortRepository(conn)
