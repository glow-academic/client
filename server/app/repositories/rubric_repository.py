"""Rubric repository - thin wrapper around rubric service."""

import asyncpg  # type: ignore
from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricsFilters, RubricsListResponse,
                                 UpdateRubricRequest, UpdateRubricResponse)
from app.services.rubric_service import RubricService


class RubricRepository:
    """Repository for rubric data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = RubricService(conn)

    async def get_rubrics_list(self, filters: RubricsFilters) -> RubricsListResponse:
        """Get rubrics list."""
        return await self.service.get_rubrics_list(filters)

    async def get_rubric_detail(
        self, request: RubricDetailRequest
    ) -> RubricDetailResponse:
        """Get rubric detail."""
        return await self.service.get_rubric_detail(request)

    async def get_rubric_detail_default(
        self, request: RubricDetailDefaultRequest
    ) -> RubricDetailResponse:
        """Get default rubric detail."""
        return await self.service.get_rubric_detail_default(request)

    async def create_rubric(self, request: CreateRubricRequest) -> CreateRubricResponse:
        """Create rubric."""
        return await self.service.create_rubric(request)

    async def update_rubric(self, request: UpdateRubricRequest) -> UpdateRubricResponse:
        """Update rubric."""
        return await self.service.update_rubric(request)

    async def duplicate_rubric(
        self, request: DuplicateRubricRequest
    ) -> DuplicateRubricResponse:
        """Duplicate rubric."""
        return await self.service.duplicate_rubric(request)

    async def delete_rubric(self, request: DeleteRubricRequest) -> DeleteRubricResponse:
        """Delete rubric."""
        return await self.service.delete_rubric(request)


def get_rubric_repository(conn: asyncpg.Connection) -> RubricRepository:
    """Dependency injection for rubric repository."""
    return RubricRepository(conn)
