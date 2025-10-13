"""Agent query builders with dynamic SQL."""

from typing import Any, Dict


class AgentQueries:
    """Query builders for agent operations."""

    def get_agents_list(self, profile_id: str) -> tuple[str, Dict[str, Any]]:
        """
        Get agents list with permissions.

        Agents are system-wide, no department filtering.
        Permissions based on user role (superadmin only).

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            a.id::text as agent_id,
            a.name,
            a.description,
            a.reasoning,
            a.temperature,
            a.model_id::text,
            a.updated_at,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_edit,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_delete
        FROM agents a
        CROSS JOIN user_profile up
        ORDER BY a.name
        """

        params: Dict[str, Any] = {"profile_id": profile_id}

        return query, params

    def get_agent_detail(self, agent_id: str) -> tuple[str, Dict[str, Any]]:
        """
        Get basic agent information.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as agent_id,
            name,
            description,
            system_prompt,
            temperature,
            model_id::text,
            reasoning
        FROM agents
        WHERE id = :agent_id
        """

        params: Dict[str, Any] = {"agent_id": agent_id}

        return query, params

    def get_debug_info_for_agent(
        self, agent_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Get debug info for an agent via model_run_agents junction.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            di.created_at,
            mrm.model_id::text,
            di.content
        FROM model_run_agents mra
        JOIN model_runs mr ON mr.id = mra.model_run_id
        JOIN debug_info di ON di.model_run_id = mr.id
        JOIN model_run_models mrm ON mrm.model_run_id = mr.id
        WHERE mra.agent_id = :agent_id
        AND mra.active = true
        AND mrm.active = true
        ORDER BY di.created_at DESC
        LIMIT 100
        """

        params: Dict[str, Any] = {"agent_id": agent_id}

        return query, params

    def get_valid_models(self) -> tuple[str, Dict[str, Any]]:
        """
        Get all active models for selection.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as model_id,
            name
        FROM models
        WHERE active = true
        ORDER BY name
        """

        params: Dict[str, Any] = {}

        return query, params

    def get_model_mapping(self, model_ids: list[str]) -> tuple[str, Dict[str, Any]]:
        """
        Get model mapping for given model IDs.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as model_id,
            name
        FROM models
        WHERE id = ANY(:model_ids)
        """

        params: Dict[str, Any] = {"model_ids": model_ids}

        return query, params

    def create_agent(
        self,
        name: str,
        description: str,
        system_prompt: str,
        temperature: float,
        model_id: str,
        reasoning: str | None,
    ) -> tuple[str, Dict[str, Any]]:
        """
        Create a new agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO agents (name, description, system_prompt, temperature, model_id, reasoning, created_at, updated_at)
        VALUES (:name, :description, :system_prompt, :temperature, :model_id, :reasoning, NOW(), NOW())
        RETURNING id::text as agent_id
        """

        params: Dict[str, Any] = {
            "name": name,
            "description": description,
            "system_prompt": system_prompt,
            "temperature": temperature,
            "model_id": model_id,
            "reasoning": reasoning,
        }

        return query, params

    def update_agent(
        self,
        agent_id: str,
        name: str,
        description: str,
        system_prompt: str,
        temperature: float,
        model_id: str,
        reasoning: str | None,
    ) -> tuple[str, Dict[str, Any]]:
        """
        Update an agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE agents
        SET 
            name = :name,
            description = :description,
            system_prompt = :system_prompt,
            temperature = :temperature,
            model_id = :model_id,
            reasoning = :reasoning,
            updated_at = NOW()
        WHERE id = :agent_id
        """

        params: Dict[str, Any] = {
            "agent_id": agent_id,
            "name": name,
            "description": description,
            "system_prompt": system_prompt,
            "temperature": temperature,
            "model_id": model_id,
            "reasoning": reasoning,
        }

        return query, params

    def duplicate_agent(
        self, agent_id: str, new_name: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Duplicate an agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO agents (name, description, system_prompt, temperature, model_id, reasoning, created_at, updated_at)
        SELECT :new_name, description, system_prompt, temperature, model_id, reasoning, NOW(), NOW()
        FROM agents
        WHERE id = :agent_id
        RETURNING id::text as agent_id
        """

        params: Dict[str, Any] = {
            "agent_id": agent_id,
            "new_name": new_name,
        }

        return query, params

    def delete_agent(self, agent_id: str) -> tuple[str, Dict[str, Any]]:
        """
        Delete an agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM agents
        WHERE id = :agent_id
        """

        params: Dict[str, Any] = {"agent_id": agent_id}

        return query, params

    def check_agent_usage(self, agent_id: str) -> tuple[str, Dict[str, Any]]:
        """
        Check if agent is in use.

        Returns count of:
        - department_agents (assigned to departments)
        - model_run_agents (used in model runs)

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT
            (SELECT COUNT(*) FROM department_agents WHERE agent_id = :agent_id) as department_agent_count,
            (SELECT COUNT(*) FROM model_run_agents WHERE agent_id = :agent_id) as model_run_agent_count
        """

        params: Dict[str, Any] = {"agent_id": agent_id}

        return query, params

