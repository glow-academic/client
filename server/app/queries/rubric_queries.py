"""Rubric queries - SQL query builders for hierarchical structure."""

from typing import Any, Dict, List, Tuple


class RubricQueries:
    """Query builders for rubric operations with hierarchical structure."""

    def list_rubrics(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for rubrics list with permissions and hierarchical structure."""
        query = """
        WITH rubric_usage AS (
            SELECT 
                rubric_id,
                COUNT(*) as usage_count
            FROM simulations
            GROUP BY rubric_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            r.id as rubric_id,
            r.name,
            r.description,
            r.points,
            r.pass_points as passPoints,
            COALESCE(ru.usage_count, 0) as usage_count,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') AND COALESCE(ru.usage_count, 0) = 0 THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate
        FROM rubrics r
        LEFT JOIN rubric_usage ru ON ru.rubric_id = r.id
        CROSS JOIN user_profile up
        WHERE r.department_id = ANY(:department_ids)
        ORDER BY r.name
        """

        params = {"department_ids": department_ids, "profile_id": profile_id}
        return (query, params)

    def get_standard_groups_for_rubrics(
        self, rubric_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standard groups for rubrics."""
        query = """
        SELECT 
            id,
            rubric_id,
            name,
            short_name,
            description,
            points,
            pass_points as passPoints
        FROM standard_groups
        WHERE rubric_id = ANY(:rubric_ids)
        ORDER BY rubric_id, name
        """
        params = {"rubric_ids": rubric_ids}
        return (query, params)

    def get_standards_for_groups(
        self, group_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standards for standard groups."""
        query = """
        SELECT 
            id,
            standard_group_id,
            name,
            description,
            points
        FROM standards
        WHERE standard_group_id = ANY(:group_ids)
        ORDER BY standard_group_id, name
        """
        params = {"group_ids": group_ids}
        return (query, params)

    def get_rubric_by_id(self, rubric_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get rubric by ID."""
        query = """
        SELECT 
            name,
            description,
            department_id,
            active,
            default_rubric,
            points,
            pass_points as passPoints
        FROM rubrics
        WHERE id = :rubric_id
        """
        params = {"rubric_id": rubric_id}
        return (query, params)

    def get_standard_groups_for_rubric(
        self, rubric_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standard groups for a rubric."""
        query = """
        SELECT 
            id,
            name,
            description,
            points,
            pass_points as passPoints
        FROM standard_groups
        WHERE rubric_id = :rubric_id
        ORDER BY name
        """
        params = {"rubric_id": rubric_id}
        return (query, params)

    def get_standards_for_group(
        self, group_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standards for a group."""
        query = """
        SELECT 
            id,
            name,
            description,
            points
        FROM standards
        WHERE standard_group_id = :group_id
        ORDER BY name
        """
        params = {"group_id": group_id}
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

    def get_default_rubric(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query for default rubric."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_rubrics AS (
            SELECT r.*
            FROM rubrics r
            JOIN user_departments ud ON ud.department_id = r.department_id
            WHERE r.active = true
            ORDER BY r.default_rubric ASC, r.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_rubrics
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def create_rubric(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create rubric."""
        query = """
        INSERT INTO rubrics (
            name,
            description,
            department_id,
            active,
            default_rubric,
            points,
            pass_points
        )
        VALUES (
            :name,
            :description,
            :department_id,
            :active,
            :default_rubric,
            :points,
            :pass_points
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def create_standard_group(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create standard group."""
        query = """
        INSERT INTO standard_groups (
            rubric_id,
            name,
            short_name,
            description,
            points,
            pass_points
        )
        VALUES (
            :rubric_id,
            :name,
            :short_name,
            :description,
            :points,
            :pass_points
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def create_standard(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create standard."""
        query = """
        INSERT INTO standards (
            standard_group_id,
            name,
            description,
            points
        )
        VALUES (
            :standard_group_id,
            :name,
            :description,
            :points
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_rubric_name(self, rubric_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get rubric name."""
        query = "SELECT name FROM rubrics WHERE id = :rubric_id"
        params = {"rubric_id": rubric_id}
        return (query, params)

    def update_rubric(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update rubric."""
        query = """
        UPDATE rubrics SET
            name = :name,
            description = :description,
            department_id = :department_id,
            active = :active,
            default_rubric = :default_rubric,
            points = :points,
            pass_points = :pass_points,
            updated_at = NOW()
        WHERE id = :rubric_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def delete_standard_groups(self, rubric_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete standard groups (cascade deletes standards)."""
        query = "DELETE FROM standard_groups WHERE rubric_id = :rubric_id"
        params = {"rubric_id": rubric_id}
        return (query, params)

    def get_rubric_for_duplicate(
        self, rubric_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get rubric data for duplication."""
        query = """
        SELECT 
            name,
            description,
            department_id,
            points,
            pass_points
        FROM rubrics
        WHERE id = :rubric_id
        """
        params = {"rubric_id": rubric_id}
        return (query, params)

    def insert_duplicate_rubric(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert duplicate rubric."""
        query = """
        INSERT INTO rubrics (
            name,
            description,
            department_id,
            active,
            default_rubric,
            points,
            pass_points
        )
        VALUES (
            :name || ' Copy',
            :description,
            :department_id,
            false,
            false,
            :points,
            :pass_points
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_groups_for_duplicate(
        self, rubric_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standard groups for duplication."""
        query = """
        SELECT 
            id,
            name,
            short_name,
            description,
            points,
            pass_points
        FROM standard_groups
        WHERE rubric_id = :rubric_id
        ORDER BY name
        """
        params = {"rubric_id": rubric_id}
        return (query, params)

    def get_standards_for_duplicate(
        self, group_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get standards for duplication."""
        query = """
        SELECT 
            name,
            description,
            points
        FROM standards
        WHERE standard_group_id = :group_id
        ORDER BY name
        """
        params = {"group_id": group_id}
        return (query, params)

    def check_rubric_usage(self, rubric_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to check rubric usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulations
        WHERE rubric_id = :rubric_id
        """
        params = {"rubric_id": rubric_id}
        return (query, params)

    def delete_rubric(self, rubric_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete rubric."""
        query = "DELETE FROM rubrics WHERE id = :rubric_id"
        params = {"rubric_id": rubric_id}
        return (query, params)

