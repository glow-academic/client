"""Agent service with business logic and dynamic SQL."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.agent_queries import AgentQueries
from app.queries.profile_queries import ProfileQueries
from app.schemas.agents import (AgentDetailDefaultRequest, AgentDetailRequest,
                                AgentDetailResponse, AgentItem,
                                AgentsListRequest, AgentsListResponse,
                                CreateAgentRequest, CreateAgentResponse,
                                DebugInfoItem, DeleteAgentRequest,
                                DeleteAgentResponse, DuplicateAgentRequest,
                                DuplicateAgentResponse, UpdateAgentRequest,
                                UpdateAgentResponse)
from app.schemas.base import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem,
                              ReasoningMappingItem)
from app.services.base_service import BaseService, with_cache


class AgentService(BaseService):
    """Service for agent operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = AgentQueries()
        self.profile_queries = ProfileQueries()

    async def _get_default_guest_profile_id(self) -> uuid.UUID | None:
        """Get default guest profile ID using queries directly."""
        query, params = self.profile_queries.get_default_guest_profile()
        result = await self.conn.fetchrow(query, *params)
        if result:
            return uuid.UUID(str(result["id"]))
        return None

    @with_cache(lambda self, request: keys.agent_list(request.profileId))
    async def get_agents_list(self, request: AgentsListRequest) -> AgentsListResponse:
        """
        Get list of agents with permissions.

        Args:
            request: List request

        Returns:
            AgentsListResponse
        """
        return await self._get_agents_list_direct(request)

    async def _get_agents_list_direct(
        self, request: AgentsListRequest
    ) -> AgentsListResponse:
        """Direct execution without cache."""
        # Get agents with model information in ONE optimized query
        query, params = self.queries.get_agents_list_complete(request.profileId)
        rows = await self.conn.fetch(query, *params)

        # Build model mapping and department mapping from the single result set
        model_mapping: ModelMapping = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        agents: list[AgentItem] = []

        for row in rows:
            # Add to model mapping if we have model info
            model_id = row["model_id"]
            if model_id and model_id not in model_mapping:
                model_mapping[model_id] = ModelMappingItem(
                    name=row["model_name"] or "",
                    description=row["model_description"] or "",
                )

            # Parse department_ids
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Parse department_mapping from first row (same for all agents)
            if not department_mapping and row.get("department_mapping"):
                dm = row["department_mapping"]
                if isinstance(dm, str):
                    dm = json.loads(dm)
                if isinstance(dm, dict):
                    for did, ddata in dm.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata["name"], description=ddata["description"]
                            )

            agents.append(
                AgentItem(
                    agent_id=row["agent_id"],
                    name=row["name"],
                    description=row["description"],
                    reasoning=row["reasoning"],
                    temperature=float(row["temperature"]) if row["temperature"] is not None else 0.0,
                    model_id=model_id,
                    role=row["role"] or "",
                    department_ids=dept_ids,
                    updated_at=row["updated_at"].isoformat(),
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )

        return AgentsListResponse(
            agents=agents, 
            model_mapping=model_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.agent_by_id(request.agentId))
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
        return await self._get_agent_detail_direct(request)

    async def _get_agent_detail_direct(
        self, request: AgentDetailRequest
    ) -> AgentDetailResponse:
        """Direct execution without cache."""
        # Get agent detail with debug info, departments, and all models in ONE optimized query
        query, params = self.queries.get_agent_detail_complete(
            request.agentId, request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Agent {request.agentId} not found")

        # Parse debug_info from JSONB (may be string or list)
        debug_info: list[DebugInfoItem] = []
        debug_info_data = result["debug_info"]
        if isinstance(debug_info_data, str):
            debug_info_data = json.loads(debug_info_data)
        if debug_info_data and isinstance(debug_info_data, list):
            for item in debug_info_data:
                if isinstance(item, dict):
                    created_at_value = item.get("created_at")
                    debug_info.append(
                        DebugInfoItem(
                            created_at=created_at_value.isoformat()
                            if created_at_value
                            else "",
                            model_id=item.get("model_id", ""),
                            content=item.get("content", ""),
                        )
                    )

        # Parse model_mapping from JSONB (may be string or dict)
        model_mapping: ModelMapping = {}
        model_mapping_data = result["model_mapping"]
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for model_id, model_data in model_mapping_data.items():
                if isinstance(model_data, dict):
                    model_mapping[model_id] = ModelMappingItem(
                        name=model_data.get("name", ""),
                        description=model_data.get("description", ""),
                    )

        # Parse valid_model_ids from JSONB (may be string or list)
        valid_model_ids: list[str] = []
        valid_model_ids_data = result["valid_model_ids"]
        if isinstance(valid_model_ids_data, str):
            valid_model_ids_data = json.loads(valid_model_ids_data)
        if valid_model_ids_data and isinstance(valid_model_ids_data, list):
            valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

        # Parse department_ids from array (PostgreSQL arrays come as lists)
        department_ids_raw = result.get("department_ids")
        department_ids: list[str] = []
        if department_ids_raw and isinstance(department_ids_raw, (list, tuple)):  # type: ignore
            department_ids = [str(did) for did in department_ids_raw if did]

        # Parse valid_department_ids from array (PostgreSQL arrays come as lists)
        valid_department_ids_raw = result.get("valid_department_ids")
        valid_department_ids: list[str] = []
        if valid_department_ids_raw and isinstance(valid_department_ids_raw, (list, tuple)):  # type: ignore
            valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

        # Parse department_mapping from JSONB (may be string or dict)
        department_mapping: DepartmentMapping = {}
        department_mapping_data = result.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for dept_id, dept_data in department_mapping_data.items():
                if isinstance(dept_data, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=dept_data.get("name", ""),
                        description=dept_data.get("description", ""),
                    )

        # Parse prompt_mapping from JSONB (may be string or dict)
        from app.schemas.agents import PromptInfo
        prompt_mapping: dict[str, PromptInfo] = {}
        prompt_mapping_data = result.get("prompt_mapping")
        if isinstance(prompt_mapping_data, str):
            prompt_mapping_data = json.loads(prompt_mapping_data)
        if prompt_mapping_data and isinstance(prompt_mapping_data, dict):
            for prompt_id, prompt_data in prompt_mapping_data.items():
                if isinstance(prompt_data, dict):
                    dept_ids = prompt_data.get("department_ids")
                    if isinstance(dept_ids, list):
                        dept_ids = [str(did) for did in dept_ids if did]
                    elif dept_ids is None:
                        dept_ids = None
                    else:
                        dept_ids = None
                    prompt_mapping[prompt_id] = PromptInfo(
                        system_prompt=prompt_data.get("system_prompt", ""),
                        created_at=prompt_data.get("created_at", ""),
                        updated_at=prompt_data.get("updated_at", ""),
                        department_ids=dept_ids,
                    )

        # Parse prompt_id
        prompt_id = result.get("prompt_id")
        if prompt_id:
            prompt_id = str(prompt_id)

        # Parse department_prompt_links from JSONB (may be string or dict)
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_data = result.get("department_prompt_links")
        if isinstance(department_prompt_links_data, str):
            department_prompt_links_data = json.loads(department_prompt_links_data)
        if department_prompt_links_data and isinstance(department_prompt_links_data, dict):
            department_prompt_links = {
                str(dept_id): str(prompt_id)
                for dept_id, prompt_id in department_prompt_links_data.items()
            }

        # Build reasoning_mapping following the reasoning_effort enum
        # Matches database enum: ('none', 'minimal', 'low', 'medium', 'high')
        reasoning_mapping = {
            "none": ReasoningMappingItem(
                name="None", description="No extended reasoning"
            ),
            "minimal": ReasoningMappingItem(
                name="Minimal", description="Basic reasoning for straightforward tasks"
            ),
            "low": ReasoningMappingItem(
                name="Low", description="Light reasoning for simple problem-solving"
            ),
            "medium": ReasoningMappingItem(
                name="Medium", description="Balanced reasoning for moderate complexity"
            ),
            "high": ReasoningMappingItem(
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        return AgentDetailResponse(
            name=result["name"],
            description=result["description"],
            system_prompt=result["system_prompt"],
            prompt_id=prompt_id,
            temperature=float(result["temperature"]) if result["temperature"] is not None else 0.0,
            model_id=result["model_id"],
            reasoning=result["reasoning"],
            active=result["active"],
            role=result.get("role", "assistant"),
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links=department_prompt_links,
            prompt_mapping=prompt_mapping,
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=debug_info,
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
        )

    @with_cache(lambda self, request: keys.agent_default(request.profileId))
    async def get_agent_detail_default(
        self, request: AgentDetailDefaultRequest
    ) -> AgentDetailResponse:
        """
        Get default agent detail metadata for creating new agents.

        Returns valid models, reasoning options, temperature bounds, etc.
        but no actual agent data since there's no "default agent" concept.

        Args:
            request: Detail default request

        Returns:
            AgentDetailResponse with default/empty values
        """
        return await self._get_agent_detail_default_direct(request)

    async def _get_agent_detail_default_direct(
        self, request: AgentDetailDefaultRequest
    ) -> AgentDetailResponse:
        """Direct execution without cache."""
        # Get valid models and departments in ONE optimized query
        query, params = self.queries.get_agent_detail_default_complete(
            request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        # Initialize defaults
        model_mapping: ModelMapping = {}
        valid_model_ids: list[str] = []
        department_mapping: DepartmentMapping = {}
        valid_department_ids: list[str] = []

        if result:
            # Parse model_mapping from JSONB (may be string or dict)
            model_mapping_data = result["model_mapping"]
            if isinstance(model_mapping_data, str):
                model_mapping_data = json.loads(model_mapping_data)
            if model_mapping_data and isinstance(model_mapping_data, dict):
                for model_id, model_data in model_mapping_data.items():
                    if isinstance(model_data, dict):
                        model_mapping[model_id] = ModelMappingItem(
                            name=model_data.get("name", ""),
                            description=model_data.get("description", ""),
                        )

            # Parse valid_model_ids from JSONB (may be string or list)
            valid_model_ids_data = result["valid_model_ids"]
            if isinstance(valid_model_ids_data, str):
                valid_model_ids_data = json.loads(valid_model_ids_data)
            if valid_model_ids_data and isinstance(valid_model_ids_data, list):
                valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

            # Parse valid_department_ids from array
            valid_department_ids_raw = result.get("valid_department_ids") or []
            if isinstance(valid_department_ids_raw, str):
                valid_department_ids_raw = (
                    json.loads(valid_department_ids_raw) if valid_department_ids_raw else []
                )
            if isinstance(valid_department_ids_raw, list):
                valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

            # Parse department_mapping from JSONB (may be string or dict)
            department_mapping_data = result.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for dept_id, dept_data in department_mapping_data.items():
                    if isinstance(dept_data, dict):
                        # Agent form doesn't need any ID arrays, just name/description
                        department_mapping[dept_id] = DepartmentMappingItem(
                            name=dept_data.get("name", ""),
                            description=dept_data.get("description", ""),
                        )

        # Build reasoning_mapping following the reasoning_effort enum
        reasoning_mapping = {
            "none": ReasoningMappingItem(
                name="None", description="No extended reasoning"
            ),
            "minimal": ReasoningMappingItem(
                name="Minimal", description="Basic reasoning for straightforward tasks"
            ),
            "low": ReasoningMappingItem(
                name="Low", description="Light reasoning for simple problem-solving"
            ),
            "medium": ReasoningMappingItem(
                name="Medium", description="Balanced reasoning for moderate complexity"
            ),
            "high": ReasoningMappingItem(
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        return AgentDetailResponse(
            name="",
            description="",
            system_prompt="",
            prompt_id=None,
            temperature=0.7,
            model_id="",
            reasoning=None,
            active=True,
            role="assistant",
            department_ids=[],
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links={},
            prompt_mapping={},
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=[],
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
        )

    async def create_agent(self, request: CreateAgentRequest) -> CreateAgentResponse:
        """
        Create a new agent.

        Args:
            request: Create request

        Returns:
            CreateAgentResponse
        """
        async with self.conn.transaction():
            # Create agent (without system_prompt)
            query, params = self.queries.create_agent(
                request.name,
                request.description,
                request.temperature,
                request.model_id,
                request.reasoning,
                request.active,
                request.role,
            )
            agent_row = await self.conn.fetchrow(query, *params)

            if not agent_row:
                raise ValueError("Failed to create agent")

            agent_id = agent_row["agent_id"]

            # Handle prompt creation/linking
            prompt_id = None
            if request.prompt_id:
                # Use existing prompt
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt
                prompt_query, prompt_params = self.queries.create_prompt(
                    request.system_prompt
                )
                prompt_row = await self.conn.fetchrow(prompt_query, *prompt_params)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

                # Link prompt to departments if provided
                if request.department_ids:
                    prompt_dept_query, prompt_dept_params = (
                        self.queries.create_prompt_departments(
                            prompt_id, request.department_ids
                        )
                    )
                    await self.conn.execute(prompt_dept_query, *prompt_dept_params)

            # Link agent to prompt via agent_prompts junction
            if prompt_id:
                agent_prompt_query, agent_prompt_params = (
                    self.queries.create_agent_prompt(agent_id, prompt_id)
                )
                await self.conn.execute(agent_prompt_query, *agent_prompt_params)

            # Create agent-department links if department_ids provided
            if request.department_ids:
                dept_query, dept_params = self.queries.create_agent_departments(
                    agent_id, request.department_ids
                )
                await self.conn.execute(dept_query, *dept_params)

        # Invalidate caches
        await self._invalidate_cache([keys.tag_agent_all()])

        return CreateAgentResponse(
            success=True,
            agentId=agent_id,
            message="Agent created successfully",
        )

    async def update_agent(self, request: UpdateAgentRequest) -> UpdateAgentResponse:
        """
        Update an agent.

        Args:
            request: Update request

        Returns:
            UpdateAgentResponse
        """
        async with self.conn.transaction():
            # Update agent (without system_prompt)
            query, params = self.queries.update_agent(
                request.agentId,
                request.name,
                request.description,
                request.temperature,
                request.model_id,
                request.reasoning,
                request.active,
                request.role,
            )
            await self.conn.execute(query, *params)

            # Handle prompt update
            prompt_id = None
            if request.prompt_id:
                # Use existing prompt
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt (for version history)
                prompt_query, prompt_params = self.queries.create_prompt(
                    request.system_prompt
                )
                prompt_row = await self.conn.fetchrow(prompt_query, *prompt_params)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

                # Link prompt to departments if provided
                if request.department_ids:
                    prompt_dept_query, prompt_dept_params = (
                        self.queries.create_prompt_departments(
                            prompt_id, request.department_ids
                        )
                    )
                    await self.conn.execute(prompt_dept_query, *prompt_dept_params)

            # Handle department-specific prompt or default prompt
            if request.department_id and prompt_id:
                # Update department-specific prompt via agent_departments
                dept_prompt_query, dept_prompt_params = (
                    self.queries.create_or_update_agent_department_prompt(
                        request.agentId, request.department_id, prompt_id
                    )
                )
                await self.conn.execute(dept_prompt_query, *dept_prompt_params)
            elif prompt_id:
                # Link agent to prompt via agent_prompts junction (deactivates old, activates new)
                # Only do this if NOT updating a department-specific prompt
                agent_prompt_query, agent_prompt_params = (
                    self.queries.create_agent_prompt(request.agentId, prompt_id)
                )
                await self.conn.execute(agent_prompt_query, *agent_prompt_params)

            # Replace agent-department links (DELETE + INSERT pattern)
            delete_query, delete_params = self.queries.delete_agent_departments(
                request.agentId
            )
            await self.conn.execute(delete_query, *delete_params)

            # Insert new links if department_ids provided
            if request.department_ids:
                insert_query, insert_params = self.queries.create_agent_departments(
                    request.agentId, request.department_ids
                )
                await self.conn.execute(insert_query, *insert_params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_agent_by_id(request.agentId),
                keys.tag_agent_all(),
                keys.tag_department_all(),  # Departments reference agents
            ]
        )

        return UpdateAgentResponse(success=True, message="Agent updated successfully")

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

        # Invalidate caches
        await self._invalidate_cache([keys.tag_agent_all()])

        return DuplicateAgentResponse(
            success=True,
            agentId=new_agent_row["agent_id"],
            message="Agent duplicated successfully",
        )

    async def delete_agent(self, request: DeleteAgentRequest) -> DeleteAgentResponse:
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

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_agent_by_id(request.agentId),
                keys.tag_agent_all(),
                keys.tag_department_all(),
            ]
        )

        return DeleteAgentResponse(success=True, message="Agent deleted successfully")

    @with_cache(
        lambda self, document_ids, department_id: keys.agent_classification_context(
            [str(d) for d in document_ids], str(department_id)
        )
    )
    async def get_classification_run_context(
        self, document_ids: list[uuid.UUID], department_id: uuid.UUID
    ) -> dict[str, Any]:
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
        return await self._get_classification_run_context_direct(
            document_ids, department_id
        )

    async def _get_classification_run_context_direct(
        self, document_ids: list[uuid.UUID], department_id: uuid.UUID
    ) -> dict[str, Any]:
        """Direct execution without cache."""
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
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )

        return {
            # Agent data
            "agent_id": context_row["agent_id"],
            "name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Documents
            "documents": documents,
        }

    async def batch_update_document_types(
        self, document_updates: dict[uuid.UUID, str]
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

        # Invalidate affected caches
        await self._invalidate_cache([keys.tag_agent_all()])

        return count

    @with_cache(
        lambda self,
        department_id,
        persona_id=None,
        document_ids=None,
        parameter_item_ids=None: keys.agent_scenario_context(
            str(department_id),
            str(persona_id) if persona_id else None,
            [str(d) for d in document_ids] if document_ids else None,
            [str(p) for p in parameter_item_ids] if parameter_item_ids else None,
        )
    )
    async def get_scenario_run_context(
        self,
        department_id: uuid.UUID,
        persona_id: uuid.UUID | None = None,
        document_ids: list[uuid.UUID] | None = None,
        parameter_item_ids: list[uuid.UUID] | None = None,
    ) -> dict[str, Any]:
        """
        Get all data needed to run scenario agent with optimized query.

        Reduces 8-10 database queries to 1 JOIN query.
        
        Agent selection: First tries department-specific scenario agent,
        falls back to cross-department scenario agent if no department link exists.

        Args:
            department_id: UUID of the department (used for prioritization)
            persona_id: Optional persona UUID
            document_ids: Optional list of document UUIDs
            parameter_item_ids: Optional list of parameter item UUIDs

        Returns:
            Dict with agent, model, provider, persona, documents,
            parameter_items, and default_guest_profile_id

        Raises:
            ValueError: If no scenario agent configured (neither department-specific nor cross-department)
        """
        return await self._get_scenario_run_context_direct(
            department_id, persona_id, document_ids, parameter_item_ids
        )

    async def _get_scenario_run_context_direct(
        self,
        department_id: uuid.UUID,
        persona_id: uuid.UUID | None = None,
        document_ids: list[uuid.UUID] | None = None,
        parameter_item_ids: list[uuid.UUID] | None = None,
    ) -> dict[str, Any]:
        """Direct execution without cache."""
        # Convert UUIDs to strings for query
        department_id_str = str(department_id)
        persona_id_str = str(persona_id) if persona_id else None
        document_ids_str = [str(d) for d in document_ids] if document_ids else None
        parameter_item_ids_str = (
            [str(p) for p in parameter_item_ids] if parameter_item_ids else None
        )

        # Single optimized JOIN query
        query, params = self.queries.get_scenario_run_context(
            department_id_str, persona_id_str, document_ids_str, parameter_item_ids_str
        )
        context_row = await self.conn.fetchrow(query, *params)

        if not context_row:
            raise ValueError(
                "No scenario agent configured (neither department-specific nor cross-department)"
            )

        # Parse JSON arrays
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )
        parameter_items = (
            json.loads(context_row["parameter_items"])
            if isinstance(context_row["parameter_items"], str)
            else context_row["parameter_items"]
        )

        # Build persona dict if persona was requested and found
        persona = None
        if persona_id and context_row["persona_id"]:
            persona = {
                "id": context_row["persona_id"],
                "name": context_row["persona_name"],
                "description": context_row["persona_description"],
            }

        return {
            # Agent data
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Entity data
            "persona": persona,
            "documents": documents,
            "parameter_items": parameter_items,
            # Default guest profile
            "default_guest_profile_id": context_row["guest_profile_id"],
        }

    @with_cache(lambda self, chat_id: keys.agent_simulation_context(str(chat_id)))
    async def get_simulation_run_context(self, chat_id: uuid.UUID) -> dict[str, Any]:
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
        return await self._get_simulation_run_context_direct(chat_id)

    async def _get_simulation_run_context_direct(
        self, chat_id: uuid.UUID
    ) -> dict[str, Any]:
        """Direct execution without cache."""
        chat_id_str = str(chat_id)

        # Single optimized JOIN query
        query, params = self.queries.get_simulation_run_context(chat_id_str)
        context_row = await self.conn.fetchrow(query, *params)

        if not context_row:
            raise ValueError(
                f"Simulation chat {chat_id} not found or missing required data"
            )

        # Validate required fields
        if not context_row["persona_id"]:
            raise ValueError(
                f"Scenario has no persona assigned. This is a data integrity issue - "
                f"please ensure the scenario has a persona configured."
            )
        if not context_row["api_key"]:
            raise ValueError(
                f"Provider API key is not configured. This is a data integrity issue - "
                f"please ensure the provider has an API key."
            )

        # Parse documents JSON array
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )

        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            profile_id = await self._get_default_guest_profile_id()

        return {
            # Chat data
            "chat_id": context_row["chat_id"],
            "chat_title": context_row["chat_title"],
            "trace_id": context_row["trace_id"],
            # Attempt data
            "attempt_id": context_row["attempt_id"],
            "simulation_id": context_row["simulation_id"],
            # Scenario data
            "scenario_id": context_row["scenario_id"],
            "department_id": context_row["department_id"],
            "problem_statement": context_row["problem_statement"],
            # Persona data
            "persona_id": context_row["persona_id"],
            "persona_name": context_row["persona_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Scenario settings (flags moved from simulations to scenarios)
            "image_input_active": context_row["image_input_enabled"],
            "output_guardrail_active": context_row["output_guardrail_enabled"],
            # Profile data (resolved to guest if null)
            "profile_id": profile_id,
            # Documents (full document data, not just IDs)
            "documents": documents,
        }

    @with_cache(
        lambda self, simulation_chat_id, department_id: keys.agent_grading_context(
            str(simulation_chat_id), str(department_id)
        )
    )
    async def get_grading_run_context(
        self, simulation_chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
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
        return await self._get_grading_run_context_direct(
            simulation_chat_id, department_id
        )

    async def _get_grading_run_context_direct(
        self, simulation_chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
        """Direct execution without cache."""
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
        standard_groups = (
            json.loads(context_row["standard_groups"])
            if isinstance(context_row["standard_groups"], str)
            else context_row["standard_groups"]
        )
        standards = (
            json.loads(context_row["standards"])
            if isinstance(context_row["standards"], str)
            else context_row["standards"]
        )

        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            profile_id = await self._get_default_guest_profile_id()

        return {
            # Chat data
            "chat_id": context_row["chat_id"],
            "scenario_id": context_row["scenario_id"],
            "attempt_id": context_row["attempt_id"],
            "title": context_row["title"],
            "trace_id": context_row["trace_id"],
            "created_at": context_row["created_at"],
            "completed": context_row["completed"],
            # Scenario data
            "problem_statement": context_row["problem_statement"],
            # Attempt data
            "total_chats": context_row["total_chats"],
            # Simulation data
            "simulation_id": context_row["simulation_id"],
            "time_limit": context_row["time_limit"],
            # Rubric data
            "rubric": {
                "id": context_row["rubric_id"],
                "name": context_row["rubric_name"],
                "description": context_row["rubric_description"],
                "points": context_row["rubric_points"],
                "pass_points": context_row["rubric_pass_points"],
            },
            # Standard groups and standards
            "standard_groups": standard_groups,
            "standards": standards,
            # Agent data
            "agent": {
                "id": context_row["agent_id"],
                "name": context_row["agent_name"],
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
                "reasoning": context_row["reasoning"],
            },
            # Model data
            "model": {
                "id": context_row["model_id"],
                "name": context_row["model_name"],
                "custom_model": context_row["custom_model"],
            },
            # Provider data
            "provider": {
                "id": context_row["provider_id"],
                "name": context_row["provider_name"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
            },
            # Profile data (resolved to guest if null)
            "profile_id": profile_id,
        }

    @with_cache(
        lambda self, simulation_chat_id: keys.agent_simulation_messages(
            str(simulation_chat_id)
        ),
        fresh_ttl=10,
        stale_ttl=60,
    )
    async def get_simulation_messages(
        self, simulation_chat_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """
        Get all messages for a simulation chat.

        Args:
            simulation_chat_id: UUID of the simulation chat

        Returns:
            List of message dicts
        """
        return await self._get_simulation_messages_direct(simulation_chat_id)

    async def _get_simulation_messages_direct(
        self, simulation_chat_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """Direct execution without cache."""
        simulation_chat_id_str = str(simulation_chat_id)

        query, params = self.queries.get_simulation_messages(simulation_chat_id_str)
        rows = await self.conn.fetch(query, *params)

        return [dict(row) for row in rows]

    async def create_simulation_hint(
        self, hint_text: str, message_id: uuid.UUID
    ) -> dict[str, Any]:
        """
        Create a simulation hint for a message.

        Args:
            hint_text: The hint content
            message_id: UUID of the message

        Returns:
            Dict with simulation_message_id and idx (composite PK)
        """
        message_id_str = str(message_id)

        query, params = self.queries.create_simulation_hint(hint_text, message_id_str)
        result = await self.conn.fetchrow(query, *params)

        # Invalidate simulation messages cache
        await self._invalidate_cache([keys.tag_agent_all()])

        return {
            "simulation_message_id": str(result["simulation_message_id"]),
            "idx": result["idx"],
        }

    @with_cache(
        lambda self, message_id, chat_id, department_id: keys.agent_hint_context(
            str(message_id), str(chat_id), str(department_id)
        )
    )
    async def get_hint_run_context(
        self, message_id: uuid.UUID, chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
        """
        Get all data needed to run hint agent with optimized query.

        Reduces 12+ database queries to 1 JOIN query.
        Messages are fetched separately using get_simulation_messages().

        Args:
            message_id: UUID of the target message
            chat_id: UUID of the simulation chat
            department_id: UUID of the department

        Returns:
            Dict with message, chat, attempt, scenario, agent, model, provider,
            profile, and document IDs data

        Raises:
            ValueError: If message/chat not found or no hint agent configured for department
        """
        return await self._get_hint_run_context_direct(
            message_id, chat_id, department_id
        )

    async def _get_hint_run_context_direct(
        self, message_id: uuid.UUID, chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
        """Direct execution without cache."""
        message_id_str = str(message_id)
        chat_id_str = str(chat_id)
        department_id_str = str(department_id)

        # Single optimized JOIN query
        query, params = self.queries.get_hint_run_context(
            message_id_str, chat_id_str, department_id_str
        )
        context_row = await self.conn.fetchrow(query, *params)

        if not context_row:
            raise ValueError(
                f"Message {message_id} in chat {chat_id} not found or "
                f"no hint agent configured for department {department_id}"
            )

        # Parse JSON array for documents
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )

        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            profile_id = await self._get_default_guest_profile_id()

        return {
            # Message data
            "message_id": context_row["message_id"],
            "message_created_at": context_row["message_created_at"],
            # Chat data
            "chat_id": context_row["chat_id"],
            "attempt_id": context_row["attempt_id"],
            "scenario_id": context_row["scenario_id"],
            "trace_id": context_row["trace_id"],
            "chat_title": context_row["chat_title"],
            # Attempt data
            "simulation_id": context_row["simulation_id"],
            # Scenario data
            "problem_statement": context_row["problem_statement"],
            # Agent data
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Profile data (resolved to guest if null)
            "profile_id": profile_id,
            # Documents (full document data, not just IDs)
            "documents": documents,
        }

    @with_cache(
        lambda self,
        chat_id,
        department_id,
        guardrail_type: keys.agent_guardrail_context(
            str(chat_id), str(department_id), guardrail_type
        )
    )
    async def get_guardrail_run_context(
        self, chat_id: uuid.UUID, department_id: uuid.UUID, guardrail_type: str
    ) -> dict[str, Any]:
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

        return await self._get_guardrail_run_context_direct(
            chat_id, department_id, guardrail_type
        )

    async def _get_guardrail_run_context_direct(
        self, chat_id: uuid.UUID, department_id: uuid.UUID, guardrail_type: str
    ) -> dict[str, Any]:
        """Direct execution without cache."""
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

        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            profile_id = await self._get_default_guest_profile_id()

        return {
            # Agent data
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Chat data
            "chat_id": context_row["chat_id"],
            "chat_title": context_row["chat_title"],
            "trace_id": context_row["trace_id"],
            # Attempt data
            "attempt_id": context_row["attempt_id"],
            "simulation_id": context_row["simulation_id"],
            # Profile data (resolved to guest if null)
            "profile_id": profile_id,
        }

    @with_cache(
        lambda self, chat_id, department_id: keys.agent_title_context(
            str(chat_id), str(department_id)
        )
    )
    async def get_title_run_context(
        self, chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
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
        return await self._get_title_run_context_direct(chat_id, department_id)

    async def _get_title_run_context_direct(
        self, chat_id: uuid.UUID, department_id: uuid.UUID
    ) -> dict[str, Any]:
        """Direct execution without cache."""
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

        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            profile_id = await self._get_default_guest_profile_id()

        return {
            # Agent data
            "agent_id": context_row["agent_id"],
            "name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Chat data
            "chat_id": context_row["chat_id"],
            "profile_id": profile_id,
            "chat_title": context_row["chat_title"],
            "trace_id": context_row["trace_id"],
        }


def get_agent_service(conn: asyncpg.Connection) -> AgentService:
    """Get agent service instance."""
    return AgentService(conn)
