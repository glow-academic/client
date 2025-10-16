"""Simulation repository - thin wrapper around simulation service."""

import asyncpg  # type: ignore
from app.schemas.simulations import (CreateSimulationRequest,
                                     CreateSimulationResponse,
                                     DeleteSimulationRequest,
                                     DeleteSimulationResponse,
                                     DuplicateSimulationRequest,
                                     DuplicateSimulationResponse,
                                     SimulationDetailDefaultRequest,
                                     SimulationDetailRequest,
                                     SimulationDetailResponse,
                                     SimulationsFilters,
                                     SimulationsListResponse,
                                     UpdateSimulationRequest,
                                     UpdateSimulationResponse)
from app.services.simulation_service import SimulationService


class SimulationRepository:
    """Repository for simulation data access."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = SimulationService(conn)

    async def get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Get simulations list."""
        return await self.service.get_simulations_list(filters)

    async def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get simulation detail."""
        return await self.service.get_simulation_detail(request)

    async def get_simulation_detail_default(
        self, request: SimulationDetailDefaultRequest
    ) -> SimulationDetailResponse:
        """Get default simulation detail."""
        return await self.service.get_simulation_detail_default(request)

    async def create_simulation(
        self, request: CreateSimulationRequest
    ) -> CreateSimulationResponse:
        """Create simulation."""
        return await self.service.create_simulation(request)

    async def update_simulation(
        self, request: UpdateSimulationRequest
    ) -> UpdateSimulationResponse:
        """Update simulation."""
        return await self.service.update_simulation(request)

    async def duplicate_simulation(
        self, request: DuplicateSimulationRequest
    ) -> DuplicateSimulationResponse:
        """Duplicate simulation."""
        return await self.service.duplicate_simulation(request)

    async def delete_simulation(
        self, request: DeleteSimulationRequest
    ) -> DeleteSimulationResponse:
        """Delete simulation."""
        return await self.service.delete_simulation(request)


def get_simulation_repository(conn: asyncpg.Connection) -> SimulationRepository:
    """Dependency injection for simulation repository."""
    return SimulationRepository(conn)

