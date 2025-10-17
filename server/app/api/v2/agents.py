"""Agent v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentsListRequest, AgentsListResponse,
                                CreateAgentRequest, CreateAgentResponse,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from app.services.agent_service import get_agent_service
from fastapi import APIRouter, Depends

router = APIRouter()


@router.post("/list", response_model=AgentsListResponse)
async def list_agents(
    request: AgentsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentsListResponse:
    """Get list of agents with permissions."""
    service = get_agent_service(conn)
    return await service.get_agents_list(request)


@router.post("/detail", response_model=AgentDetailResponse)
async def get_agent_detail(
    request: AgentDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentDetailResponse:
    """Get agent detail with debug info and metadata."""
    service = get_agent_service(conn)
    return await service.get_agent_detail(request)


@router.post("/create", response_model=CreateAgentResponse)
async def create_agent(
    request: CreateAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAgentResponse:
    """Create a new agent."""
    service = get_agent_service(conn)
    return await service.create_agent(request)


@router.post("/update", response_model=UpdateAgentResponse)
async def update_agent(
    request: UpdateAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateAgentResponse:
    """Update an agent."""
    service = get_agent_service(conn)
    return await service.update_agent(request)


@router.post("/duplicate", response_model=DuplicateAgentResponse)
async def duplicate_agent(
    request: DuplicateAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAgentResponse:
    """Duplicate an agent."""
    service = get_agent_service(conn)
    return await service.duplicate_agent(request)


@router.post("/delete", response_model=DeleteAgentResponse)
async def delete_agent(
    request: DeleteAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentResponse:
    """Delete an agent (with usage check)."""
    service = get_agent_service(conn)
    return await service.delete_agent(request)
