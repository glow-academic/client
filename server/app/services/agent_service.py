"""Agent service with business logic and dynamic SQL."""

import json
import uuid
from typing import Any, Dict, List

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

    async def get_classification_run_context(
        self, document_ids: list[uuid.UUID], department_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Get all data needed to run classification agent with optimized query.
        
        Reduces 5 database queries to 1 JOIN query.
        
        Args:
            document_ids: List of document UUIDs to classify
            department_id: UUID of the department
        
        Returns:
            Dict with agent, model, provider, and documents data
        
        Raises:
            ValueError: If no classify agent configured for department
        """
        document_ids_str = [str(d) for d in document_ids]
        department_id_str = str(department_id)
        
        # Single optimized JOIN query
        query, params = self.queries.get_classification_run_context(
            document_ids_str, department_id_str
        )
        context_row = await self.conn.fetchrow(query, *params)
        
        if not context_row:
            raise ValueError(
                f"No classify agent configured for department {department_id} "
                f"or no documents found"
            )
        
        # Parse documents JSON array
        documents = json.loads(context_row['documents']) if isinstance(context_row['documents'], str) else context_row['documents']
        
        return {
            # Agent data
            'agent_id': context_row['agent_id'],
            'name': context_row['agent_name'],
            'system_prompt': context_row['system_prompt'],
            'temperature': float(context_row['temperature']),
            'reasoning': context_row['reasoning'],
            # Model data
            'model_id': context_row['model_id'],
            'model_name': context_row['model_name'],
            'custom_model': context_row['custom_model'],
            # Provider data
            'provider_id': context_row['provider_id'],
            'provider_name': context_row['provider_name'],
            'base_url': context_row['base_url'],
            'api_key': context_row['api_key'],
            # Documents
            'documents': documents,
        }

    async def batch_update_document_types(
        self, document_updates: Dict[uuid.UUID, str]
    ) -> int:
        """
        Batch update document types efficiently.
        
        Args:
            document_updates: Dict mapping document_id -> new_type
        
        Returns:
            Number of documents updated
        """
        if not document_updates:
            return 0
        
        doc_ids = [str(d) for d in document_updates.keys()]
        types = list(document_updates.values())
        
        query, _ = self.queries.batch_update_document_types()
        result = await self.conn.execute(query, doc_ids, types)
        
        # Parse result like "UPDATE 15" to get count
        count = int(result.split()[-1]) if result else 0
        return count

    async def get_simulation_run_context(
        self, chat_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Get all data needed to run simulation agent with optimized query.
        
        Reduces 12 database queries to 1 JOIN query.
        
        Args:
            chat_id: UUID of the simulation chat
        
        Returns:
            Dict with chat, attempt, scenario, persona, model, provider, 
            simulation settings, profile, and documents data
        
        Raises:
            ValueError: If chat not found or missing required data
        """
        chat_id_str = str(chat_id)
        
        # Single optimized JOIN query
        query, params = self.queries.get_simulation_run_context(chat_id_str)
        context_row = await self.conn.fetchrow(query, *params)
        
        if not context_row:
            raise ValueError(
                f"Simulation chat {chat_id} not found or missing required data"
            )
        
        # Parse document_ids JSON array
        document_ids = json.loads(context_row['document_ids']) if isinstance(context_row['document_ids'], str) else context_row['document_ids']
        
        return {
            # Chat data
            'chat_id': context_row['chat_id'],
            'chat_title': context_row['chat_title'],
            'trace_id': context_row['trace_id'],
            # Attempt data
            'attempt_id': context_row['attempt_id'],
            'simulation_id': context_row['simulation_id'],
            # Scenario data
            'scenario_id': context_row['scenario_id'],
            'department_id': context_row['department_id'],
            'problem_statement': context_row['problem_statement'],
            # Persona data
            'persona_id': context_row['persona_id'],
            'persona_name': context_row['persona_name'],
            'system_prompt': context_row['system_prompt'],
            'temperature': float(context_row['temperature']),
            'reasoning': context_row['reasoning'],
            # Model data
            'model_id': context_row['model_id'],
            'model_name': context_row['model_name'],
            'custom_model': context_row['custom_model'],
            # Provider data
            'provider_id': context_row['provider_id'],
            'provider_name': context_row['provider_name'],
            'base_url': context_row['base_url'],
            'api_key': context_row['api_key'],
            # Simulation settings
            'image_input_active': context_row['image_input_active'],
            'output_guardrail_active': context_row['output_guardrail_active'],
            # Profile data (nullable)
            'profile_id': context_row['profile_id'],
            # Documents
            'document_ids': document_ids,
        }

    async def get_grading_run_context(
        self, simulation_chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Get all data needed to run grading agent with optimized query.
        
        Reduces 13+ database queries to 2 JOIN queries (context + messages).
        
        Args:
            simulation_chat_id: UUID of the simulation chat
            department_id: UUID of the department
        
        Returns:
            Dict with chat, scenario, attempt, simulation, rubric, 
            standard_groups, standards, agent, model, provider, and profile data
        
        Raises:
            ValueError: If chat not found or no grade agent configured for department
        """
        simulation_chat_id_str = str(simulation_chat_id)
        department_id_str = str(department_id)
        
        # Single optimized JOIN query
        query, params = self.queries.get_grading_run_context(
            simulation_chat_id_str, department_id_str
        )
        context_row = await self.conn.fetchrow(query, *params)
        
        if not context_row:
            raise ValueError(
                f"Chat {simulation_chat_id} not found or no grade agent "
                f"configured for department {department_id}"
            )
        
        # Parse JSON arrays for standard_groups and standards
        standard_groups = json.loads(context_row['standard_groups']) if isinstance(context_row['standard_groups'], str) else context_row['standard_groups']
        standards = json.loads(context_row['standards']) if isinstance(context_row['standards'], str) else context_row['standards']
        
        return {
            # Chat data
            'chat_id': context_row['chat_id'],
            'scenario_id': context_row['scenario_id'],
            'attempt_id': context_row['attempt_id'],
            'title': context_row['title'],
            'trace_id': context_row['trace_id'],
            'created_at': context_row['created_at'],
            'completed_at': context_row['completed_at'],
            # Scenario data
            'problem_statement': context_row['problem_statement'],
            # Attempt data
            'total_chats': context_row['total_chats'],
            # Simulation data
            'simulation_id': context_row['simulation_id'],
            'time_limit': context_row['time_limit'],
            # Rubric data
            'rubric': {
                'id': context_row['rubric_id'],
                'name': context_row['rubric_name'],
                'description': context_row['rubric_description'],
                'points': context_row['rubric_points'],
                'pass_points': context_row['rubric_pass_points'],
            },
            # Standard groups and standards
            'standard_groups': standard_groups,
            'standards': standards,
            # Agent data
            'agent': {
                'id': context_row['agent_id'],
                'name': context_row['agent_name'],
                'system_prompt': context_row['system_prompt'],
                'temperature': float(context_row['temperature']),
                'reasoning': context_row['reasoning'],
            },
            # Model data
            'model': {
                'id': context_row['model_id'],
                'name': context_row['model_name'],
                'custom_model': context_row['custom_model'],
            },
            # Provider data
            'provider': {
                'id': context_row['provider_id'],
                'name': context_row['provider_name'],
                'base_url': context_row['base_url'],
                'api_key': context_row['api_key'],
            },
            # Profile data
            'profile_id': context_row['profile_id'],
        }

    async def get_simulation_messages(
        self, simulation_chat_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all messages for a simulation chat.
        
        Args:
            simulation_chat_id: UUID of the simulation chat
        
        Returns:
            List of message dicts
        """
        simulation_chat_id_str = str(simulation_chat_id)
        
        query, params = self.queries.get_simulation_messages(simulation_chat_id_str)
        rows = await self.conn.fetch(query, *params)
        
        return [dict(row) for row in rows]

    async def get_guardrail_run_context(
        self, chat_id: uuid.UUID, department_id: uuid.UUID, guardrail_type: str
    ) -> Dict[str, Any]:
        """
        Get all data needed to run guardrail agent with optimized query.
        
        Reduces multiple database queries to 1 JOIN query.
        
        Args:
            chat_id: UUID of the simulation chat
            department_id: UUID of the department
            guardrail_type: Either "input" or "output" for role filtering
        
        Returns:
            Dict with agent, model, provider, chat, attempt, and profile data
        
        Raises:
            ValueError: If guardrail agent not configured or chat not found
        """
        if guardrail_type not in ("input", "output"):
            raise ValueError(
                f"Invalid guardrail_type: {guardrail_type}. Must be 'input' or 'output'"
            )
        
        chat_id_str = str(chat_id)
        department_id_str = str(department_id)
        
        # Single optimized JOIN query
        query, params = self.queries.get_guardrail_run_context(
            chat_id_str, department_id_str, guardrail_type
        )
        context_row = await self.conn.fetchrow(query, *params)
        
        if not context_row:
            raise ValueError(
                f"No {guardrail_type} guardrail agent configured for department "
                f"{department_id} or chat {chat_id} not found"
            )
        
        return {
            # Agent data
            'agent_id': context_row['agent_id'],
            'agent_name': context_row['agent_name'],
            'system_prompt': context_row['system_prompt'],
            'temperature': float(context_row['temperature']),
            'reasoning': context_row['reasoning'],
            # Model data
            'model_id': context_row['model_id'],
            'model_name': context_row['model_name'],
            'custom_model': context_row['custom_model'],
            # Provider data
            'provider_id': context_row['provider_id'],
            'provider_name': context_row['provider_name'],
            'base_url': context_row['base_url'],
            'api_key': context_row['api_key'],
            # Chat data
            'chat_id': context_row['chat_id'],
            'chat_title': context_row['chat_title'],
            'trace_id': context_row['trace_id'],
            # Attempt data
            'attempt_id': context_row['attempt_id'],
            'simulation_id': context_row['simulation_id'],
            # Profile data
            'profile_id': context_row['profile_id'],
        }


    async def get_title_run_context(
        self, chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Get all data needed to run title agent with optimized query.
        
        Reduces 4 database queries to 1 JOIN query.
        
        Args:
            chat_id: UUID of the assistant chat
            department_id: UUID of the department
        
        Returns:
            Dict with agent, model, provider, and chat data
        
        Raises:
            ValueError: If no title agent configured for department or chat not found
        """
        chat_id_str = str(chat_id)
        department_id_str = str(department_id)
        
        # Single optimized JOIN query
        query, params = self.queries.get_title_run_context(
            chat_id_str, department_id_str
        )
        context_row = await self.conn.fetchrow(query, *params)
        
        if not context_row:
            raise ValueError(
                f"No title agent configured for department {department_id} "
                f"or chat {chat_id} not found"
            )
        
        return {
            # Agent data
            'agent_id': context_row['agent_id'],
            'name': context_row['agent_name'],
            'system_prompt': context_row['system_prompt'],
            'temperature': float(context_row['temperature']),
            'reasoning': context_row['reasoning'],
            # Model data
            'model_id': context_row['model_id'],
            'model_name': context_row['model_name'],
            'custom_model': context_row['custom_model'],
            # Provider data
            'provider_id': context_row['provider_id'],
            'provider_name': context_row['provider_name'],
            'base_url': context_row['base_url'],
            'api_key': context_row['api_key'],
            # Chat data
            'chat_id': context_row['chat_id'],
            'profile_id': context_row['profile_id'],
            'chat_title': context_row['chat_title'],
            'trace_id': context_row['trace_id'],
        }
