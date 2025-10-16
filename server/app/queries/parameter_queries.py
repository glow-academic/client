"""Parameter queries - SQL query builders for parameters and parameter items."""

from typing import Any, List, Tuple


class ParameterQueries:
    """Query builders for parameter operations with hierarchical structure."""

    def list_parameters(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for parameters list with item counts and permissions."""
        query = """
        WITH parameter_item_counts AS (
            SELECT 
                parameter_id,
                COUNT(*) as num_items
            FROM parameter_items
            GROUP BY parameter_id
        ),
        parameter_item_usage AS (
            SELECT DISTINCT 
                pi.parameter_id,
                COUNT(DISTINCT spi.scenario_id) as usage_count
            FROM parameter_items pi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
            WHERE spi.active = true
            GROUP BY pi.parameter_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
            p.id as parameter_id,
            p.name,
            p.description,
            p.numerical,
            p.active,
            p.default_parameter,
            COALESCE(pic.num_items, 0) as num_items,
            COALESCE(piu.usage_count, 0) as usage_count,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') AND COALESCE(piu.usage_count, 0) = 0 THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate
        FROM parameters p
        LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
        LEFT JOIN parameter_item_usage piu ON piu.parameter_id = p.id
        CROSS JOIN user_profile up
        WHERE p.department_id = ANY($1)
        ORDER BY p.name
        """

        return (query, [department_ids, profile_id])

    def get_parameter_by_id(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get parameter by ID."""
        query = """
        SELECT 
            name,
            description,
            numerical,
            active,
            default_parameter,
            department_id
        FROM parameters
        WHERE id = $1
        """
        return (query, [parameter_id])

    def get_parameter_items(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get parameter items."""
        query = """
        SELECT 
            pi.id,
            pi.name,
            pi.description,
            pi.value,
            pi.default_item,
            pi.parameter_id,
            p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE pi.parameter_id = $1
        ORDER BY pi.name
        """
        return (query, [parameter_id])

    def check_parameter_item_usage(
        self, parameter_item_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to check parameter item usage."""
        query = """
        SELECT parameter_item_id, COUNT(*) as usage_count
        FROM scenario_parameter_items
        WHERE parameter_item_id = ANY($1) AND active = true
        GROUP BY parameter_item_id
        """
        return (query, [parameter_item_ids])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        ORDER BY d.title
        """
        return (query, [profile_id])

    def get_default_parameter(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for default parameter."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        user_parameters AS (
            SELECT p.*
            FROM parameters p
            JOIN user_departments ud ON ud.department_id = p.department_id
            WHERE p.active = true
            ORDER BY p.default_parameter ASC, p.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_parameters
        """
        return (query, [profile_id])

    def create_parameter(self) -> Tuple[str, List[Any]]:
        """Build query to create parameter."""
        query = """
        INSERT INTO parameters (
            name,
            description,
            numerical,
            active,
            default_parameter,
            department_id
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def create_parameter_item(self) -> Tuple[str, List[Any]]:
        """Build query to create parameter item."""
        query = """
        INSERT INTO parameter_items (
            parameter_id,
            name,
            description,
            value,
            default_item
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_parameter_name(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get parameter name."""
        query = "SELECT name FROM parameters WHERE id = $1"
        return (query, [parameter_id])

    def update_parameter(self) -> Tuple[str, List[Any]]:
        """Build query to update parameter."""
        query = """
        UPDATE parameters SET
            name = $2,
            description = $3,
            numerical = $4,
            active = $5,
            default_parameter = $6,
            department_id = $7,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_parameter_items(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete parameter items."""
        query = "DELETE FROM parameter_items WHERE parameter_id = $1"
        return (query, [parameter_id])

    def get_parameter_for_duplicate(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get parameter data for duplication."""
        query = """
        SELECT 
            name,
            description,
            numerical,
            department_id
        FROM parameters
        WHERE id = $1
        """
        return (query, [parameter_id])

    def insert_duplicate_parameter(self) -> Tuple[str, List[Any]]:
        """Build query to insert duplicate parameter."""
        query = """
        INSERT INTO parameters (
            name,
            description,
            numerical,
            active,
            default_parameter,
            department_id
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            false,
            false,
            $4
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_items_for_duplicate(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get parameter items for duplication."""
        query = """
        SELECT 
            name,
            description,
            value,
            default_item
        FROM parameter_items
        WHERE parameter_id = $1
        ORDER BY name
        """
        return (query, [parameter_id])

    def check_parameter_usage(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to check parameter usage via items."""
        query = """
        SELECT COUNT(DISTINCT spi.scenario_id) as usage_count
        FROM parameter_items pi
        JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
        WHERE pi.parameter_id = $1 AND spi.active = true
        """
        return (query, [parameter_id])

    def delete_parameter(
        self, parameter_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete parameter."""
        query = "DELETE FROM parameters WHERE id = $1"
        return (query, [parameter_id])
