"""Parameter repository - thin wrapper around parameter service."""

from app.schemas.parameters import (CreateParameterRequest,
                                    CreateParameterResponse,
                                    DeleteParameterRequest,
                                    DeleteParameterResponse,
                                    DuplicateParameterRequest,
                                    DuplicateParameterResponse,
                                    ParameterDetailDefaultRequest,
                                    ParameterDetailRequest,
                                    ParameterDetailResponse, ParametersFilters,
                                    ParametersListResponse,
                                    UpdateParameterRequest,
                                    UpdateParameterResponse)
from app.services.parameter_service import ParameterService
from sqlalchemy.orm import Session


class ParameterRepository:
    """Repository for parameter data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = ParameterService(db)

    def get_parameters_list(
        self, filters: ParametersFilters
    ) -> ParametersListResponse:
        """Get parameters list."""
        return self.service.get_parameters_list(filters)

    def get_parameter_detail(
        self, request: ParameterDetailRequest
    ) -> ParameterDetailResponse:
        """Get parameter detail."""
        return self.service.get_parameter_detail(request)

    def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter detail."""
        return self.service.get_parameter_detail_default(request)

    def create_parameter(
        self, request: CreateParameterRequest
    ) -> CreateParameterResponse:
        """Create parameter."""
        return self.service.create_parameter(request)

    def update_parameter(
        self, request: UpdateParameterRequest
    ) -> UpdateParameterResponse:
        """Update parameter."""
        return self.service.update_parameter(request)

    def duplicate_parameter(
        self, request: DuplicateParameterRequest
    ) -> DuplicateParameterResponse:
        """Duplicate parameter."""
        return self.service.duplicate_parameter(request)

    def delete_parameter(
        self, request: DeleteParameterRequest
    ) -> DeleteParameterResponse:
        """Delete parameter."""
        return self.service.delete_parameter(request)


def get_parameter_repository(db: Session) -> ParameterRepository:
    """Dependency injection for parameter repository."""
    return ParameterRepository(db)

