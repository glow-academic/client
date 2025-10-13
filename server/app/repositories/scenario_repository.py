"""Scenario repository for database operations.

This repository delegates to the scenario service layer.
"""

from typing import Optional

from app.db import get_session
from app.schemas.scenarios import (CreateScenarioRequest,
                                   CreateScenarioResponse,
                                   DeleteScenarioRequest,
                                   DeleteScenarioResponse,
                                   DuplicateScenarioRequest,
                                   DuplicateScenarioResponse,
                                   ScenarioDetailDefaultRequest,
                                   ScenarioDetailRequest,
                                   ScenarioDetailResponse, ScenariosFilters,
                                   ScenariosListResponse,
                                   UpdateScenarioRequest,
                                   UpdateScenarioResponse)
from app.services.scenario_service import ScenarioService
from sqlalchemy.orm import Session


class ScenarioRepository:
    """
    Repository for scenario operations.
    
    This repository delegates to the scenario service layer.
    """

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.db = db
        self.service = ScenarioService(db)

    def get_scenarios_list(
        self, filters: ScenariosFilters
    ) -> ScenariosListResponse:
        """Get scenarios list."""
        return self.service.get_scenarios_list(filters)

    def get_scenario_detail(
        self, request: ScenarioDetailRequest
    ) -> ScenarioDetailResponse:
        """Get scenario detail."""
        return self.service.get_scenario_detail(request)

    def get_scenario_detail_default(
        self, request: ScenarioDetailDefaultRequest
    ) -> ScenarioDetailResponse:
        """Get default scenario detail."""
        return self.service.get_scenario_detail_default(request)

    def create_scenario(
        self, request: CreateScenarioRequest
    ) -> CreateScenarioResponse:
        """Create scenario."""
        return self.service.create_scenario(request)

    def update_scenario(
        self, request: UpdateScenarioRequest
    ) -> UpdateScenarioResponse:
        """Update scenario."""
        return self.service.update_scenario(request)

    def duplicate_scenario(
        self, request: DuplicateScenarioRequest
    ) -> DuplicateScenarioResponse:
        """Duplicate scenario."""
        return self.service.duplicate_scenario(request)

    def delete_scenario(
        self, request: DeleteScenarioRequest
    ) -> DeleteScenarioResponse:
        """Delete scenario."""
        return self.service.delete_scenario(request)


def get_scenario_repository(db: Optional[Session] = None) -> ScenarioRepository:
    """Get scenario repository instance."""
    if db is None:
        db = next(get_session())
    return ScenarioRepository(db)

