"""Parameter repository - thin wrapper around parameter service."""

import asyncpg  # type: ignore
from app.schemas.parameters import (CreateParameterItemRequest,
                                    CreateParameterItemResponse,
                                    CreateParameterRequest,
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


class ParameterRepository:
    """Repository for parameter data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = ParameterService(conn)

    async def get_parameters_list(
        self, filters: ParametersFilters
    ) -> ParametersListResponse:
        """Get parameters list."""
        return await self.service.get_parameters_list(filters)

    async def get_parameter_detail(
        self, request: ParameterDetailRequest
    ) -> ParameterDetailResponse:
        """Get parameter detail."""
        return await self.service.get_parameter_detail(request)

    async def get_parameter_detail_default(
        self, request: ParameterDetailDefaultRequest
    ) -> ParameterDetailResponse:
        """Get default parameter detail."""
        return await self.service.get_parameter_detail_default(request)

    async def create_parameter(
        self, request: CreateParameterRequest
    ) -> CreateParameterResponse:
        """Create parameter."""
        return await self.service.create_parameter(request)

    async def update_parameter(
        self, request: UpdateParameterRequest
    ) -> UpdateParameterResponse:
        """Update parameter."""
        return await self.service.update_parameter(request)

    async def duplicate_parameter(
        self, request: DuplicateParameterRequest
    ) -> DuplicateParameterResponse:
        """Duplicate parameter."""
        return await self.service.duplicate_parameter(request)

    async def delete_parameter(
        self, request: DeleteParameterRequest
    ) -> DeleteParameterResponse:
        """Delete parameter."""
        return await self.service.delete_parameter(request)

    async def create_parameter_item(
        self, request: CreateParameterItemRequest
    ) -> CreateParameterItemResponse:
        """Create a single parameter item."""
        return await self.service.create_parameter_item(request)


def get_parameter_repository(conn: asyncpg.Connection) -> ParameterRepository:
    """Dependency injection for parameter repository."""
    return ParameterRepository(conn)
