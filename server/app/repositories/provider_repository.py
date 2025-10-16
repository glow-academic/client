"""Provider repository - thin wrapper around provider service."""

import asyncpg  # type: ignore
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


class ProviderRepository:
    """Repository for provider and model data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = ProviderService(conn)

    async def get_providers_list(
        self, filters: ProvidersFilters
    ) -> ProvidersListResponse:
        """Get providers list."""
        return await self.service.get_providers_list(filters)

    async def get_provider_detail(
        self, request: ProviderDetailRequest
    ) -> ProviderDetailResponse:
        """Get provider detail."""
        return await self.service.get_provider_detail(request)

    async def get_model_detail(self, request: ModelDetailRequest) -> ModelDetailResponse:
        """Get model detail."""
        return await self.service.get_model_detail(request)

    async def create_provider(
        self, request: CreateProviderRequest
    ) -> CreateProviderResponse:
        """Create provider."""
        return await self.service.create_provider(request)

    async def update_provider(
        self, request: UpdateProviderRequest
    ) -> UpdateProviderResponse:
        """Update provider."""
        return await self.service.update_provider(request)

    async def delete_provider(
        self, request: DeleteProviderRequest
    ) -> DeleteProviderResponse:
        """Delete provider."""
        return await self.service.delete_provider(request)

    async def create_model(self, request: CreateModelRequest) -> CreateModelResponse:
        """Create model."""
        return await self.service.create_model(request)

    async def update_model(self, request: UpdateModelRequest) -> UpdateModelResponse:
        """Update model."""
        return await self.service.update_model(request)

    async def delete_model(self, request: DeleteModelRequest) -> DeleteModelResponse:
        """Delete model."""
        return await self.service.delete_model(request)


def get_provider_repository(conn: asyncpg.Connection) -> ProviderRepository:
    """Dependency injection for provider repository."""
    return ProviderRepository(conn)
