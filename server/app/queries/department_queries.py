"""Department query builders with dynamic SQL."""

from typing import Any, Dict, List


class DepartmentQueries:
    """Query builders for department operations."""

    def get_departments_list(
        self, department_ids: List[str], profile_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Get departments list with computed fields.

        Computes:
        - total_price_spent from model_runs + models pricing
        - staff_count from profile_departments
        - can_edit/can_delete from user role (superadmin only)

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
            WHERE mr.department_id = ANY(:department_ids)
            GROUP BY mr.department_id
        ),
        department_staff_count AS (
            SELECT 
                department_id, 
                COUNT(DISTINCT profile_id) as staff_count
            FROM profile_departments
            WHERE department_id = ANY(:department_ids)
            GROUP BY department_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            d.id::text as department_id,
            d.title,
            d.description,
            d.active,
            d.updated_at,
            COALESCE(dps.total_price_spent, 0) as total_price_spent,
            COALESCE(dsc.staff_count, 0) as staff_count,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_edit,
            CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_delete
        FROM departments d
        LEFT JOIN department_price_spent dps ON dps.department_id = d.id
        LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
        CROSS JOIN user_profile up
        WHERE d.id = ANY(:department_ids)
        ORDER BY d.title
        """

        params: Dict[str, Any] = {
            "department_ids": department_ids,
            "profile_id": profile_id,
        }

        return query, params

    def get_department_basic(self, department_id: str) -> tuple[str, Dict[str, Any]]:
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
        WHERE id = :department_id
        """

        params: Dict[str, Any] = {"department_id": department_id}

        return query, params

    def get_department_detail_with_stats(
        self, department_id: str, profile_id: str
    ) -> tuple[str, Dict[str, Any]]:
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
            WHERE mr.department_id = :department_id
            GROUP BY mr.department_id
        ),
        department_staff_count AS (
            SELECT 
                department_id, 
                COUNT(DISTINCT profile_id) as staff_count
            FROM profile_departments
            WHERE department_id = :department_id
            GROUP BY department_id
        ),
        department_usage AS (
            SELECT
                (SELECT COUNT(*) FROM profile_departments WHERE department_id = :department_id) +
                (SELECT COUNT(*) FROM simulations WHERE department_id = :department_id) +
                (SELECT COUNT(*) FROM scenarios WHERE department_id = :department_id) +
                (SELECT COUNT(*) FROM personas WHERE department_id = :department_id) +
                (SELECT COUNT(*) FROM documents WHERE department_id = :department_id) +
                (SELECT COUNT(*) FROM cohorts WHERE department_id = :department_id) as total_usage
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
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
        WHERE d.id = :department_id
        """

        params: Dict[str, Any] = {
            "department_id": department_id,
            "profile_id": profile_id,
        }

        return query, params

    def get_department_agent_roles(
        self, department_id: str
    ) -> tuple[str, Dict[str, Any]]:
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
        WHERE department_id = :department_id
        AND active = true
        ORDER BY role
        """

        params: Dict[str, Any] = {"department_id": department_id}

        return query, params

    def get_valid_agents(self) -> tuple[str, Dict[str, Any]]:
        """
        Get all active agents for selection.

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id::text as agent_id,
            name,
            COALESCE(description, '') as description
        FROM agents
        WHERE active = true
        ORDER BY name
        """

        params: Dict[str, Any] = {}

        return query, params

    def get_first_department_for_profile(
        self, profile_id: str
    ) -> tuple[str, Dict[str, Any]]:
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
        WHERE pd.profile_id = :profile_id
        AND d.active = true
        ORDER BY d.title
        LIMIT 1
        """

        params: Dict[str, Any] = {"profile_id": profile_id}

        return query, params

    def create_department(
        self, title: str, description: str, active: bool
    ) -> tuple[str, Dict[str, Any]]:
        """
        Create a new department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO departments (title, description, active, created_at, updated_at)
        VALUES (:title, :description, :active, NOW(), NOW())
        RETURNING id::text as department_id
        """

        params: Dict[str, Any] = {
            "title": title,
            "description": description,
            "active": active,
        }

        return query, params

    def create_department_agent(
        self, department_id: str, role: str, agent_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Create a department agent role assignment.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO department_agents (department_id, role, agent_id, active, created_at, updated_at)
        VALUES (:department_id, :role, :agent_id, true, NOW(), NOW())
        ON CONFLICT (department_id, role)
        DO UPDATE SET 
            agent_id = EXCLUDED.agent_id,
            updated_at = NOW()
        """

        params: Dict[str, Any] = {
            "department_id": department_id,
            "role": role,
            "agent_id": agent_id,
        }

        return query, params

    def update_department(
        self, department_id: str, title: str, description: str, active: bool
    ) -> tuple[str, Dict[str, Any]]:
        """
        Update a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE departments
        SET 
            title = :title,
            description = :description,
            active = :active,
            updated_at = NOW()
        WHERE id = :department_id
        """

        params: Dict[str, Any] = {
            "department_id": department_id,
            "title": title,
            "description": description,
            "active": active,
        }

        return query, params

    def delete_department_agents(
        self, department_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Delete all agent role assignments for a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM department_agents
        WHERE department_id = :department_id
        """

        params: Dict[str, Any] = {"department_id": department_id}

        return query, params

    def duplicate_department(
        self, department_id: str, new_title: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Duplicate a department.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO departments (title, description, active, created_at, updated_at)
        SELECT :new_title, description, false, NOW(), NOW()
        FROM departments
        WHERE id = :department_id
        RETURNING id::text as department_id
        """

        params: Dict[str, Any] = {
            "department_id": department_id,
            "new_title": new_title,
        }

        return query, params

    def duplicate_department_agents(
        self, old_department_id: str, new_department_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """
        Duplicate all agent role assignments from old department to new.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO department_agents (department_id, role, agent_id, active, created_at, updated_at)
        SELECT :new_department_id, role, agent_id, active, NOW(), NOW()
        FROM department_agents
        WHERE department_id = :old_department_id
        """

        params: Dict[str, Any] = {
            "old_department_id": old_department_id,
            "new_department_id": new_department_id,
        }

        return query, params

    def delete_department(self, department_id: str) -> tuple[str, Dict[str, Any]]:
        """
        Delete a department (cascade deletes department_agents).

        Returns:
            Tuple of (query, params)
        """
        query = """
        DELETE FROM departments
        WHERE id = :department_id
        """

        params: Dict[str, Any] = {"department_id": department_id}

        return query, params

    def check_department_usage(self, department_id: str) -> tuple[str, Dict[str, Any]]:
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
            (SELECT COUNT(*) FROM profile_departments WHERE department_id = :department_id) as profile_count,
            (SELECT COUNT(*) FROM simulations WHERE department_id = :department_id) as simulation_count,
            (SELECT COUNT(*) FROM scenarios WHERE department_id = :department_id) as scenario_count,
            (SELECT COUNT(*) FROM personas WHERE department_id = :department_id) as persona_count,
            (SELECT COUNT(*) FROM documents WHERE department_id = :department_id) as document_count,
            (SELECT COUNT(*) FROM cohorts WHERE department_id = :department_id) as cohort_count
        """

        params: Dict[str, Any] = {"department_id": department_id}

        return query, params

