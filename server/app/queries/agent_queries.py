"""Agent query builders with dynamic SQL."""

from typing import Any, List


class AgentQueries:
    """Query builders for agent operations."""

    def get_agents_list(self, profile_id: str) -> tuple[str, List[Any]]:
        """
        Get agents list with permissions.

        Agents are system-wide, no department filtering.
        Permissions based on user role (superadmin only).

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = $1
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

        params: List[Any] = [profile_id]

        return query, params

    def get_agent_detail(self, agent_id: str) -> tuple[str, List[Any]]:
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
        WHERE id = $1
        """

        params: List[Any] = [agent_id]

        return query, params

    def get_debug_info_for_agent(
        self, agent_id: str
    ) -> tuple[str, List[Any]]:
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
        WHERE mra.agent_id = $1
        AND mra.active = true
        AND mrm.active = true
        ORDER BY di.created_at DESC
        LIMIT 100
        """

        params: List[Any] = [agent_id]

        return query, params

    def get_valid_models(self) -> tuple[str, List[Any]]:
        """
        Get all active models for selection.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as model_id,
            name,
            COALESCE(description, '') as description
        FROM models
        WHERE active = true
        ORDER BY name
        """

        params: List[Any] = []

        return query, params

    def get_model_mapping(self, model_ids: list[str]) -> tuple[str, List[Any]]:
        """
        Get model mapping for given model IDs.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as model_id,
            name,
            COALESCE(description, '') as description
        FROM models
        WHERE id = ANY($1)
        """

        params: List[Any] = [model_ids]

        return query, params

    def create_agent(
        self,
        name: str,
        description: str,
        system_prompt: str,
        temperature: float,
        model_id: str,
        reasoning: str | None,
    ) -> tuple[str, List[Any]]:
        """
        Create a new agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO agents (name, description, system_prompt, temperature, model_id, reasoning, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id::text as agent_id
        """

        params: List[Any] = [name, description, system_prompt, temperature, model_id, reasoning]

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
    ) -> tuple[str, List[Any]]:
        """
        Update an existing agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE agents
        SET 
            name = $2,
            description = $3,
            system_prompt = $4,
            temperature = $5,
            model_id = $6,
            reasoning = $7,
            updated_at = NOW()
        WHERE id = $1
        """

        params: List[Any] = [agent_id, name, description, system_prompt, temperature, model_id, reasoning]

        return query, params

    def duplicate_agent(
        self, agent_id: str
    ) -> tuple[str, List[Any]]:
        """
        Duplicate an agent (copy with 'Copy' suffix).

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO agents (name, description, system_prompt, temperature, model_id, reasoning, created_at, updated_at)
        SELECT 
            name || ' Copy',
            description,
            system_prompt,
            temperature,
            model_id,
            reasoning,
            NOW(),
            NOW()
        FROM agents
        WHERE id = $1
        RETURNING id::text as agent_id
        """

        params: List[Any] = [agent_id]

        return query, params

    def delete_agent(self, agent_id: str) -> tuple[str, List[Any]]:
        """
        Delete an agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM agents WHERE id = $1
        """

        params: List[Any] = [agent_id]

        return query, params

    def get_classification_run_context(
        self, document_ids: list[str], department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run classification agent with optimized JOIN.
        
        Fetches agent (via department_agents), model, provider, and documents
        in a single query to minimize database round trips.

        Args:
            document_ids: List of document UUIDs as strings
            department_id: Department UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            -- Agent data (via department_agents junction for 'classify' role)
            a.id::text as agent_id,
            a.name as agent_name,
            a.system_prompt,
            a.temperature,
            a.reasoning,
            
            -- Model data
            m.id::text as model_id,
            m.name as model_name,
            m.custom_model,
            
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            pr.base_url,
            pr.api_key,
            
            -- Documents data (aggregated as JSON array)
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', d.id::text,
                        'name', d.name,
                        'type', d.type
                    )
                    ORDER BY d.name
                ) FILTER (WHERE d.id IS NOT NULL),
                '[]'::json
            ) as documents
        
        FROM department_agents da
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN documents d ON d.id = ANY($1::uuid[])
        WHERE da.department_id = $2 AND da.role = 'classify'
        GROUP BY a.id, a.name, a.system_prompt, a.temperature, a.reasoning,
                 m.id, m.name, m.custom_model,
                 pr.id, pr.name, pr.base_url, pr.api_key
        """
        
        params: list[Any] = [document_ids, department_id]
        return query, params

    def batch_update_document_types(self) -> tuple[str, List[Any]]:
        """
        Batch update document types using UNNEST for efficiency.
        
        Returns query that accepts two arrays: document_ids and types.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE documents
        SET type = updates.new_type
        FROM (
            SELECT 
                UNNEST($1::uuid[]) as doc_id,
                UNNEST($2::text[]) as new_type
        ) as updates
        WHERE documents.id = updates.doc_id
        """
        return query, []

    def get_guardrail_run_context(
        self, chat_id: str, department_id: str, guardrail_type: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run guardrail agent with optimized JOIN.
        
        Fetches agent (via department_agents), model, provider, chat, attempt,
        and active profile in a single query to minimize database round trips.

        Args:
            chat_id: Chat UUID as string
            department_id: Department UUID as string
            guardrail_type: Either "input" or "output" for role filtering

        Returns:
            Tuple of (query, params)
        """
        # Role will be 'input_guardrail' or 'output_guardrail'
        query = """
        SELECT 
            -- Agent data (via department_agents junction)
            a.id::text as agent_id,
            a.name as agent_name,
            a.system_prompt,
            a.temperature,
            a.reasoning,
            
            -- Model data
            m.id::text as model_id,
            m.name as model_name,
            m.custom_model,
            
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            pr.base_url,
            pr.api_key,
            
            -- Chat data
            sc.id::text as chat_id,
            sc.title as chat_title,
            sc.trace_id as trace_id,
            
            -- Attempt data
            sa.id::text as attempt_id,
            sa.simulation_id::text as simulation_id,
            
            -- Profile data (via attempt_profiles junction)
            ap.profile_id::text as profile_id
        
        FROM simulation_chats sc
        INNER JOIN simulation_attempts sa ON sa.id = sc.attempt_id
        INNER JOIN department_agents da ON da.department_id = $2 
            AND da.role = $3 || '_guardrail'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
        WHERE sc.id = $1
        """
        
        params: list[Any] = [chat_id, department_id, guardrail_type]
        return query, params

    def get_title_run_context(
        self, chat_id: str, department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run title agent with optimized JOIN.
        
        Fetches agent (via department_agents), model, provider, and chat
        in a single query to minimize database round trips.

        Args:
            chat_id: Assistant chat UUID as string
            department_id: Department UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            -- Agent data (via department_agents junction for 'title' role)
            a.id::text as agent_id,
            a.name as agent_name,
            a.system_prompt,
            a.temperature,
            a.reasoning,
            
            -- Model data
            m.id::text as model_id,
            m.name as model_name,
            m.custom_model,
            
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            pr.base_url,
            pr.api_key,
            
            -- Chat data
            ac.id::text as chat_id,
            ac.profile_id::text as profile_id,
            ac.title as chat_title,
            ac.trace_id as trace_id
        
        FROM department_agents da
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        INNER JOIN assistant_chats ac ON ac.id = $1
        WHERE da.department_id = $2 AND da.role = 'title'
        """
        
        params: list[Any] = [chat_id, department_id]
        return query, params
