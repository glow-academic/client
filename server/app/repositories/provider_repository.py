"""Provider repository - thin wrapper around provider service."""

from app.schemas.providers import (CreateModelRequest, CreateModelResponse,
                                   CreateProviderRequest,
                                   CreateProviderResponse, DeleteModelRequest,
                                   DeleteModelResponse, DeleteProviderRequest,
                                   DeleteProviderResponse, ModelDetailRequest,
                                   ModelDetailResponse, ProviderDetailRequest,
                                   ProviderDetailResponse, ProvidersFilters,
                                   ProvidersListResponse, UpdateModelRequest,
                                   UpdateModelResponse, UpdateProviderRequest,
                                   UpdateProviderResponse)
from app.services.provider_service import ProviderService
from sqlalchemy.orm import Session


class ProviderRepository:
    """Repository for provider and model data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = ProviderService(db)

    def get_providers_list(
        self, filters: ProvidersFilters
    ) -> ProvidersListResponse:
        """Get providers list."""
        return self.service.get_providers_list(filters)

    def get_provider_detail(
        self, request: ProviderDetailRequest
    ) -> ProviderDetailResponse:
        """Get provider detail."""
        return self.service.get_provider_detail(request)

    def get_model_detail(self, request: ModelDetailRequest) -> ModelDetailResponse:
        """Get model detail."""
        return self.service.get_model_detail(request)

    def create_provider(
        self, request: CreateProviderRequest
    ) -> CreateProviderResponse:
        """Create provider."""
        return self.service.create_provider(request)

    def update_provider(
        self, request: UpdateProviderRequest
    ) -> UpdateProviderResponse:
        """Update provider."""
        return self.service.update_provider(request)

    def delete_provider(
        self, request: DeleteProviderRequest
    ) -> DeleteProviderResponse:
        """Delete provider."""
        return self.service.delete_provider(request)

    def create_model(self, request: CreateModelRequest) -> CreateModelResponse:
        """Create model."""
        return self.service.create_model(request)

    def update_model(self, request: UpdateModelRequest) -> UpdateModelResponse:
        """Update model."""
        return self.service.update_model(request)

    def delete_model(self, request: DeleteModelRequest) -> DeleteModelResponse:
        """Delete model."""
        return self.service.delete_model(request)


def get_provider_repository(db: Session) -> ProviderRepository:
    """Dependency injection for provider repository."""
    return ProviderRepository(db)

