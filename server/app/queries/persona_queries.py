"""Persona queries - SQL query builders."""

from typing import Any, Dict, List, Tuple


class PersonaQueries:
    """Query builders for persona operations."""

    def list_personas(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for personas list with permissions."""
        query = """
        WITH persona_scenarios AS (
            SELECT 
                sp.persona_id,
                ARRAY_AGG(sp.scenario_id ORDER BY s.name) as scenario_ids,
                COUNT(sp.scenario_id) as num_scenarios
            FROM scenario_personas sp
            JOIN scenarios s ON s.id = sp.scenario_id
            WHERE sp.active = true
            GROUP BY sp.persona_id
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
                p.default_persona,
                COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ps.num_scenarios, 0) as num_scenarios,
                m.name as model_name
            FROM personas p
            LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
            LEFT JOIN models m ON m.id = p.model_id
            WHERE p.department_id = ANY(:department_ids)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            pd.*,
            CASE 
                WHEN up.role = 'superadmin' THEN true
                WHEN pd.default_persona = true THEN false
                WHEN up.role = 'admin' THEN true
                ELSE false
            END as can_edit,
            true as can_duplicate,
            CASE 
                WHEN pd.num_scenarios > 0 THEN false
                ELSE true
            END as can_delete
        FROM persona_data pd
        CROSS JOIN user_profile up
        ORDER BY pd.persona_name
        """

        params = {"department_ids": department_ids, "profile_id": profile_id}
        return (query, params)

    def get_scenario_mapping(
        self, scenario_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for scenario mapping."""
        query = "SELECT id, name FROM scenarios WHERE id = ANY(:scenario_ids)"
        params = {"scenario_ids": scenario_ids}
        return (query, params)

    def get_persona_by_id(self, persona_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get persona by ID."""
        query = """
        SELECT 
            name,
            description,
            department_id,
            active,
            default_persona,
            color,
            icon,
            model_id,
            reasoning,
            temperature,
            system_prompt
        FROM personas
        WHERE id = :persona_id
        """
        params = {"persona_id": persona_id}
        return (query, params)

    def get_valid_models(self) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid models."""
        query = "SELECT id, name FROM models WHERE active = true ORDER BY name"
        params: Dict[str, Any] = {}
        return (query, params)

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = :profile_id AND d.active = true
        ORDER BY d.title
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_default_persona(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query for default persona."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_personas AS (
            SELECT p.*
            FROM personas p
            JOIN user_departments ud ON ud.department_id = p.department_id
            WHERE p.active = true
            ORDER BY p.default_persona ASC, p.created_at DESC
            LIMIT 1
        )
        SELECT 
            id,
            name,
            description,
            department_id,
            active,
            default_persona,
            color,
            icon,
            model_id,
            reasoning,
            temperature,
            system_prompt
        FROM user_personas
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_persona_for_duplicate(
        self, persona_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get persona data for duplication."""
        query = """
        SELECT 
            name,
            description,
            system_prompt,
            temperature,
            reasoning,
            model_id,
            department_id,
            color,
            icon
        FROM personas
        WHERE id = :persona_id
        """
        params = {"persona_id": persona_id}
        return (query, params)

    def insert_duplicate_persona(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert duplicate persona."""
        query = """
        INSERT INTO personas (
            name,
            description,
            system_prompt,
            temperature,
            reasoning,
            model_id,
            department_id,
            color,
            icon,
            active,
            default_persona
        )
        VALUES (
            :name || ' Copy',
            :description,
            :system_prompt,
            :temperature,
            :reasoning,
            :model_id,
            :department_id,
            :color,
            :icon,
            false,
            false
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled with data at execution time
        return (query, params)

    def check_persona_usage(self, persona_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to check persona usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM scenario_personas
        WHERE persona_id = :persona_id AND active = true
        """
        params = {"persona_id": persona_id}
        return (query, params)

    def get_persona_name(self, persona_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get persona name."""
        query = "SELECT name FROM personas WHERE id = :persona_id"
        params = {"persona_id": persona_id}
        return (query, params)

    def delete_persona(self, persona_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete persona."""
        query = "DELETE FROM personas WHERE id = :persona_id"
        params = {"persona_id": persona_id}
        return (query, params)

    def create_persona(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create persona."""
        query = """
        INSERT INTO personas (
            name,
            description,
            department_id,
            active,
            default_persona,
            color,
            icon,
            model_id,
            reasoning,
            temperature,
            system_prompt
        )
        VALUES (
            :name,
            :description,
            :department_id,
            :active,
            :default_persona,
            :color,
            :icon,
            :model_id,
            :reasoning,
            :temperature,
            :system_prompt
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def update_persona(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update persona."""
        query = """
        UPDATE personas SET
            name = :name,
            description = :description,
            department_id = :department_id,
            active = :active,
            default_persona = :default_persona,
            color = :color,
            icon = :icon,
            model_id = :model_id,
            reasoning = :reasoning,
            temperature = :temperature,
            system_prompt = :system_prompt,
            updated_at = NOW()
        WHERE id = :persona_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_departments_mapping(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, title as name, description 
        FROM departments 
        WHERE id = ANY(:dept_ids)
        ORDER BY title
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def get_profile_role(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = :profile_id"
        params = {"profile_id": profile_id}
        return (query, params)

