"""Agent v2 API endpoints."""

from app.db import get_session
from app.repositories.agent_repository import AgentRepository
from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentsListRequest, AgentsListResponse,
                                CreateAgentRequest, CreateAgentResponse,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/list", response_model=AgentsListResponse)
async def list_agents(
    request: AgentsListRequest,
    session: AsyncSession = Depends(get_session),
) -> AgentsListResponse:
    """Get list of agents with permissions."""
    repo = AgentRepository()
    return await repo.get_agents_list(request, session)


@router.post("/detail", response_model=AgentDetailResponse)
async def get_agent_detail(
    request: AgentDetailRequest,
    session: AsyncSession = Depends(get_session),
) -> AgentDetailResponse:
    """Get agent detail with debug info and metadata."""
    repo = AgentRepository()
    return await repo.get_agent_detail(request, session)


@router.post("/create", response_model=CreateAgentResponse)
async def create_agent(
    request: CreateAgentRequest,
    session: AsyncSession = Depends(get_session),
) -> CreateAgentResponse:
    """Create a new agent."""
    repo = AgentRepository()
    return await repo.create_agent(request, session)


@router.post("/update", response_model=UpdateAgentResponse)
async def update_agent(
    request: UpdateAgentRequest,
    session: AsyncSession = Depends(get_session),
) -> UpdateAgentResponse:
    """Update an agent."""
    repo = AgentRepository()
    return await repo.update_agent(request, session)


@router.post("/duplicate", response_model=DuplicateAgentResponse)
async def duplicate_agent(
    request: DuplicateAgentRequest,
    session: AsyncSession = Depends(get_session),
) -> DuplicateAgentResponse:
    """Duplicate an agent."""
    repo = AgentRepository()
    return await repo.duplicate_agent(request, session)


@router.post("/delete", response_model=DeleteAgentResponse)
async def delete_agent(
    request: DeleteAgentRequest,
    session: AsyncSession = Depends(get_session),
) -> DeleteAgentResponse:
    """Delete an agent (with usage check)."""
    repo = AgentRepository()
    return await repo.delete_agent(request, session)

