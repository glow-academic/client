"""Scenario repository for database operations.

This repository delegates to the scenario service layer.
"""

from app.schemas.scenarios import (CreateScenarioRequest,
                                   CreateScenarioResponse,
                                   DeleteScenarioRequest,
                                   DeleteScenarioResponse,
                                   DuplicateScenarioRequest,
                                   DuplicateScenarioResponse,
                                   GenerateScenarioAIRequest,
                                   GenerateScenarioAIResponse,
                                   RandomizeScenarioRequest,
                                   RandomizeScenarioResponse,
                                   ScenarioDetailDefaultRequest,
                                   ScenarioDetailRequest,
                                   ScenarioDetailResponse, ScenariosFilters,
                                   ScenariosListResponse,
                                   UpdateScenarioRequest,
                                   UpdateScenarioResponse)
from app.services.scenario_service import ScenarioService
import asyncpg  # type: ignore


class ScenarioRepository:
    """
    Repository for scenario operations.
    
    This repository delegates to the scenario service layer.
    """

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.conn = conn
        self.service = ScenarioService(conn)

    async def get_scenarios_list(
        self, filters: ScenariosFilters
    ) -> ScenariosListResponse:
        """Get scenarios list."""
        return await self.service.get_scenarios_list(filters)

    async def get_scenario_detail(
        self, request: ScenarioDetailRequest
    ) -> ScenarioDetailResponse:
        """Get scenario detail."""
        return await self.service.get_scenario_detail(request)

    async def get_scenario_detail_default(
        self, request: ScenarioDetailDefaultRequest
    ) -> ScenarioDetailResponse:
        """Get default scenario detail."""
        return await self.service.get_scenario_detail_default(request)

    async def create_scenario(
        self, request: CreateScenarioRequest
    ) -> CreateScenarioResponse:
        """Create scenario."""
        return await self.service.create_scenario(request)

    async def update_scenario(
        self, request: UpdateScenarioRequest
    ) -> UpdateScenarioResponse:
        """Update scenario."""
        return await self.service.update_scenario(request)

    async def duplicate_scenario(
        self, request: DuplicateScenarioRequest
    ) -> DuplicateScenarioResponse:
        """Duplicate scenario."""
        return await self.service.duplicate_scenario(request)

    async def delete_scenario(
        self, request: DeleteScenarioRequest
    ) -> DeleteScenarioResponse:
        """Delete scenario."""
        return await self.service.delete_scenario(request)

    async def generate_scenario_ai(
        self, request: GenerateScenarioAIRequest
    ) -> GenerateScenarioAIResponse:
        """Generate AI scenario content."""
        return await self.service.generate_scenario_ai(request)

    def randomize_scenario_sections(
        self, request: RandomizeScenarioRequest
    ) -> RandomizeScenarioResponse:
        """Randomize scenario sections."""
        return self.service.randomize_scenario_sections(request)


def get_scenario_repository(conn: asyncpg.Connection) -> ScenarioRepository:
    """Get scenario repository instance."""
    return ScenarioRepository(conn)

