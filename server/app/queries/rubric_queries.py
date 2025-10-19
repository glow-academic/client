"""Rubric queries - SQL query builders for hierarchical structure."""

from typing import Any


class RubricQueries:
    """Query builders for rubric operations with hierarchical structure."""

    def list_rubrics(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for rubrics list with permissions and embedded hierarchical structure."""
        query = """
        WITH rubric_usage AS (
            SELECT 
                rubric_id,
                COUNT(*) as usage_count
            FROM simulations
            GROUP BY rubric_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        rubric_data AS (
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
            WHERE r.department_id = ANY($1)
        ),
        all_rubric_ids AS (
            SELECT DISTINCT rubric_id FROM rubric_data
        ),
        rubric_groups_structure AS (
            SELECT 
                sg.rubric_id,
                jsonb_object_agg(
                    sg.id::text,
                    COALESCE(
                        (SELECT jsonb_agg(s.id::text ORDER BY s.name)
                         FROM standards s
                         WHERE s.standard_group_id = sg.id),
                        '[]'::jsonb
                    )
                ) as groups_structure
            FROM standard_groups sg
            WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
            GROUP BY sg.rubric_id
        ),
        standard_groups_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    sg.id::text,
                    jsonb_build_object(
                        'name', sg.name,
                        'description', COALESCE(sg.description, ''),
                        'points', sg.points,
                        'passPoints', sg.pass_points
                    )
                ) FILTER (WHERE sg.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM standard_groups sg
            WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
        ),
        standards_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.name,
                        'description', COALESCE(s.description, ''),
                        'points', s.points
                    )
                ) FILTER (WHERE s.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM standards s
            WHERE s.standard_group_id IN (
                SELECT id FROM standard_groups WHERE rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
            )
        )
        SELECT 
            rd.*,
            COALESCE(rgs.groups_structure, '{}'::jsonb) as standard_groups,
            sgm.mapping as standard_groups_mapping,
            sm.mapping as standards_mapping
        FROM rubric_data rd
        LEFT JOIN rubric_groups_structure rgs ON rgs.rubric_id = rd.rubric_id
        CROSS JOIN standard_groups_mapping_data sgm
        CROSS JOIN standards_mapping_data sm
        ORDER BY rd.name
        """

        return (query, [department_ids, profile_id])

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

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def get_default_rubric(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query for default rubric."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
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
        return (query, [profile_id])

    def create_rubric(self) -> tuple[str, list[Any]]:
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
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def create_standard_group(self) -> tuple[str, list[Any]]:
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

    def create_standard(self) -> tuple[str, list[Any]]:
        """Build query to create standard."""
        query = """
        INSERT INTO standards (
            standard_group_id,
            name,
            description,
            points
        )
        VALUES (
            $1,
            $2,
            $3,
            $4
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_rubric_name(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to get rubric name."""
        query = "SELECT name FROM rubrics WHERE id = $1"
        return (query, [rubric_id])

    def update_rubric(self) -> tuple[str, list[Any]]:
        """Build query to update rubric."""
        query = """
        UPDATE rubrics SET
            name = $2,
            description = $3,
            department_id = $4,
            active = $5,
            default_rubric = $6,
            points = $7,
            pass_points = $8,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_standard_groups(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to delete standard groups (cascade deletes standards)."""
        query = "DELETE FROM standard_groups WHERE rubric_id = $1"
        return (query, [rubric_id])

    def get_rubric_for_duplicate(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to get rubric data for duplication."""
        query = """
        SELECT 
            name,
            description,
            department_id,
            points,
            pass_points
        FROM rubrics
        WHERE id = $1
        """
        return (query, [rubric_id])

    def insert_duplicate_rubric(self) -> tuple[str, list[Any]]:
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
            $1 || ' Copy',
            $2,
            $3,
            false,
            false,
            $4,
            $5
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_groups_for_duplicate(self, rubric_id: str) -> tuple[str, list[Any]]:
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
        WHERE rubric_id = $1
        ORDER BY name
        """
        return (query, [rubric_id])

    def get_standards_for_duplicate(self, group_id: str) -> tuple[str, list[Any]]:
        """Build query to get standards for duplication."""
        query = """
        SELECT 
            name,
            description,
            points
        FROM standards
        WHERE standard_group_id = $1
        ORDER BY name
        """
        return (query, [group_id])

    def check_rubric_usage(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to check rubric usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulations
        WHERE rubric_id = $1
        """
        return (query, [rubric_id])

    def delete_rubric(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to delete rubric."""
        query = "DELETE FROM rubrics WHERE id = $1"
        return (query, [rubric_id])

    def update_standard_group(self) -> tuple[str, list[Any]]:
        """Build query to update existing standard group."""
        query = """
        UPDATE standard_groups SET
            name = $2,
            short_name = $3,
            description = $4,
            points = $5,
            pass_points = $6,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def update_standard(self) -> tuple[str, list[Any]]:
        """Build query to update existing standard."""
        query = """
        UPDATE standards SET
            name = $2,
            description = $3,
            points = $4,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_standard_group_by_id(self, group_id: str) -> tuple[str, list[Any]]:
        """Build query to delete single standard group (cascade deletes standards)."""
        query = "DELETE FROM standard_groups WHERE id = $1"
        return (query, [group_id])

    def delete_standard_by_id(self, standard_id: str) -> tuple[str, list[Any]]:
        """Build query to delete single standard."""
        query = "DELETE FROM standards WHERE id = $1"
        return (query, [standard_id])

    def calculate_rubric_points(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Build query to calculate rubric points from standard groups."""
        query = """
        SELECT 
            COALESCE(SUM(points), 0) as total_points,
            COALESCE(SUM(pass_points), 0) as total_pass_points
        FROM standard_groups
        WHERE rubric_id = $1
        """
        return (query, [rubric_id])

    def update_rubric_points(self) -> tuple[str, list[Any]]:
        """Build query to update rubric points."""
        query = """
        UPDATE rubrics SET
            points = $2,
            pass_points = $3,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def get_rubric_detail_complete(
        self, rubric_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get rubric detail with hierarchical structure in ONE query.

        Consolidates 5+ queries into 1 using CTEs and JSONB aggregation.
        Includes hierarchical standard_groups → standards structure.

        Args:
            rubric_id: UUID of the rubric
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH rubric_data AS (
            SELECT 
                name,
                description,
                department_id,
                active,
                default_rubric,
                points,
                pass_points as passpoints
            FROM rubrics
            WHERE id = $1
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
        profile_data AS (
            SELECT role as user_role 
            FROM profiles 
            WHERE id = $2
        ),
        standard_groups_with_standards AS (
            SELECT 
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', sg.id::text,
                            'name', sg.name,
                            'description', COALESCE(sg.description, ''),
                            'points', sg.points,
                            'passPoints', sg.pass_points,
                            'standards', (
                                SELECT COALESCE(
                                    jsonb_agg(
                                        jsonb_build_object(
                                            'id', s.id::text,
                                            'name', s.name,
                                            'description', COALESCE(s.description, ''),
                                            'points', s.points
                                        )
                                        ORDER BY s.name
                                    ),
                                    '[]'::jsonb
                                )
                                FROM standards s
                                WHERE s.standard_group_id = sg.id
                            )
                        )
                        ORDER BY sg.name
                    ),
                    '[]'::jsonb
                ) as groups_json
            FROM standard_groups sg
            WHERE sg.rubric_id = $1
        )
        SELECT 
            r.*,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids,
            pr.user_role,
            sg.groups_json as standard_groups_complete
        FROM rubric_data r
        CROSS JOIN valid_depts vd
        CROSS JOIN profile_data pr
        CROSS JOIN standard_groups_with_standards sg
        """
        return (query, [rubric_id, profile_id])
