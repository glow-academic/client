"""Agent service with business logic and dynamic SQL."""

from typing import List

import asyncpg  # type: ignore 
from app.queries.agent_queries import AgentQueries
from app.schemas.agents import (AgentDetailRequest, AgentDetailResponse,
                                AgentItem, AgentsListRequest,
                                AgentsListResponse, CreateAgentRequest,
                                CreateAgentResponse, DebugInfoItem,
                                DeleteAgentRequest, DeleteAgentResponse,
                                DuplicateAgentRequest, DuplicateAgentResponse,
                                UpdateAgentRequest, UpdateAgentResponse)
from app.schemas.base import ModelMapping, ModelMappingItem


class AgentService:
    """Service for agent operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = AgentQueries()

    async def get_agents_list(
        self, request: AgentsListRequest
    ) -> AgentsListResponse:
        """
        Get list of agents with permissions.

        Args:
            request: List request

        Returns:
            AgentsListResponse
        """
        query, params = self.queries.get_agents_list(request.profileId)

        rows = await self.conn.fetch(query, *params)

        # Collect unique model IDs
        model_ids = list(set([row['model_id'] for row in rows]))

        # Get model mapping
        model_mapping: ModelMapping = {}
        if model_ids:
            query, params = self.queries.get_model_mapping(model_ids)
            model_rows = await self.conn.fetch(query, *params)
            model_mapping = {
                row['model_id']: ModelMappingItem(
                    name=row['name'],
                    description=row['description'] or ''
                )
                for row in model_rows
            }

        agents: List[AgentItem] = []
        for row in rows:
            agents.append(
                AgentItem(
                    agent_id=row['agent_id'],
                    name=row['name'],
                    description=row['description'],
                    reasoning=row['reasoning'],
                    temperature=float(row['temperature']),
                    model_id=row['model_id'],
                    updated_at=row['updated_at'].isoformat(),
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                )
            )

        return AgentsListResponse(agents=agents, model_mapping=model_mapping)

    async def get_agent_detail(
        self, request: AgentDetailRequest
    ) -> AgentDetailResponse:
        """
        Get agent detail with debug info and metadata.

        Args:
            request: Detail request

        Returns:
            AgentDetailResponse
        """
        # Get basic agent info
        query, params = self.queries.get_agent_detail(request.agentId)
        agent_row = await self.conn.fetchrow(query, *params)

        if not agent_row:
            raise ValueError(f"Agent {request.agentId} not found")

        # Get debug info for agent
        query, params = self.queries.get_debug_info_for_agent(request.agentId)
        debug_rows = await self.conn.fetch(query, *params)

        debug_info: List[DebugInfoItem] = []
        debug_model_ids = set()
        for row in debug_rows:
            debug_info.append(
                DebugInfoItem(
                    created_at=row['created_at'].isoformat(),
                    model_id=row['model_id'],
                    content=row['content'],
                )
            )
            debug_model_ids.add(row['model_id'])

        # Get valid models for selection
        query, params = self.queries.get_valid_models()
        model_rows = await self.conn.fetch(query, *params)

        valid_model_ids: List[str] = []
        model_mapping: ModelMapping = {}
        for row in model_rows:
            valid_model_ids.append(row['model_id'])
            model_mapping[row['model_id']] = ModelMappingItem(
                name=row['name'],
                description=row['description']
            )

        # Add agent's current model to mapping if not already there
        if agent_row['model_id'] not in model_mapping:
            query, params = self.queries.get_model_mapping([agent_row['model_id']])
            model_rows = await self.conn.fetch(query, *params)
            for row in model_rows:
                model_mapping[row['model_id']] = ModelMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Add debug info model IDs to mapping
        debug_model_ids_list = list(debug_model_ids - set(model_mapping.keys()))
        if debug_model_ids_list:
            query, params = self.queries.get_model_mapping(debug_model_ids_list)
            model_rows = await self.conn.fetch(query, *params)
            for row in model_rows:
                model_mapping[row['model_id']] = ModelMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        return AgentDetailResponse(
            name=agent_row['name'],
            description=agent_row['description'],
            system_prompt=agent_row['system_prompt'],
            temperature=float(agent_row['temperature']),
            model_id=agent_row['model_id'],
            reasoning=agent_row['reasoning'],
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=debug_info,
            model_mapping=model_mapping,
        )

    async def create_agent(
        self, request: CreateAgentRequest
    ) -> CreateAgentResponse:
        """
        Create a new agent.

        Args:
            request: Create request

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
        agent_row = await self.conn.fetchrow(query, *params)

        if not agent_row:
            raise ValueError("Failed to create agent")

        return CreateAgentResponse(
            success=True,
            agentId=agent_row['agent_id'],
            message="Agent created successfully",
        )

    async def update_agent(
        self, request: UpdateAgentRequest
    ) -> UpdateAgentResponse:
        """
        Update an agent.

        Args:
            request: Update request

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
        await self.conn.execute(query, *params)

        return UpdateAgentResponse(
            success=True, message="Agent updated successfully"
        )

    async def duplicate_agent(
        self, request: DuplicateAgentRequest
    ) -> DuplicateAgentResponse:
        """
        Duplicate an agent.

        Args:
            request: Duplicate request

        Returns:
            DuplicateAgentResponse
        """
        # Duplicate agent (SQL adds ' Copy' suffix automatically)
        query, params = self.queries.duplicate_agent(request.agentId)
        new_agent_row = await self.conn.fetchrow(query, *params)

        if not new_agent_row:
            raise ValueError("Failed to duplicate agent")

        return DuplicateAgentResponse(
            success=True,
            agentId=new_agent_row['agent_id'],
            message="Agent duplicated successfully",
        )

    async def delete_agent(
        self, request: DeleteAgentRequest
    ) -> DeleteAgentResponse:
        """
        Delete an agent (no usage check for now).

        Args:
            request: Delete request

        Returns:
            DeleteAgentResponse
        """
        # Delete agent
        query, params = self.queries.delete_agent(request.agentId)
        await self.conn.execute(query, *params)

        return DeleteAgentResponse(success=True, message="Agent deleted successfully")
