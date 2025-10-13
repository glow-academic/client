"""Rubric repository - thin wrapper around rubric service."""

from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricsFilters, RubricsListResponse,
                                 UpdateRubricRequest, UpdateRubricResponse)
from app.services.rubric_service import RubricService
from sqlalchemy.orm import Session


class RubricRepository:
    """Repository for rubric data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = RubricService(db)

    def get_rubrics_list(self, filters: RubricsFilters) -> RubricsListResponse:
        """Get rubrics list."""
        return self.service.get_rubrics_list(filters)

    def get_rubric_detail(
        self, request: RubricDetailRequest
    ) -> RubricDetailResponse:
        """Get rubric detail."""
        return self.service.get_rubric_detail(request)

    def get_rubric_detail_default(
        self, request: RubricDetailDefaultRequest
    ) -> RubricDetailResponse:
        """Get default rubric detail."""
        return self.service.get_rubric_detail_default(request)

    def create_rubric(self, request: CreateRubricRequest) -> CreateRubricResponse:
        """Create rubric."""
        return self.service.create_rubric(request)

    def update_rubric(self, request: UpdateRubricRequest) -> UpdateRubricResponse:
        """Update rubric."""
        return self.service.update_rubric(request)

    def duplicate_rubric(
        self, request: DuplicateRubricRequest
    ) -> DuplicateRubricResponse:
        """Duplicate rubric."""
        return self.service.duplicate_rubric(request)

    def delete_rubric(self, request: DeleteRubricRequest) -> DeleteRubricResponse:
        """Delete rubric."""
        return self.service.delete_rubric(request)


def get_rubric_repository(db: Session) -> RubricRepository:
    """Dependency injection for rubric repository."""
    return RubricRepository(db)

