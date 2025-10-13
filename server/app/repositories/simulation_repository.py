"""Simulation repository - thin wrapper around simulation service."""

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
from sqlalchemy.orm import Session


class SimulationRepository:
    """Repository for simulation data access."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = SimulationService(db)

    def get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Get simulations list."""
        return self.service.get_simulations_list(filters)

    def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get simulation detail."""
        return self.service.get_simulation_detail(request)

    def get_simulation_detail_default(
        self, request: SimulationDetailDefaultRequest
    ) -> SimulationDetailResponse:
        """Get default simulation detail."""
        return self.service.get_simulation_detail_default(request)

    def create_simulation(
        self, request: CreateSimulationRequest
    ) -> CreateSimulationResponse:
        """Create simulation."""
        return self.service.create_simulation(request)

    def update_simulation(
        self, request: UpdateSimulationRequest
    ) -> UpdateSimulationResponse:
        """Update simulation."""
        return self.service.update_simulation(request)

    def duplicate_simulation(
        self, request: DuplicateSimulationRequest
    ) -> DuplicateSimulationResponse:
        """Duplicate simulation."""
        return self.service.duplicate_simulation(request)

    def delete_simulation(
        self, request: DeleteSimulationRequest
    ) -> DeleteSimulationResponse:
        """Delete simulation."""
        return self.service.delete_simulation(request)


def get_simulation_repository(db: Session) -> SimulationRepository:
    """Dependency injection for simulation repository."""
    return SimulationRepository(db)

