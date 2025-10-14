"""Agent service with business logic and dynamic SQL."""

from typing import Any, Dict, List

from app.queries.agent_queries import AgentQueries
from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentItem, AgentsListRequest,
                                AgentsListResponse, CreateAgentRequest,
                                CreateAgentResponse, DebugInfoItem,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from app.schemas.base import ModelMapping, ModelMappingItem
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AgentService:
    """Service for agent operations."""

    def __init__(self) -> None:
        """Initialize service with query builders."""
        self.queries = AgentQueries()

    async def get_agents_list(
        self, request: AgentsListRequest, session: AsyncSession
    ) -> AgentsListResponse:
        """
        Get list of agents with permissions.

        Args:
            request: List request
            session: Database session

        Returns:
            AgentsListResponse
        """
        query, params = self.queries.get_agents_list(request.profileId)

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        # Collect unique model IDs
        model_ids = list(set([row.model_id for row in rows]))

        # Get model mapping
        model_mapping: ModelMapping = {}
        if model_ids:
            query, params = self.queries.get_model_mapping(model_ids)
            result = await session.execute(text(query), params)
            model_rows = result.fetchall()
            model_mapping = {
                row.model_id: ModelMappingItem(
                    name=row.name,
                    description=getattr(row, 'description', '') or ''
                )
                for row in model_rows
            }

        agents: List[AgentItem] = []
        for row in rows:
            agents.append(
                AgentItem(
                    agent_id=row.agent_id,
                    name=row.name,
                    description=row.description,
                    reasoning=row.reasoning,
                    temperature=float(row.temperature),
                    model_id=row.model_id,
                    updated_at=row.updated_at.isoformat(),
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                )
            )

        return AgentsListResponse(agents=agents, model_mapping=model_mapping)

    async def get_agent_detail(
        self, request: AgentDetailRequest, session: AsyncSession
    ) -> AgentDetailResponse:
        """
        Get agent detail with debug info and metadata.

        Args:
            request: Detail request
            session: Database session

        Returns:
            AgentDetailResponse
        """
        # Get basic agent info
        query, params = self.queries.get_agent_detail(request.agentId)
        result = await session.execute(text(query), params)
        agent_row = result.fetchone()

        if not agent_row:
            raise ValueError(f"Agent {request.agentId} not found")

        # Get debug info for agent
        query, params = self.queries.get_debug_info_for_agent(request.agentId)
        result = await session.execute(text(query), params)
        debug_rows = result.fetchall()

        debug_info: List[DebugInfoItem] = []
        debug_model_ids = set()
        for row in debug_rows:
            debug_info.append(
                DebugInfoItem(
                    created_at=row.created_at.isoformat(),
                    model_id=row.model_id,
                    content=row.content,
                )
            )
            debug_model_ids.add(row.model_id)

        # Get valid models for selection
        query, params = self.queries.get_valid_models()
        result = await session.execute(text(query), params)
        model_rows = result.fetchall()

        valid_model_ids: List[str] = []
        model_mapping: ModelMapping = {}
        for row in model_rows:
            valid_model_ids.append(row.model_id)
            model_mapping[row.model_id] = ModelMappingItem(
                name=row.name,
                description=row.description
            )

        # Add agent's current model to mapping if not already there
        if agent_row.model_id not in model_mapping:
            query, params = self.queries.get_model_mapping([agent_row.model_id])
            result = await session.execute(text(query), params)
            model_rows = result.fetchall()
            for row in model_rows:
                model_mapping[row.model_id] = ModelMappingItem(
                    name=row.name,
                    description=row.description
                )

        # Add debug info model IDs to mapping
        debug_model_ids_list = list(debug_model_ids - set(model_mapping.keys()))
        if debug_model_ids_list:
            query, params = self.queries.get_model_mapping(debug_model_ids_list)
            result = await session.execute(text(query), params)
            model_rows = result.fetchall()
            for row in model_rows:
                model_mapping[row.model_id] = ModelMappingItem(
                    name=row.name,
                    description=row.description
                )

        return AgentDetailResponse(
            name=agent_row.name,
            description=agent_row.description,
            system_prompt=agent_row.system_prompt,
            temperature=float(agent_row.temperature),
            model_id=agent_row.model_id,
            reasoning=agent_row.reasoning,
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=debug_info,
            model_mapping=model_mapping,
        )

    async def create_agent(
        self, request: CreateAgentRequest, session: AsyncSession
    ) -> CreateAgentResponse:
        """
        Create a new agent.

        Args:
            request: Create request
            session: Database session

        Returns:
            CreateAgentResponse
        """
        query, params = self.queries.create_agent(
            request.name,
            request.description,
            request.system_prompt,
            request.temperature,
            request.model_id,
            request.reasoning,
        )
        result = await session.execute(text(query), params)
        agent_row = result.fetchone()

        if not agent_row:
            raise ValueError("Failed to create agent")

        await session.commit()

        return CreateAgentResponse(
            success=True,
            agentId=agent_row.agent_id,
            message="Agent created successfully",
        )

    async def update_agent(
        self, request: UpdateAgentRequest, session: AsyncSession
    ) -> UpdateAgentResponse:
        """
        Update an agent.

        Args:
            request: Update request
            session: Database session

        Returns:
            UpdateAgentResponse
        """
        query, params = self.queries.update_agent(
            request.agentId,
            request.name,
            request.description,
            request.system_prompt,
            request.temperature,
            request.model_id,
            request.reasoning,
        )
        await session.execute(text(query), params)

        await session.commit()

        return UpdateAgentResponse(
            success=True, message="Agent updated successfully"
        )

    async def duplicate_agent(
        self, request: DuplicateAgentRequest, session: AsyncSession
    ) -> DuplicateAgentResponse:
        """
        Duplicate an agent.

        Args:
            request: Duplicate request
            session: Database session

        Returns:
            DuplicateAgentResponse
        """
        # Get original agent name
        query, params = self.queries.get_agent_detail(request.agentId)
        result = await session.execute(text(query), params)
        agent_row = result.fetchone()

        if not agent_row:
            raise ValueError(f"Agent {request.agentId} not found")

        new_name = f"{agent_row.name} Copy"

        # Duplicate agent
        query, params = self.queries.duplicate_agent(request.agentId, new_name)
        result = await session.execute(text(query), params)
        new_agent_row = result.fetchone()

        if not new_agent_row:
            raise ValueError("Failed to duplicate agent")

        await session.commit()

        return DuplicateAgentResponse(
            success=True,
            agentId=new_agent_row.agent_id,
            message="Agent duplicated successfully",
        )

    async def delete_agent(
        self, request: DeleteAgentRequest, session: AsyncSession
    ) -> DeleteAgentResponse:
        """
        Delete an agent (with usage check).

        Args:
            request: Delete request
            session: Database session

        Returns:
            DeleteAgentResponse
        """
        # Check if agent is in use
        query, params = self.queries.check_agent_usage(request.agentId)
        result = await session.execute(text(query), params)
        usage_row = result.fetchone()

        if not usage_row:
            raise ValueError(f"Agent {request.agentId} not found")

        total_usage = (
            usage_row.department_agent_count + usage_row.model_run_agent_count
        )

        if total_usage > 0:
            raise ValueError(f"Cannot delete agent: in use by {total_usage} entities")

        # Delete agent
        query, params = self.queries.delete_agent(request.agentId)
        await session.execute(text(query), params)

        await session.commit()

        return DeleteAgentResponse(success=True, message="Agent deleted successfully")

