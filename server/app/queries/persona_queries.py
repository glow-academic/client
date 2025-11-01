"""Persona queries - SQL query builders."""

from typing import Any


class PersonaQueries:
    """Query builders for persona operations."""

    def list_personas(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for personas list with permissions and embedded scenario mapping."""
        query = """
        WITH user_departments AS (
            SELECT department_id
            FROM profile_departments
            WHERE profile_id = $1 AND active = true
        ),
        persona_active_scenario_links AS (
            SELECT 
                sp.persona_id,
                COUNT(*) as active_scenario_count
            FROM scenario_personas sp
            WHERE sp.active = true
            GROUP BY sp.persona_id
        ),
        persona_all_scenario_links AS (
            SELECT 
                sp.persona_id,
                COUNT(*) as total_scenario_links
            FROM scenario_personas sp
            GROUP BY sp.persona_id
        ),
        persona_scenarios AS (
            SELECT 
                sp.persona_id,
                ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids,
                COUNT(DISTINCT st.parent_id) as num_scenarios
            FROM scenario_personas sp
            -- Join with scenario_tree to get root scenario for each linked scenario
            JOIN scenario_tree st ON st.child_id = sp.scenario_id
            WHERE sp.active = true AND st.parent_id = st.child_id
            GROUP BY sp.persona_id
        ),
        persona_departments_data AS (
            SELECT 
                pd.persona_id,
                ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
            FROM persona_departments pd
            WHERE pd.active = true
            GROUP BY pd.persona_id
        ),
        persona_data AS (
            SELECT 
                p.id as persona_id,
                p.name as persona_name,
                p.description,
                p.color,
                p.icon,
                p.model_id,
                p.reasoning,
                p.temperature,
                p.active,
                p.updated_at,
                COALESCE(pdd.department_ids, NULL) as department_ids,
                COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ps.num_scenarios, 0) as num_scenarios,
                m.name as model_name,
                COALESCE(m.description, '') as model_description,
                COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
                COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
                CASE WHEN COUNT(pd.persona_id) > 0 THEN true ELSE false END as has_dept_links
            FROM personas p
            LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
            LEFT JOIN persona_active_scenario_links pasl ON pasl.persona_id = p.id
            LEFT JOIN persona_all_scenario_links pasl_all ON pasl_all.persona_id = p.id
            LEFT JOIN models m ON m.id = p.model_id
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true AND pd.department_id IN (SELECT department_id FROM user_departments)
            GROUP BY p.id, p.name, p.description, p.color, p.icon, p.model_id, p.reasoning, p.temperature, p.active, p.updated_at, 
                     pdd.department_ids, ps.scenario_ids, ps.num_scenarios, m.name, m.description, pasl.active_scenario_count, pasl_all.total_scenario_links
            HAVING COUNT(pd.persona_id) > 0 OR NOT EXISTS (
                SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true
            )
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        all_scenario_ids AS (
            SELECT DISTINCT unnest(scenario_ids) as scenario_id
            FROM persona_data
        ),
        scenario_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.name,
                        'description', COALESCE(sps.problem_statement, ''),
                        'active', s.active,
                        'persona_id', NULL,
                        'persona_mapping', '{}'::jsonb,
                        'document_mapping', '{}'::jsonb,
                        'parameter_item_mapping', '{}'::jsonb,
                        'parameter_item_ids', ARRAY[]::text[],
                        'document_ids', ARRAY[]::text[]
                    )
                ) FILTER (WHERE s.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_scenario_ids asi
            LEFT JOIN scenarios s ON s.id = asi.scenario_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            -- Since persona_scenarios already resolved to root scenarios,
            -- all IDs here should be roots (parent_id = child_id)
            LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ) FILTER (WHERE d.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            WHERE d.id IN (SELECT department_id FROM user_departments)
        )
        SELECT 
            pd.persona_id,
            pd.persona_name,
            pd.description,
            pd.color,
            pd.icon,
            pd.model_id,
            pd.reasoning,
            pd.temperature,
            pd.active,
            pd.scenario_ids,
            pd.num_scenarios,
            pd.model_name,
            pd.model_description,
            CASE 
                WHEN pd.active_scenario_count > 0 THEN false
                WHEN NOT pd.has_dept_links AND up.role != 'superadmin' THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            true as can_duplicate,
            CASE 
                WHEN pd.total_scenario_links > 0 THEN false
                WHEN NOT pd.has_dept_links AND up.role != 'superadmin' THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            sm.mapping as scenario_mapping,
            dm.mapping as department_mapping
        FROM persona_data pd
        CROSS JOIN user_profile up
        CROSS JOIN scenario_mapping_data sm
        CROSS JOIN department_mapping_data dm
        ORDER BY pd.updated_at DESC NULLS LAST
        """

        return (query, [profile_id])

    def get_persona_by_id(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to get persona by ID."""
        query = """
        SELECT 
            p.name,
            p.description,
            p.active,
            p.color,
            p.icon,
            p.model_id,
            p.reasoning,
            p.temperature,
            COALESCE(pr.system_prompt, '') as system_prompt
        FROM personas p
        LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
        LEFT JOIN prompts pr ON pr.id = pp.prompt_id
        WHERE p.id = $1
        """
        return (query, [persona_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        ORDER BY d.title
        """
        return (query, [profile_id])

    def get_default_persona(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query for default persona."""
        query = """
        WITH user_departments AS (
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        )
        SELECT 
            p.id,
            p.name,
            p.description,
            p.active,
            p.color,
            p.icon,
            p.model_id,
            p.reasoning,
            p.temperature,
            COALESCE(pr.system_prompt, '') as system_prompt
        FROM personas p
        LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
        LEFT JOIN prompts pr ON pr.id = pp.prompt_id
        LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
        WHERE p.active = true
        GROUP BY p.id, p.name, p.description, p.active, p.color, p.icon, p.model_id, p.reasoning, p.temperature, pr.system_prompt
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY((SELECT dept_ids FROM user_departments))) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        ORDER BY p.created_at DESC
        LIMIT 1
        """
        return (query, [profile_id])

    def get_persona_for_duplicate(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to get persona data for duplication."""
        query = """
        SELECT 
            p.name,
            p.description,
            COALESCE(pr.system_prompt, '') as system_prompt,
            p.temperature,
            p.reasoning,
            p.model_id,
            p.color,
            p.icon
        FROM personas p
        LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
        LEFT JOIN prompts pr ON pr.id = pp.prompt_id
        WHERE p.id = $1
        """
        return (query, [persona_id])

    def insert_duplicate_persona(self) -> str:
        """Build query to insert duplicate persona.
        Params order: name, description, temperature, reasoning,
        model_id, color, icon
        """
        return """
        INSERT INTO personas (
            name,
            description,
            temperature,
            reasoning,
            model_id,
            color,
            icon,
            active
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            false
        )
        RETURNING id
        """

    def check_persona_usage(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to check persona usage."""
        query = """
        SELECT COUNT(*)::integer as usage_count
        FROM scenario_personas
        WHERE persona_id = $1 AND active = true
        """
        return (query, [persona_id])

    def get_persona_name(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to get persona name."""
        query = "SELECT name FROM personas WHERE id = $1"
        return (query, [persona_id])

    def delete_persona(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to delete persona."""
        query = "DELETE FROM personas WHERE id = $1"
        return (query, [persona_id])

    def create_persona(self) -> str:
        """Build query to create persona.
        Params order: name, description, active, color, icon, model_id, reasoning, temperature
        """
        return """
        INSERT INTO personas (
            name,
            description,
            active,
            color,
            icon,
            model_id,
            reasoning,
            temperature
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            COALESCE($7::reasoning_effort, 'none'::reasoning_effort),
            $8
        )
        RETURNING id
        """

    def update_persona(self) -> str:
        """Build query to update persona.
        Params order: persona_id, name, description, active, color, icon, model_id, reasoning, temperature
        """
        return """
        UPDATE personas SET
            name = $2,
            description = $3,
            active = $4,
            color = $5,
            icon = $6,
            model_id = $7,
            reasoning = COALESCE($8::reasoning_effort, 'none'::reasoning_effort),
            temperature = $9,
            updated_at = NOW()
        WHERE id = $1
        """

    def delete_persona_departments(
        self, persona_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to deactivate all persona departments."""
        query = """
        UPDATE persona_departments 
        SET active = false, updated_at = NOW()
        WHERE persona_id = $1 AND active = true
        """
        return (query, [persona_id])

    def create_or_update_persona_department_prompt(
        self, persona_id: str, department_id: str, prompt_id: str
    ) -> tuple[str, list[Any]]:
        """
        Create or update persona-department-prompt link in ternary table.
        Deactivates any existing active records for (persona_id, department_id, prompt_id) first.

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH deactivate_existing AS (
            UPDATE persona_department_prompts
            SET active = false, updated_at = NOW()
            WHERE persona_id = $1::uuid 
            AND department_id = $2::uuid 
            AND active = true
        )
        INSERT INTO persona_department_prompts (persona_id, department_id, prompt_id, active, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW(), NOW())
        ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
        """
        return (query, [persona_id, department_id, prompt_id])

    def create_persona_departments(
        self, persona_id: str, department_ids: list[str], prompt_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to create persona-department binary junction table records (department membership only).
        The prompt_id parameter is kept for backward compatibility but is no longer used here.
        Department-specific prompts are handled separately via persona_department_prompts.
        
        Returns:
            Tuple of (query, params)
        """
        if not department_ids:
            # Return empty query if no departments
            return "SELECT 1 WHERE false", []

        # Use UNNEST for efficient batch insert into binary table (no prompt_id)
        query = """
        INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
        SELECT $1::uuid, dept_id::uuid, true, NOW(), NOW()
        FROM UNNEST($2::text[]) as dept_id
        ON CONFLICT (persona_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
        """

        params: list[Any] = [persona_id, department_ids]
        return query, params

    def create_prompt(self, system_prompt: str) -> tuple[str, list[Any]]:
        """
        Create a new prompt.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO prompts (system_prompt, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        RETURNING id::text as prompt_id
        """
        params: list[Any] = [system_prompt]
        return query, params

    def create_persona_prompt(
        self, persona_id: str, prompt_id: str
    ) -> tuple[str, list[Any]]:
        """
        Link a persona to a prompt via persona_prompts junction.
        Deactivates any existing active prompt first.

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH deactivate_all AS (
            UPDATE persona_prompts
            SET active = false, updated_at = NOW()
            WHERE persona_id = $1::uuid AND active = true
            RETURNING 1
        ),
        ensure_execution AS (
            SELECT 1 FROM deactivate_all
            UNION ALL
            SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM persona_prompts WHERE persona_id = $1::uuid AND active = true)
        )
        INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
        SELECT $1::uuid, $2::uuid, true, NOW(), NOW()
        FROM ensure_execution
        ON CONFLICT (persona_id, prompt_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
        """
        params: list[Any] = [persona_id, prompt_id]
        return query, params

    def create_prompt_departments(
        self, prompt_id: str, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """
        Legacy function - prompt_departments table was removed.
        This function is now a no-op as department-prompt links are handled
        via persona_department_prompts ternary table.

        Returns:
            Tuple of (query, params) - returns a no-op query
        """
        # Return empty query that does nothing
        return "SELECT 1 WHERE false", []

    def get_departments_mapping(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, title as name, description 
        FROM departments 
        WHERE id = ANY($1)
        ORDER BY title
        """
        return (query, [dept_ids])

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def search_personas_fuzzy(
        self, where_clause: str, limit: int
    ) -> tuple[str, list[Any]]:
        """
        Build fuzzy search query for personas by name.
        Uses dynamic WHERE clause built by search utilities.

        Params: Built dynamically by search utilities, plus limit at end
        """
        query = f"""
            SELECT 
                p.id,
                p.name,
                p.description
            FROM personas p
            WHERE {where_clause}
            LIMIT ${{param_count}}
        """
        return (query, [limit])

    # ===== Analytics Queries for MCP Tools =====

    def get_persona_with_scenarios(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to get persona details and its scenarios."""
        query = """
        SELECT 
            p.id as persona_id,
            p.name as persona_name,
            p.description as persona_description,
            COALESCE(
                json_agg(
                    json_build_object('id', s.id, 'name', s.name)
                ) FILTER (WHERE s.id IS NOT NULL),
                '[]'::json
            ) as scenarios
        FROM personas p
        LEFT JOIN scenario_personas sp ON p.id = sp.persona_id AND sp.active = true
        LEFT JOIN scenarios s ON s.id = sp.scenario_id
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.description
        """
        return (query, [persona_id])

    def get_persona_response_time_data(
        self, scenario_ids: list[str], cutoff_date: Any
    ) -> tuple[str, list[Any]]:
        """Build query to get response time analysis data for persona scenarios."""
        query = """
        WITH message_pairs AS (
            SELECT 
                sc.id as chat_id,
                s.name as scenario_name,
                sm1.created_at as query_time,
                sm2.created_at as response_time,
                sm2.created_at - sm1.created_at as response_interval,
                LENGTH(sm1.content) as query_length,
                LENGTH(sm2.content) as response_length,
                ROW_NUMBER() OVER (
                    PARTITION BY sc.id 
                    ORDER BY sm1.created_at
                ) as pair_num
            FROM simulation_chats sc
            JOIN scenarios s ON s.id = sc.scenario_id
            JOIN simulation_messages sm1 ON sm1.chat_id = sc.id
            JOIN simulation_messages sm2 ON sm2.chat_id = sc.id
            WHERE sc.scenario_id = ANY($1)
              AND sc.created_at >= $2
              AND sm1.type = 'query'
              AND sm2.type = 'response'
              AND sm2.created_at > sm1.created_at
              AND NOT EXISTS (
                  SELECT 1 FROM simulation_messages sm_between
                  WHERE sm_between.chat_id = sc.id
                    AND sm_between.created_at > sm1.created_at
                    AND sm_between.created_at < sm2.created_at
              )
        )
        SELECT 
            chat_id,
            scenario_name,
            query_time,
            response_time,
            EXTRACT(EPOCH FROM response_interval) as response_time_seconds,
            query_length,
            response_length
        FROM message_pairs
        ORDER BY response_time_seconds DESC
        """
        return (query, [scenario_ids, cutoff_date])

    def get_persona_detail_complete(
        self, persona_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get persona detail with all mappings in ONE query.

        Consolidates 6 queries into 1 using CTEs and JSONB aggregation.

        Args:
            persona_id: UUID of the persona
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH         persona_departments_data AS (
            SELECT 
                pd.persona_id,
                ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
            FROM persona_departments pd
            WHERE pd.persona_id = $1 AND pd.active = true
            GROUP BY pd.persona_id
        ),
        persona_department_prompt_links AS (
            SELECT 
                COALESCE(
                    (SELECT jsonb_object_agg(
                        pdp.department_id::text,
                        pdp.prompt_id::text
                    )
                    FROM persona_department_prompts pdp
                    WHERE pdp.persona_id = $1 AND pdp.active = true),
                    '{}'::jsonb
                ) as department_prompt_links
        ),
        persona_active_prompt AS (
            SELECT 
                pp.persona_id,
                pp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_prompts pp
            JOIN prompts pr ON pr.id = pp.prompt_id
            WHERE pp.persona_id = $1 AND pp.active = true
            LIMIT 1
        ),
        persona_all_prompts AS (
            SELECT 
                pp.persona_id,
                pp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_prompts pp
            JOIN prompts pr ON pr.id = pp.prompt_id
            WHERE pp.persona_id = $1
        ),
        prompt_departments_data AS (
            SELECT 
                pdp.prompt_id::text as prompt_id,
                ARRAY_AGG(pdp.department_id::text ORDER BY pdp.created_at) as department_ids
            FROM persona_department_prompts pdp
            WHERE pdp.persona_id = $1 AND pdp.active = true
            GROUP BY pdp.prompt_id
        ),
        prompt_mapping_data AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        pp.prompt_id,
                        jsonb_build_object(
                            'system_prompt', pp.system_prompt,
                            'created_at', pp.prompt_created_at::text,
                            'updated_at', pp.prompt_updated_at::text,
                            'department_ids', COALESCE(pdd.department_ids, NULL)
                        )
                    ),
                    '{}'::jsonb
                ) as prompt_mapping
            FROM persona_all_prompts pp
            LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = pp.prompt_id
        ),
        persona_data AS (
            SELECT 
                name,
                description,
                active,
                color,
                icon,
                model_id,
                reasoning,
                temperature,
                COALESCE(pap.system_prompt, '') as system_prompt,
                COALESCE(pap.prompt_id, NULL)::text as prompt_id,
                COALESCE(pdd.department_ids, NULL) as department_ids
            FROM personas p
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_active_prompt pap ON pap.persona_id = p.id
            WHERE p.id = $1
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        valid_models AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        m.id::text,
                        jsonb_build_object(
                            'name', m.name,
                            'description', COALESCE(m.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as model_mapping,
                array_agg(m.id::text ORDER BY m.name) as model_ids
            FROM models m 
            WHERE m.active = true
        ),
        usage_data AS (
            SELECT COUNT(*) as usage_count
            FROM scenario_personas sp
            WHERE sp.persona_id = $1 AND sp.active = true
        ),
        profile_data AS (
            SELECT role as user_role 
            FROM profiles 
            WHERE id = $2
        )
        SELECT 
            p.*,
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            vm.model_mapping,
            vm.model_ids as valid_model_ids,
            u.usage_count,
            pr.user_role,
            COALESCE(pmd.prompt_mapping, '{}'::jsonb) as prompt_mapping,
            COALESCE(pdpl.department_prompt_links, '{}'::jsonb) as department_prompt_links
        FROM persona_data p
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_models vm
        CROSS JOIN usage_data u
        CROSS JOIN profile_data pr
        CROSS JOIN prompt_mapping_data pmd
        CROSS JOIN persona_department_prompt_links pdpl
        """
        return (query, [persona_id, profile_id])

    def get_persona_detail_default_complete(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get default persona detail in ONE query.

        Combines default persona lookup with full detail fetch using CTEs.
        Consolidates 2 queries into 1.

        Args:
            profile_id: UUID of the profile for finding default persona

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        default_persona AS (
            SELECT p.id
            FROM personas p
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE p.active = true
            GROUP BY p.id
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            ORDER BY p.created_at DESC
            LIMIT 1
        ),
        persona_departments_data AS (
            SELECT 
                pd.persona_id,
                ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
            FROM persona_departments pd
            JOIN default_persona dp ON pd.persona_id = dp.id
            WHERE pd.active = true
            GROUP BY pd.persona_id
        ),
        persona_active_prompt AS (
            SELECT 
                pp.persona_id,
                pp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_prompts pp
            JOIN prompts pr ON pr.id = pp.prompt_id
            JOIN default_persona dp ON pp.persona_id = dp.id
            WHERE pp.active = true
            LIMIT 1
        ),
        persona_data AS (
            SELECT 
                p.name,
                p.description,
                p.active,
                p.color,
                p.icon,
                p.model_id,
                p.reasoning,
                p.temperature,
                COALESCE(pap.system_prompt, '') as system_prompt,
                COALESCE(pap.prompt_id, NULL)::text as prompt_id,
                COALESCE(pdd.department_ids, NULL) as department_ids
            FROM personas p
            JOIN default_persona dp ON p.id = dp.id
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_active_prompt pap ON pap.persona_id = p.id
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        valid_models AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        m.id::text,
                        jsonb_build_object(
                            'name', m.name,
                            'description', COALESCE(m.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as model_mapping,
                array_agg(m.id::text ORDER BY m.name) as model_ids
            FROM models m 
            WHERE m.active = true
        ),
        usage_data AS (
            SELECT COUNT(*) as usage_count
            FROM scenario_personas sp
            JOIN default_persona dp ON sp.persona_id = dp.id
            WHERE sp.active = true
        ),
        profile_data AS (
            SELECT role as user_role 
            FROM profiles 
            WHERE id = $1
        )
        SELECT 
            p.*,
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            vm.model_mapping,
            vm.model_ids as valid_model_ids,
            u.usage_count,
            pr.user_role
        FROM persona_data p
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_models vm
        CROSS JOIN usage_data u
        CROSS JOIN profile_data pr
        """
        return (query, [profile_id])

    def get_persona_overview_complete(self, persona_id: Any) -> tuple[str, list[Any]]:
        """Build optimized query to get persona overview with all related data in ONE query.

        Fetches persona + scenarios using LEFT JOIN and JSON aggregation to avoid N+1 queries.

        Args:
            persona_id: UUID of the persona

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        SELECT 
            p.id, p.name, p.description, COALESCE(pr.system_prompt, '') as system_prompt, p.temperature, 
            p.created_at, p.updated_at,
            -- Scenarios array (json_agg with filtering)
            COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', s.id,
                    'name', s.name,
                    'problem_statement', COALESCE(sps.problem_statement, ''),
                    'default_scenario', s.default_scenario,
                    'created_at', s.created_at
                )) FILTER (WHERE s.id IS NOT NULL),
                '[]'::jsonb
            ) as scenarios
        FROM personas p
        LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
        LEFT JOIN prompts pr ON pr.id = pp.prompt_id
        LEFT JOIN scenario_personas sp ON sp.persona_id = p.id AND sp.active = true
        LEFT JOIN scenarios s ON s.id = sp.scenario_id
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.description, pr.system_prompt, p.temperature, 
                 p.created_at, p.updated_at
        """
        return (query, [persona_id])

    def get_persona_response_times_complete(
        self, persona_id: str, cutoff_date: Any
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get persona response time analysis in ONE query.

        Consolidates:
        - Persona details with scenarios (from get_persona_with_scenarios)
        - Response time data for all scenarios (from get_persona_response_time_data)

        Args:
            persona_id: UUID of the persona
            cutoff_date: Cutoff date for analysis window

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH persona_scenarios AS (
            SELECT 
                s.id,
                s.name
            FROM scenario_personas sp
            JOIN scenarios s ON s.id = sp.scenario_id
            WHERE sp.persona_id = $1 AND sp.active = true
        ),
        scenario_ids_array AS (
            SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) as ids
            FROM persona_scenarios
        ),
        message_pairs AS (
            SELECT 
                sc.id as chat_id,
                s.name as scenario_name,
                sm1.created_at as query_time,
                sm2.created_at as response_time,
                sm2.created_at - sm1.created_at as response_interval,
                LENGTH(sm1.content) as query_length,
                LENGTH(sm2.content) as response_length,
                ROW_NUMBER() OVER (
                    PARTITION BY sc.id 
                    ORDER BY sm1.created_at
                ) as pair_num
            FROM simulation_chats sc
            JOIN scenarios s ON s.id = sc.scenario_id
            JOIN simulation_messages sm1 ON sm1.chat_id = sc.id
            JOIN simulation_messages sm2 ON sm2.chat_id = sc.id
            CROSS JOIN scenario_ids_array sia
            WHERE sc.scenario_id = ANY(sia.ids)
              AND sia.ids != ARRAY[]::uuid[]
              AND sc.created_at >= $2
              AND sm1.type = 'query'
              AND sm2.type = 'response'
              AND sm2.created_at > sm1.created_at
              AND NOT EXISTS (
                  SELECT 1 FROM simulation_messages sm_between
                  WHERE sm_between.chat_id = sc.id
                    AND sm_between.created_at > sm1.created_at
                    AND sm_between.created_at < sm2.created_at
              )
        )
        SELECT 
            p.id::text as persona_id,
            p.name as persona_name,
            p.description as persona_description,
            (
                SELECT COALESCE(json_agg(jsonb_build_object(
                    'id', ps.id::text,
                    'name', ps.name
                )), '[]'::json)
                FROM persona_scenarios ps
            ) as scenarios,
            (
                SELECT COALESCE(json_agg(jsonb_build_object(
                    'chat_id', mp.chat_id::text,
                    'scenario_name', mp.scenario_name,
                    'query_time', mp.query_time,
                    'response_time', mp.response_time,
                    'response_time_seconds', EXTRACT(EPOCH FROM mp.response_interval),
                    'query_length', mp.query_length,
                    'response_length', mp.response_length
                )), '[]'::json)
                FROM message_pairs mp
            ) as response_data
        FROM personas p
        WHERE p.id = $1
        """
        return (query, [persona_id, cutoff_date])
