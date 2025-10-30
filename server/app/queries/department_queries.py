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
        WITH model_run_costs AS (
            SELECT 
                mr.id as model_run_id,
                COALESCE(SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ), 0) as cost
            FROM model_runs mr
            LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
            LEFT JOIN models m ON m.id = mrm.model_id
            GROUP BY mr.id
        ),
        model_run_departments_via_agents AS (
            SELECT DISTINCT
                mrc.model_run_id,
                ad.department_id
            FROM model_run_costs mrc
            JOIN model_run_agents mra ON mra.model_run_id = mrc.model_run_id AND mra.active = true
            JOIN agent_departments ad ON ad.agent_id = mra.agent_id AND ad.active = true
            WHERE ad.department_id = ANY($1)
        ),
        model_run_departments_via_personas AS (
            SELECT DISTINCT
                mrc.model_run_id,
                pd.department_id
            FROM model_run_costs mrc
            JOIN model_run_personas mrp ON mrp.model_run_id = mrc.model_run_id AND mrp.active = true
            JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
            WHERE pd.department_id = ANY($1)
        ),
        model_run_departments AS (
            SELECT model_run_id, department_id FROM model_run_departments_via_agents
            UNION
            SELECT model_run_id, department_id FROM model_run_departments_via_personas
        ),
        department_price_spent AS (
            SELECT 
                mrd.department_id,
                SUM(mrc.cost) as total_price_spent
            FROM model_run_costs mrc
            JOIN model_run_departments mrd ON mrd.model_run_id = mrc.model_run_id
            GROUP BY mrd.department_id
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
                cd.department_id,
                COUNT(*) as total_cohort_links
            FROM cohort_departments cd
            WHERE cd.department_id = ANY($1) AND cd.active = true
            GROUP BY cd.department_id
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
            d.updated_at,
            COALESCE(dps.total_price_spent, 0) as total_price_spent,
            COALESCE(dsc.staff_count, 0) as staff_count,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
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
        WITH model_run_costs AS (
            SELECT 
                mr.id as model_run_id,
                COALESCE(SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ), 0) as cost
            FROM model_runs mr
            LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
            LEFT JOIN models m ON m.id = mrm.model_id
            GROUP BY mr.id
        ),
        model_run_departments_via_agents AS (
            SELECT DISTINCT
                mrc.model_run_id,
                ad.department_id
            FROM model_run_costs mrc
            JOIN model_run_agents mra ON mra.model_run_id = mrc.model_run_id AND mra.active = true
            JOIN agent_departments ad ON ad.agent_id = mra.agent_id AND ad.active = true
            WHERE ad.department_id = $1
        ),
        model_run_departments_via_personas AS (
            SELECT DISTINCT
                mrc.model_run_id,
                pd.department_id
            FROM model_run_costs mrc
            JOIN model_run_personas mrp ON mrp.model_run_id = mrc.model_run_id AND mrp.active = true
            JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
            WHERE pd.department_id = $1
        ),
        model_run_departments AS (
            SELECT model_run_id, department_id FROM model_run_departments_via_agents
            UNION
            SELECT model_run_id, department_id FROM model_run_departments_via_personas
        ),
        department_price_spent AS (
            SELECT 
                mrd.department_id,
                SUM(mrc.cost) as total_price_spent
            FROM model_run_costs mrc
            JOIN model_run_departments mrd ON mrd.model_run_id = mrc.model_run_id
            GROUP BY mrd.department_id
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
                (SELECT COUNT(*) FROM simulation_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM scenario_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM persona_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM document_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM cohort_departments WHERE department_id = $1 AND active = true) as total_usage
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
        Get complete department detail with permissions and stats in single query.

        Consolidates:
        - Department basic info + stats (from get_department_detail_with_stats)

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH model_run_costs AS (
            SELECT 
                mr.id as model_run_id,
                COALESCE(SUM(
                    (mr.input_tokens / 1000000.0) * COALESCE(m.input_ppm, 0) +
                    (mr.output_tokens / 1000000.0) * COALESCE(m.output_ppm, 0)
                ), 0) as cost
            FROM model_runs mr
            LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
            LEFT JOIN models m ON m.id = mrm.model_id
            GROUP BY mr.id
        ),
        model_run_departments_via_agents AS (
            SELECT DISTINCT
                mrc.model_run_id,
                ad.department_id
            FROM model_run_costs mrc
            JOIN model_run_agents mra ON mra.model_run_id = mrc.model_run_id AND mra.active = true
            JOIN agent_departments ad ON ad.agent_id = mra.agent_id AND ad.active = true
            WHERE ad.department_id = $1
        ),
        model_run_departments_via_personas AS (
            SELECT DISTINCT
                mrc.model_run_id,
                pd.department_id
            FROM model_run_costs mrc
            JOIN model_run_personas mrp ON mrp.model_run_id = mrc.model_run_id AND mrp.active = true
            JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
            WHERE pd.department_id = $1
        ),
        model_run_departments AS (
            SELECT model_run_id, department_id FROM model_run_departments_via_agents
            UNION
            SELECT model_run_id, department_id FROM model_run_departments_via_personas
        ),
        department_price_spent AS (
            SELECT 
                mrd.department_id,
                SUM(mrc.cost) as total_price_spent
            FROM model_run_costs mrc
            JOIN model_run_departments mrd ON mrd.model_run_id = mrc.model_run_id
            GROUP BY mrd.department_id
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
                (SELECT COUNT(*) FROM simulation_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM scenario_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM persona_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM document_departments WHERE department_id = $1 AND active = true) +
                (SELECT COUNT(*) FROM cohort_departments WHERE department_id = $1 AND active = true) as total_usage
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
        self, title: str, description: str, active: bool
    ) -> tuple[str, list[Any]]:
        """
        Create a new department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO departments (title, description, active, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id::text as department_id
        """

        return query, [title, description, active]

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
        self, department_id: str, title: str, description: str, active: bool
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
            updated_at = NOW()
        WHERE id = $1
        """

        return query, [department_id, title, description, active]


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
            (SELECT COUNT(*) FROM simulation_departments WHERE department_id = $1 AND active = true) as simulation_count,
            (SELECT COUNT(*) FROM scenario_departments WHERE department_id = $1 AND active = true) as scenario_count,
            (SELECT COUNT(*) FROM persona_departments WHERE department_id = $1 AND active = true) as persona_count,
            (SELECT COUNT(*) FROM document_departments WHERE department_id = $1 AND active = true) as document_count,
            (SELECT COUNT(*) FROM cohort_departments WHERE department_id = $1 AND active = true) as cohort_count
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
        Get department default creation data with profile role in ONE query.

        Args:
            profile_id: Profile ID

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT role as profile_role
        FROM profiles
        WHERE id = $1
        """
        return query, [profile_id]
