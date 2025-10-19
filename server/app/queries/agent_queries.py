"""Agent query builders with dynamic SQL."""

from typing import Any


class AgentQueries:
    """Query builders for agent operations."""

    def get_agents_list(self, profile_id: str) -> tuple[str, list[Any]]:
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

        params: list[Any] = [profile_id]

        return query, params

    def get_agent_detail(self, agent_id: str) -> tuple[str, list[Any]]:
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

        params: list[Any] = [agent_id]

        return query, params

    def get_debug_info_for_agent(self, agent_id: str) -> tuple[str, list[Any]]:
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

        params: list[Any] = [agent_id]

        return query, params

    def get_valid_models(self) -> tuple[str, list[Any]]:
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

        params: list[Any] = []

        return query, params

    def get_model_mapping(self, model_ids: list[str]) -> tuple[str, list[Any]]:
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

        params: list[Any] = [model_ids]

        return query, params

    def create_agent(
        self,
        name: str,
        description: str,
        system_prompt: str,
        temperature: float,
        model_id: str,
        reasoning: str | None,
    ) -> tuple[str, list[Any]]:
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

        params: list[Any] = [
            name,
            description,
            system_prompt,
            temperature,
            model_id,
            reasoning,
        ]

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
    ) -> tuple[str, list[Any]]:
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

        params: list[Any] = [
            agent_id,
            name,
            description,
            system_prompt,
            temperature,
            model_id,
            reasoning,
        ]

        return query, params

    def duplicate_agent(self, agent_id: str) -> tuple[str, list[Any]]:
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

        params: list[Any] = [agent_id]

        return query, params

    def delete_agent(self, agent_id: str) -> tuple[str, list[Any]]:
        """
        Delete an agent.

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM agents WHERE id = $1
        """

        params: list[Any] = [agent_id]

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

    def batch_update_document_types(self) -> tuple[str, list[Any]]:
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

    def get_scenario_run_context(
        self,
        department_id: str,
        persona_id: str | None,
        document_ids: list[str] | None,
        parameter_item_ids: list[str] | None,
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run scenario agent with optimized JOIN.

        Fetches agent (via department_agents), model, provider, persona,
        documents, parameter items, and default guest profile in a single query.

        Args:
            department_id: Department UUID as string
            persona_id: Optional persona UUID as string
            document_ids: Optional list of document UUIDs as strings
            parameter_item_ids: Optional list of parameter item UUIDs as strings

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH default_guest AS (
            SELECT id::text as guest_profile_id
            FROM profiles 
            WHERE role = 'guest' AND default_profile = true 
            LIMIT 1
        )
        SELECT 
            -- Agent data (via department_agents junction for 'scenario' role)
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
            
            -- Persona data (nullable)
            p.id::text as persona_id,
            p.name as persona_name,
            p.description as persona_description,
            
            -- Documents data (aggregated as JSON array)
            COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'id', d.id::text,
                        'name', d.name,
                        'file_path', d.file_path,
                        'mime_type', d.mime_type
                    )
                    ORDER BY array_position($3::uuid[], d.id)
                )
                FROM documents d
                WHERE d.id = ANY($3::uuid[])
                ),
                '[]'::json
            ) as documents,
            
            -- Parameter items data (aggregated as JSON array with parameter info)
            COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'item_name', pi.name,
                        'item_description', pi.description,
                        'param_name', pa.name,
                        'param_description', pa.description
                    )
                    ORDER BY array_position($4::uuid[], pi.id)
                )
                FROM parameter_items pi
                JOIN parameters pa ON pi.parameter_id = pa.id
                WHERE pi.id = ANY($4::uuid[])
                ),
                '[]'::json
            ) as parameter_items,
            
            -- Default guest profile
            dg.guest_profile_id
        
        FROM department_agents da
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN personas p ON p.id = $2
        CROSS JOIN default_guest dg
        WHERE da.department_id = $1 AND da.role = 'scenario'
        """

        # Convert None to empty arrays for proper SQL handling
        doc_ids = document_ids if document_ids else []
        param_ids = parameter_item_ids if parameter_item_ids else []

        params: list[Any] = [department_id, persona_id, doc_ids, param_ids]
        return query, params

    def get_hint_run_context(
        self, message_id: str, chat_id: str, department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run hint agent with optimized JOIN.

        Fetches message, chat, attempt, scenario, agent (via department_agents),
        model, provider, documents, and profile in a single query.
        Messages are fetched separately using get_simulation_messages().

        Args:
            message_id: Message UUID as string
            chat_id: Chat UUID as string
            department_id: Department UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH target_message AS (
            SELECT id, chat_id, role, content, created_at
            FROM simulation_messages
            WHERE id = $1 AND chat_id = $2
        ),
        chat_info AS (
            SELECT sc.id, sc.attempt_id, sc.scenario_id, sc.trace_id, sc.title
            FROM simulation_chats sc
            JOIN target_message tm ON tm.chat_id = sc.id
        ),
        attempt_info AS (
            SELECT sa.id, sa.simulation_id
            FROM simulation_attempts sa
            JOIN chat_info ci ON ci.attempt_id = sa.id
        ),
        scenario_info AS (
            SELECT s.id, s.problem_statement
            FROM scenarios s
            JOIN chat_info ci ON ci.scenario_id = s.id
        ),
        profile_info AS (
            SELECT ap.profile_id
            FROM attempt_profiles ap
            JOIN attempt_info ai ON ai.id = ap.attempt_id
            WHERE ap.active = true
            LIMIT 1
        )
        SELECT 
            -- Message data
            tm.id::text as message_id,
            tm.created_at as message_created_at,
            
            -- Chat data
            ci.id::text as chat_id,
            ci.attempt_id::text,
            ci.scenario_id::text,
            ci.trace_id,
            ci.title as chat_title,
            
            -- Attempt data
            ai.id::text as attempt_id,
            ai.simulation_id::text,
            
            -- Scenario data
            si.problem_statement,
            
            -- Agent data (via department_agents junction for 'hint' role)
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
            
            -- Profile data
            pi.profile_id::text,
            
            -- Documents data (aggregated as JSON array with full document info)
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', d.id::text,
                            'name', d.name,
                            'file_path', d.file_path,
                            'mime_type', d.mime_type
                        )
                        ORDER BY d.id
                    )
                    FROM scenario_documents sd
                    JOIN documents d ON d.id = sd.document_id
                    WHERE sd.scenario_id = si.id AND sd.active = true
                ),
                '[]'::json
            ) as documents
        
        FROM target_message tm
        CROSS JOIN chat_info ci
        CROSS JOIN attempt_info ai
        CROSS JOIN scenario_info si
        LEFT JOIN profile_info pi ON true
        INNER JOIN department_agents da ON da.department_id = $3 AND da.role = 'hint'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        """

        params: list[Any] = [message_id, chat_id, department_id]
        return query, params

    def get_simulation_run_context(self, chat_id: str) -> tuple[str, list[Any]]:
        """
        Get all data needed to run simulation agent with optimized JOIN.

        Fetches chat, attempt, scenario, persona (via junction), model, provider,
        simulation settings, profile (via junction), and documents (via junction)
        in a single query to minimize database round trips.

        Args:
            chat_id: Simulation chat UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            -- Chat data
            sc.id::text as chat_id,
            sc.title as chat_title,
            sc.trace_id,
            
            -- Attempt data
            sa.id::text as attempt_id,
            sa.simulation_id::text,
            
            -- Scenario data
            s.id::text as scenario_id,
            s.department_id::text,
            s.problem_statement,
            
            -- Persona data (via scenario_personas junction)
            p.id::text as persona_id,
            p.name as persona_name,
            p.system_prompt,
            p.temperature,
            p.reasoning,
            
            -- Model data
            m.id::text as model_id,
            m.name as model_name,
            m.custom_model,
            
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            pr.base_url,
            pr.api_key,
            
            -- Simulation settings
            sim.image_input_active,
            sim.output_guardrail_active,
            
            -- Profile data (via attempt_profiles junction)
            ap.profile_id::text as profile_id,
            
            -- Documents data (aggregated as JSON array with full document info)
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', d.id::text,
                        'name', d.name,
                        'file_path', d.file_path,
                        'mime_type', d.mime_type
                    )
                    ORDER BY d.id
                ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
                '[]'::json
            ) as documents
        
        FROM simulation_chats sc
        INNER JOIN simulation_attempts sa ON sa.id = sc.attempt_id
        INNER JOIN scenarios s ON s.id = sc.scenario_id
        INNER JOIN simulations sim ON sim.id = sa.simulation_id
        INNER JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
        INNER JOIN personas p ON p.id = sp.persona_id
        INNER JOIN models m ON m.id = p.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
        LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
        LEFT JOIN documents d ON d.id = sd.document_id
        WHERE sc.id = $1
        GROUP BY sc.id, sc.title, sc.trace_id,
                 sa.id, sa.simulation_id,
                 s.id, s.department_id, s.problem_statement,
                 p.id, p.name, p.system_prompt, p.temperature, p.reasoning,
                 m.id, m.name, m.custom_model,
                 pr.id, pr.name, pr.base_url, pr.api_key,
                 sim.image_input_active, sim.output_guardrail_active,
                 ap.profile_id
        """

        params: list[Any] = [chat_id]
        return query, params

    def get_grading_run_context(
        self, simulation_chat_id: str, department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run grading agent with optimized JOIN.

        Fetches chat, scenario, attempt, simulation, rubric, standard groups,
        standards, agent (via department_agents), model, provider, and profile
        in a single query to minimize database round trips.

        Args:
            simulation_chat_id: Simulation chat UUID as string
            department_id: Department UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH chat_info AS (
            SELECT 
                sc.id,
                sc.scenario_id,
                sc.attempt_id,
                sc.title,
                sc.trace_id,
                sc.created_at,
                sc.completed_at
            FROM simulation_chats sc
            WHERE sc.id = $1
        ),
        attempt_info AS (
            SELECT 
                sa.id,
                sa.simulation_id,
                (SELECT COUNT(*) FROM simulation_chats WHERE attempt_id = sa.id) as total_chats
            FROM simulation_attempts sa
            WHERE sa.id = (SELECT attempt_id FROM chat_info)
        ),
        simulation_info AS (
            SELECT 
                s.id,
                s.rubric_id,
                s.department_id,
                stl.time_limit_seconds as time_limit
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE s.id = (SELECT simulation_id FROM attempt_info)
        )
        SELECT 
            -- Chat data
            ci.id::text as chat_id,
            ci.scenario_id::text,
            ci.attempt_id::text,
            ci.title,
            ci.trace_id,
            ci.created_at,
            ci.completed_at,
            
            -- Scenario data
            sc.problem_statement,
            
            -- Attempt data
            ai.id::text as attempt_id,
            ai.simulation_id::text,
            ai.total_chats,
            
            -- Simulation data
            si.id::text as simulation_id,
            si.rubric_id::text,
            si.department_id::text,
            si.time_limit,
            
            -- Rubric data
            r.id::text as rubric_id,
            r.name as rubric_name,
            r.description as rubric_description,
            r.points as rubric_points,
            r.pass_points as rubric_pass_points,
            
            -- Standard groups (aggregated as JSON array)
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', sg.id::text,
                        'name', sg.name,
                        'short_name', sg.short_name,
                        'description', sg.description,
                        'points', sg.points,
                        'pass_points', sg.pass_points,
                        'rubric_id', sg.rubric_id::text
                    )
                    ORDER BY jsonb_build_object(
                        'id', sg.id::text,
                        'name', sg.name,
                        'short_name', sg.short_name,
                        'description', sg.description,
                        'points', sg.points,
                        'pass_points', sg.pass_points,
                        'rubric_id', sg.rubric_id::text
                    )
                ) FILTER (WHERE sg.id IS NOT NULL),
                '[]'::json
            ) as standard_groups,
            
            -- Standards (aggregated as JSON array)
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', std.id::text,
                        'name', std.name,
                        'description', std.description,
                        'points', std.points,
                        'standard_group_id', std.standard_group_id::text
                    )
                    ORDER BY jsonb_build_object(
                        'id', std.id::text,
                        'name', std.name,
                        'description', std.description,
                        'points', std.points,
                        'standard_group_id', std.standard_group_id::text
                    )
                ) FILTER (WHERE std.id IS NOT NULL),
                '[]'::json
            ) as standards,
            
            -- Agent data (via department_agents junction for 'grade' role)
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
            
            -- Profile data (via attempt_profiles junction)
            ap.profile_id::text
        
        FROM chat_info ci
        CROSS JOIN attempt_info ai
        CROSS JOIN simulation_info si
        INNER JOIN scenarios sc ON sc.id = ci.scenario_id
        INNER JOIN rubrics r ON r.id = si.rubric_id
        LEFT JOIN standard_groups sg ON sg.rubric_id = r.id
        LEFT JOIN standards std ON std.standard_group_id = sg.id
        INNER JOIN department_agents da ON da.department_id = $2 AND da.role = 'grade'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN attempt_profiles ap ON ap.attempt_id = ai.id AND ap.active = true
        GROUP BY ci.id, ci.scenario_id, ci.attempt_id, ci.title, ci.trace_id, ci.created_at, ci.completed_at,
                 sc.problem_statement,
                 ai.id, ai.simulation_id, ai.total_chats,
                 si.id, si.rubric_id, si.department_id, si.time_limit,
                 r.id, r.name, r.description, r.points, r.pass_points,
                 a.id, a.name, a.system_prompt, a.temperature, a.reasoning,
                 m.id, m.name, m.custom_model,
                 pr.id, pr.name, pr.base_url, pr.api_key,
                 ap.profile_id
        """

        params: list[Any] = [simulation_chat_id, department_id]
        return query, params

    def get_simulation_messages(self, simulation_chat_id: str) -> tuple[str, list[Any]]:
        """
        Get all messages for a simulation chat.

        Args:
            simulation_chat_id: Simulation chat UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text,
            chat_id::text,
            role,
            content,
            created_at,
            completed
        FROM simulation_messages
        WHERE chat_id = $1
        ORDER BY created_at
        """

        params: list[Any] = [simulation_chat_id]
        return query, params

    def create_simulation_hint(
        self, hint_text: str, message_id: str
    ) -> tuple[str, list[Any]]:
        """
        Create a simulation hint for a message.

        Args:
            hint_text: The hint content
            message_id: Message UUID as string

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO simulation_hints (simulation_message_id, idx, hint)
        VALUES (
            $2, 
            COALESCE((SELECT MAX(idx) + 1 FROM simulation_hints WHERE simulation_message_id = $2), 0),
            $1
        )
        RETURNING simulation_message_id::text, idx
        """

        params: list[Any] = [hint_text, message_id]
        return query, params

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
