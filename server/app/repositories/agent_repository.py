"""Agent repository - thin wrapper around service."""

from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentsListRequest, AgentsListResponse,
                                CreateAgentRequest, CreateAgentResponse,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from app.services.agent_service import AgentService
from sqlalchemy.ext.asyncio import AsyncSession


class AgentRepository:
    """Repository for agent operations."""

    def __init__(self) -> None:
        """Initialize repository with service."""
        self.service = AgentService()

    async def get_agents_list(
        self, request: AgentsListRequest, session: AsyncSession
    ) -> AgentsListResponse:
        """Get list of agents."""
        return await self.service.get_agents_list(request, session)

    async def get_agent_detail(
        self, request: AgentDetailRequest, session: AsyncSession
    ) -> AgentDetailResponse:
        """Get agent detail."""
        return await self.service.get_agent_detail(request, session)

    async def create_agent(
        self, request: CreateAgentRequest, session: AsyncSession
    ) -> CreateAgentResponse:
        """Create a new agent."""
        return await self.service.create_agent(request, session)

    async def update_agent(
        self, request: UpdateAgentRequest, session: AsyncSession
    ) -> UpdateAgentResponse:
        """Update an agent."""
        return await self.service.update_agent(request, session)

    async def duplicate_agent(
        self, request: DuplicateAgentRequest, session: AsyncSession
    ) -> DuplicateAgentResponse:
        """Duplicate an agent."""
        return await self.service.duplicate_agent(request, session)

    async def delete_agent(
        self, request: DeleteAgentRequest, session: AsyncSession
    ) -> DeleteAgentResponse:
        """Delete an agent."""
        return await self.service.delete_agent(request, session)

