"""Department query builders with dynamic SQL."""

from typing import Any


class DepartmentQueries:
    """Query builders for department operations."""

    def get_departments_list(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get departments list with computed fields.

        Computes:
        - total_price_spent from model_runs + models pricing
        - staff_count from profile_departments
        - can_edit/can_delete/can_duplicate with permission logic based on:
          * Active cohort links
          * default_department flag
          * User role (admin/superadmin only)

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH department_price_spent AS (
            SELECT 
                mr.department_id,
                SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ) as total_price_spent
            FROM model_runs mr
            JOIN model_run_models mrm ON mrm.model_run_id = mr.id
            JOIN models m ON m.id = mrm.model_id
            WHERE mr.department_id = ANY($1)
            GROUP BY mr.department_id
        ),
        department_staff_count AS (
            SELECT 
                department_id, 
                COUNT(DISTINCT profile_id) as staff_count
            FROM profile_departments
            WHERE department_id = ANY($1)
            GROUP BY department_id
        ),
        department_all_cohort_links AS (
            SELECT 
                department_id,
                COUNT(*) as total_cohort_links
            FROM cohorts
            WHERE department_id = ANY($1)
            GROUP BY department_id
        ),
        department_profiles_would_orphan AS (
            SELECT 
                pd.department_id,
                COUNT(*) as profiles_with_only_this_dept
            FROM profile_departments pd
            WHERE pd.department_id = ANY($1)
            AND NOT EXISTS (
                SELECT 1 FROM profile_departments pd2 
                WHERE pd2.profile_id = pd.profile_id 
                AND pd2.department_id != pd.department_id
            )
            GROUP BY pd.department_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
            d.id::text as department_id,
            d.title,
            d.description,
            d.active,
            d.default_department,
            d.updated_at,
            COALESCE(dps.total_price_spent, 0) as total_price_spent,
            COALESCE(dsc.staff_count, 0) as staff_count,
            CASE 
                WHEN d.default_department = true AND up.role != 'superadmin' THEN false
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN d.default_department = true THEN false
                WHEN COALESCE(dacl_all.total_cohort_links, 0) > 0 THEN false
                WHEN COALESCE(dpwo.profiles_with_only_this_dept, 0) > 0 THEN false
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_duplicate
        FROM departments d
        LEFT JOIN department_price_spent dps ON dps.department_id = d.id
        LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
        LEFT JOIN department_all_cohort_links dacl_all ON dacl_all.department_id = d.id
        LEFT JOIN department_profiles_would_orphan dpwo ON dpwo.department_id = d.id
        CROSS JOIN user_profile up
        WHERE d.id = ANY($1)
        ORDER BY d.title
        """

        return query, [department_ids, profile_id]

    def get_department_basic(self, department_id: str) -> tuple[str, list[Any]]:
        """
        Get basic department information.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as department_id,
            title,
            description,
            active
        FROM departments
        WHERE id = $1
        """

        return query, [department_id]

    def get_department_detail_with_stats(
        self, department_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get department detail with permissions, usage, and stats.

        Computes:
        - total_price_spent from model_runs
        - staff_count from profile_departments
        - in_use from various entity counts
        - can_edit/can_duplicate/can_delete from user role (superadmin only)

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH department_price_spent AS (
            SELECT 
                mr.department_id,
                SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ) as total_price_spent
            FROM model_runs mr
            JOIN model_run_models mrm ON mrm.model_run_id = mr.id
            JOIN models m ON m.id = mrm.model_id
            WHERE mr.department_id = $1
            GROUP BY mr.department_id
        ),
        department_staff_count AS (
            SELECT 
                department_id, 
                COUNT(DISTINCT profile_id) as staff_count
            FROM profile_departments
            WHERE department_id = $1
            GROUP BY department_id
        ),
        department_usage AS (
            SELECT
                (SELECT COUNT(*) FROM profile_departments WHERE department_id = $1) +
                (SELECT COUNT(*) FROM simulations WHERE department_id = $1) +
                (SELECT COUNT(*) FROM scenarios WHERE department_id = $1) +
                (SELECT COUNT(*) FROM personas WHERE department_id = $1) +
                (SELECT COUNT(*) FROM documents WHERE department_id = $1) +
                (SELECT COUNT(*) FROM cohorts WHERE department_id = $1) as total_usage
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
            d.id::text as department_id,
            d.title,
            d.description,
            d.active,
            COALESCE(dps.total_price_spent, 0) as total_price_spent,
            COALESCE(dsc.staff_count, 0) as staff_count,
            CASE WHEN du.total_usage > 0 THEN true ELSE false END as in_use,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_edit,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_duplicate,
            CASE WHEN up.role = 'superadmin' AND du.total_usage = 0 THEN true ELSE false END as can_delete
        FROM departments d
        LEFT JOIN department_price_spent dps ON dps.department_id = d.id
        LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
        CROSS JOIN department_usage du
        CROSS JOIN user_profile up
        WHERE d.id = $1
        """

        return query, [department_id, profile_id]

    def get_department_detail_complete(
        self, department_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get complete department detail with agent roles and mapping in single query.

        Consolidates:
        - Department basic info + stats (from get_department_detail_with_stats)
        - Agent role assignments as JSONB (from get_department_agent_roles)
        - Agent mapping as JSONB (from get_valid_agents)

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH department_price_spent AS (
            SELECT 
                mr.department_id,
                SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ) as total_price_spent
            FROM model_runs mr
            JOIN model_run_models mrm ON mrm.model_run_id = mr.id
            JOIN models m ON m.id = mrm.model_id
            WHERE mr.department_id = $1
            GROUP BY mr.department_id
        ),
        department_staff_count AS (
            SELECT 
                department_id, 
                COUNT(DISTINCT profile_id) as staff_count
            FROM profile_departments
            WHERE department_id = $1
            GROUP BY department_id
        ),
        department_usage AS (
            SELECT
                (SELECT COUNT(*) FROM profile_departments WHERE department_id = $1) +
                (SELECT COUNT(*) FROM simulations WHERE department_id = $1) +
                (SELECT COUNT(*) FROM scenarios WHERE department_id = $1) +
                (SELECT COUNT(*) FROM personas WHERE department_id = $1) +
                (SELECT COUNT(*) FROM documents WHERE department_id = $1) +
                (SELECT COUNT(*) FROM cohorts WHERE department_id = $1) as total_usage
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        agent_roles_data AS (
            SELECT 
                department_id,
                COALESCE(jsonb_object_agg(role, agent_id::text), '{}'::jsonb) as agent_roles_json
            FROM department_agents
            WHERE department_id = $1 AND active = true
            GROUP BY department_id
        ),
        agent_roles_agg AS (
            SELECT 
                agent_id,
                array_agg(DISTINCT role ORDER BY role) as roles
            FROM department_agents
            WHERE active = true
            GROUP BY agent_id
        ),
        valid_agents_data AS (
            SELECT COALESCE(jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', COALESCE(a.description, ''),
                    'roles', COALESCE(ara.roles, ARRAY[]::text[])
                )
            ), '{}'::jsonb) as agent_mapping
            FROM agents a
            LEFT JOIN agent_roles_agg ara ON ara.agent_id = a.id
        )
        SELECT 
            d.id::text as department_id,
            d.title,
            d.description,
            d.active,
            d.default_department,
            COALESCE(dps.total_price_spent, 0) as total_price_spent,
            COALESCE(dsc.staff_count, 0) as staff_count,
            CASE WHEN du.total_usage > 0 THEN true ELSE false END as in_use,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_edit,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_duplicate,
            CASE WHEN up.role = 'superadmin' AND du.total_usage = 0 THEN true ELSE false END as can_delete,
            COALESCE(ard.agent_roles_json, '{}'::jsonb) as agent_roles_json,
            vad.agent_mapping
        FROM departments d
        LEFT JOIN department_price_spent dps ON dps.department_id = d.id
        LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
        LEFT JOIN agent_roles_data ard ON ard.department_id = d.id
        CROSS JOIN department_usage du
        CROSS JOIN user_profile up
        CROSS JOIN valid_agents_data vad
        WHERE d.id = $1
        """

        return query, [department_id, profile_id]

    def get_department_agent_roles(self, department_id: str) -> tuple[str, list[Any]]:
        """
        Get all agent role assignments for a department (8 roles).

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            role,
            agent_id::text
        FROM department_agents
        WHERE department_id = $1
        AND active = true
        ORDER BY role
        """

        return query, [department_id]

    def get_valid_agents(self) -> tuple[str, list[Any]]:
        """
        Get all agents for selection.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as agent_id,
            name,
            COALESCE(description, '') as description
        FROM agents
        ORDER BY name
        """

        return query, []

    def get_first_department_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get the first active department for a profile.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            d.id::text as department_id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1
        AND d.active = true
        ORDER BY d.title
        LIMIT 1
        """

        return query, [profile_id]

    def create_department(
        self, title: str, description: str, active: bool, default_department: bool
    ) -> tuple[str, list[Any]]:
        """
        Create a new department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO departments (title, description, active, default_department, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id::text as department_id
        """

        return query, [title, description, active, default_department]

    def create_department_agent(
        self, department_id: str, role: str, agent_id: str
    ) -> tuple[str, list[Any]]:
        """
        Create a department agent role assignment.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO department_agents (department_id, role, agent_id, active, created_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
        ON CONFLICT (department_id, role)
        DO UPDATE SET 
            agent_id = EXCLUDED.agent_id,
            updated_at = NOW()
        """

        return query, [department_id, role, agent_id]

    def update_department(
        self, department_id: str, title: str, description: str, active: bool, default_department: bool
    ) -> tuple[str, list[Any]]:
        """
        Update a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE departments
        SET 
            title = $2,
            description = $3,
            active = $4,
            default_department = $5,
            updated_at = NOW()
        WHERE id = $1
        """

        return query, [department_id, title, description, active, default_department]

    def delete_department_agents(self, department_id: str) -> tuple[str, list[Any]]:
        """
        Delete all agent role assignments for a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM department_agents
        WHERE department_id = $1
        """

        return query, [department_id]

    def duplicate_department(
        self, department_id: str, new_title: str
    ) -> tuple[str, list[Any]]:
        """
        Duplicate a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO departments (title, description, active, created_at, updated_at)
        SELECT $2, description, false, NOW(), NOW()
        FROM departments
        WHERE id = $1
        RETURNING id::text as department_id
        """

        return query, [department_id, new_title]

    def duplicate_department_agents(
        self, old_department_id: str, new_department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Duplicate all agent role assignments from old department to new.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO department_agents (department_id, role, agent_id, active, created_at, updated_at)
        SELECT $2, role, agent_id, active, NOW(), NOW()
        FROM department_agents
        WHERE department_id = $1
        """

        return query, [old_department_id, new_department_id]

    def delete_department(self, department_id: str) -> tuple[str, list[Any]]:
        """
        Delete a department (cascade deletes department_agents).

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM departments
        WHERE id = $1
        """

        return query, [department_id]

    def check_department_usage(self, department_id: str) -> tuple[str, list[Any]]:
        """
        Check if department is in use by other entities.

        Returns count of:
        - profiles
        - simulations
        - scenarios
        - personas
        - documents
        - cohorts

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT
            (SELECT COUNT(*) FROM profile_departments WHERE department_id = $1) as profile_count,
            (SELECT COUNT(*) FROM simulations WHERE department_id = $1) as simulation_count,
            (SELECT COUNT(*) FROM scenarios WHERE department_id = $1) as scenario_count,
            (SELECT COUNT(*) FROM personas WHERE department_id = $1) as persona_count,
            (SELECT COUNT(*) FROM documents WHERE department_id = $1) as document_count,
            (SELECT COUNT(*) FROM cohorts WHERE department_id = $1) as cohort_count
        """

        return query, [department_id]

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """
        Get profile role.

        Returns:
            Tuple of (query, params)
        """
        query = "SELECT role FROM profiles WHERE id = $1"
        return query, [profile_id]

    def get_department_default_complete(self, profile_id: str) -> tuple[str, list[Any]]:
        """
        Get department default creation data with profile role and valid agents in ONE query.

        Consolidates:
        - Profile role for permissions (from get_profile_role)
        - Valid agents list and mapping (from get_valid_agents)

        Args:
            profile_id: Profile ID

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH profile_data AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        agent_roles_agg AS (
            SELECT 
                agent_id,
                array_agg(DISTINCT role ORDER BY role) as roles
            FROM department_agents
            WHERE active = true
            GROUP BY agent_id
        ),
        valid_agents_data AS (
            SELECT 
                COALESCE(array_agg(a.id::text ORDER BY a.name), ARRAY[]::text[]) as valid_agent_ids,
                COALESCE(
                    jsonb_object_agg(
                        a.id::text,
                        jsonb_build_object(
                            'name', a.name,
                            'description', COALESCE(a.description, ''),
                            'roles', COALESCE(ara.roles, ARRAY[]::text[])
                        )
                    ),
                    '{}'::jsonb
                ) as agent_mapping
            FROM agents a
            LEFT JOIN agent_roles_agg ara ON ara.agent_id = a.id
        )
        SELECT 
            pd.role as profile_role,
            vad.valid_agent_ids,
            vad.agent_mapping
        FROM profile_data pd
        CROSS JOIN valid_agents_data vad
        """
        return query, [profile_id]
