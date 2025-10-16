"""Agent repository - thin wrapper around service."""

import asyncpg
from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentsListRequest, AgentsListResponse,
                                CreateAgentRequest, CreateAgentResponse,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from app.services.agent_service import AgentService


class AgentRepository:
    """Repository for agent operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = AgentService(conn)

    async def get_agents_list(
        self, request: AgentsListRequest
    ) -> AgentsListResponse:
        """Get list of agents."""
        return await self.service.get_agents_list(request)

    async def get_agent_detail(
        self, request: AgentDetailRequest
    ) -> AgentDetailResponse:
        """Get agent detail."""
        return await self.service.get_agent_detail(request)

    async def create_agent(
        self, request: CreateAgentRequest
    ) -> CreateAgentResponse:
        """Create a new agent."""
        return await self.service.create_agent(request)

    async def update_agent(
        self, request: UpdateAgentRequest
    ) -> UpdateAgentResponse:
        """Update an agent."""
        return await self.service.update_agent(request)

    async def duplicate_agent(
        self, request: DuplicateAgentRequest
    ) -> DuplicateAgentResponse:
        """Duplicate an agent."""
        return await self.service.duplicate_agent(request)

    async def delete_agent(
        self, request: DeleteAgentRequest
    ) -> DeleteAgentResponse:
        """Delete an agent."""
        return await self.service.delete_agent(request)


def get_agent_repository(conn: asyncpg.Connection) -> AgentRepository:
    """Get agent repository instance."""
    return AgentRepository(conn)
