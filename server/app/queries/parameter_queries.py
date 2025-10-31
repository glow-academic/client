"""Parameter queries - SQL query builders for parameters and parameter items."""

from typing import Any


class ParameterQueries:
    """Query builders for parameter operations with hierarchical structure."""

    def list_parameters(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for parameters list with item counts and permissions."""
        query = """
        WITH parameter_active_scenario_links AS (
            SELECT 
                pi.parameter_id,
                COUNT(DISTINCT spi.scenario_id) as active_scenario_count
            FROM parameter_items pi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
            WHERE spi.active = true
            GROUP BY pi.parameter_id
        ),
        parameter_all_scenario_links AS (
            SELECT 
                pi.parameter_id,
                COUNT(DISTINCT spi.scenario_id) as total_scenario_links
            FROM parameter_items pi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
            GROUP BY pi.parameter_id
        ),
        parameter_item_counts AS (
            SELECT 
                parameter_id,
                COUNT(*) as num_items
            FROM parameter_items
            GROUP BY parameter_id
        ),
        parameter_sample_items AS (
            SELECT 
                pi.parameter_id,
                jsonb_agg(
                    jsonb_build_object(
                        'parameter_item_id', pi.id::text,
                        'name', pi.name,
                        'description', pi.description,
                        'value', pi.value
                    ) ORDER BY pi.name
                ) as sample_items
            FROM (
                SELECT id, parameter_id, name, description, value,
                       ROW_NUMBER() OVER (PARTITION BY parameter_id ORDER BY name) as rn
                FROM parameter_items
            ) pi
            WHERE pi.rn <= 3
            GROUP BY pi.parameter_id
        ),
        parameter_item_departments_data AS (
            SELECT 
                pi.parameter_id,
                ARRAY_AGG(DISTINCT pid.department_id::text ORDER BY pid.created_at) as department_ids
            FROM parameter_items pi
            JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id
            WHERE pid.active = true
            GROUP BY pi.parameter_id
        ),
        parameter_item_departments_for_filter AS (
            SELECT DISTINCT
                pi.parameter_id,
                pid.department_id
            FROM parameter_items pi
            JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id
            WHERE pid.active = true
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
            p.updated_at,
            COALESCE(pidd.department_ids, NULL) as department_ids,
            COALESCE(pic.num_items, 0) as num_items,
            COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
            COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
            COALESCE(psi.sample_items, '[]'::jsonb) as sample_items_json,
            CASE 
                WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN COALESCE(pasl_all.total_scenario_links, 0) > 0 THEN false
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_duplicate
        FROM parameters p
        LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
        LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = p.id
        LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
        LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
        LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = p.id
        LEFT JOIN parameter_sample_items psi ON psi.parameter_id = p.id
        CROSS JOIN user_profile up
        GROUP BY p.id, p.name, p.description, p.numerical, p.active, p.updated_at, pidd.department_ids, pic.num_items, 
                 pasl.active_scenario_count, pasl_all.total_scenario_links, psi.sample_items, up.role
        HAVING 
            -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
            COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                          JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                          WHERE pi2.parameter_id = p.id AND pid2.active = true)
        ORDER BY p.updated_at DESC NULLS LAST
        """

        return (query, [department_ids, profile_id])

    def get_parameter_by_id(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter by ID.

        NOTE: Used by create_parameter_item method for validation.
        For detail views, use get_parameter_detail_complete() instead.
        """
        query = """
        SELECT 
            name,
            description,
            numerical,
            active
        FROM parameters
        WHERE id = $1
        """
        return (query, [parameter_id])

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

    def get_default_parameter(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query for default parameter."""
        query = """
        WITH user_departments AS (
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        )
        SELECT p.id
        FROM parameters p
        LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE p.active = true
        GROUP BY p.id
        HAVING 
            -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY((SELECT dept_ids FROM user_departments))) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                          JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                          WHERE pi2.parameter_id = p.id AND pid2.active = true)
        ORDER BY p.created_at DESC
        LIMIT 1
        """
        return (query, [profile_id])

    def create_parameter(self) -> tuple[str, list[Any]]:
        """Build query to create parameter."""
        query = """
        INSERT INTO parameters (
            name,
            description,
            numerical,
            active
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

    def create_parameter_item(self) -> tuple[str, list[Any]]:
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

    def get_parameter_name(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter name."""
        query = "SELECT name FROM parameters WHERE id = $1"
        return (query, [parameter_id])

    def update_parameter(self) -> tuple[str, list[Any]]:
        """Build query to update parameter."""
        query = """
        UPDATE parameters SET
            name = $2,
            description = $3,
            numerical = $4,
            active = $5,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_parameter_item_departments(
        self, parameter_item_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to deactivate all parameter item departments."""
        query = """
        UPDATE parameter_item_departments 
        SET active = false, updated_at = NOW()
        WHERE parameter_item_id = $1::uuid AND active = true
        """
        return (query, [parameter_item_id])

    def create_parameter_item_departments(
        self, parameter_item_id: str, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to create parameter_item-department junction table records.
        
        Returns:
            Tuple of (query, params)
        """
        if not department_ids:
            # Return empty query if no departments
            return "SELECT 1 WHERE false", []

        # Use UNNEST for efficient batch insert
        query = """
        INSERT INTO parameter_item_departments (parameter_item_id, department_id, active, created_at, updated_at)
        SELECT $1::uuid, dept_id::uuid, true, NOW(), NOW()
        FROM UNNEST($2::text[]) as dept_id
        ON CONFLICT (parameter_item_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
        """

        params: list[Any] = [parameter_item_id, department_ids]
        return query, params

    def delete_parameter_items(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to delete parameter items."""
        query = "DELETE FROM parameter_items WHERE parameter_id = $1"
        return (query, [parameter_id])

    def get_parameter_for_duplicate(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter data for duplication."""
        query = """
        SELECT 
            name,
            description,
            numerical
        FROM parameters
        WHERE id = $1
        """
        return (query, [parameter_id])

    def insert_duplicate_parameter(self) -> tuple[str, list[Any]]:
        """Build query to insert duplicate parameter."""
        query = """
        INSERT INTO parameters (
            name,
            description,
            numerical,
            active
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            false
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_items_for_duplicate(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter items for duplication."""
        query = """
        SELECT 
            id,
            name,
            description,
            value,
            default_item
        FROM parameter_items
        WHERE parameter_id = $1
        ORDER BY name
        """
        return (query, [parameter_id])

    def check_parameter_usage(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to check parameter usage via items."""
        query = """
        SELECT COUNT(DISTINCT spi.scenario_id) as usage_count
        FROM parameter_items pi
        JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
        WHERE pi.parameter_id = $1 AND spi.active = true
        """
        return (query, [parameter_id])

    def delete_parameter(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Build query to delete parameter."""
        query = "DELETE FROM parameters WHERE id = $1"
        return (query, [parameter_id])

    def get_parameter_detail_complete(
        self, parameter_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get parameter detail with all mappings in ONE query.

        Consolidates 6 queries into 1 using CTEs and JSONB aggregation.
        Includes parameter items with usage counts.

        Args:
            parameter_id: UUID of the parameter
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH parameter_item_departments_data AS (
            SELECT 
                pi.id as parameter_item_id,
                ARRAY_AGG(pid.department_id::text ORDER BY pid.created_at) as department_ids
            FROM parameter_items pi
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE pi.parameter_id = $1
            GROUP BY pi.id
        ),
        parameter_departments_aggregated AS (
            SELECT 
                ARRAY_AGG(DISTINCT pid.department_id::text ORDER BY pid.department_id) as department_ids
            FROM parameter_items pi
            JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE pi.parameter_id = $1
        ),
        parameter_data AS (
            SELECT 
                p.name,
                p.description,
                p.numerical,
                p.active,
                COALESCE(pda.department_ids, NULL) as department_ids
            FROM parameters p
            LEFT JOIN parameter_departments_aggregated pda ON true
            WHERE p.id = $1
        ),
        parameter_items_with_usage AS (
            SELECT 
                pi.id,
                pi.name,
                pi.description,
                pi.value,
                pi.default_item,
                COALESCE(COUNT(spi.scenario_id), 0) as usage_count,
                COALESCE(pidd.department_ids, NULL) as department_ids
            FROM parameter_items pi
            LEFT JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id AND spi.active = true
            LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_item_id = pi.id
            WHERE pi.parameter_id = $1
            GROUP BY pi.id, pi.name, pi.description, pi.value, pi.default_item, pidd.department_ids
        ),
        items_json AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'parameter_item_id', id::text,
                        'name', name,
                        'description', description,
                        'value', value,
                        'default_item', default_item,
                        'usage_count', usage_count
                    )
                    ORDER BY name
                ),
                '[]'::jsonb
            ) as items
            FROM parameter_items_with_usage
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
        )
        SELECT 
            p.*,
            ij.items as parameter_items_json,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids
        FROM parameter_data p
        CROSS JOIN items_json ij
        CROSS JOIN valid_depts vd
        """
        return (query, [parameter_id, profile_id])

    def get_parameter_detail_default_complete(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get default parameter detail in ONE query.

        Combines default parameter lookup with full detail fetch using CTEs.
        Consolidates 2 queries into 1.

        Args:
            profile_id: UUID of the profile for finding default parameter

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        default_parameter AS (
            SELECT p.id
            FROM parameters p
            JOIN user_departments ud ON ud.department_id = p.department_id
            WHERE p.active = true
            ORDER BY p.default_parameter DESC, p.created_at DESC
            LIMIT 1
        ),
        parameter_data AS (
            SELECT 
                p.name,
                p.description,
                p.numerical,
                p.active,
                p.default_parameter,
                p.department_id
            FROM parameters p
            JOIN default_parameter dp ON p.id = dp.id
        ),
        parameter_items_with_usage AS (
            SELECT 
                pi.id,
                pi.name,
                pi.description,
                pi.value,
                pi.default_item,
                COALESCE(COUNT(spi.scenario_id), 0) as usage_count
            FROM parameter_items pi
            JOIN default_parameter dp ON pi.parameter_id = dp.id
            LEFT JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id AND spi.active = true
            GROUP BY pi.id, pi.name, pi.description, pi.value, pi.default_item
        ),
        items_json AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'parameter_item_id', id::text,
                        'name', name,
                        'description', description,
                        'value', value,
                        'default_item', default_item,
                        'usage_count', usage_count
                    )
                    ORDER BY name
                ),
                '[]'::jsonb
            ) as items
            FROM parameter_items_with_usage
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
        )
        SELECT 
            p.*,
            ij.items as parameter_items_json,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids
        FROM parameter_data p
        CROSS JOIN items_json ij
        CROSS JOIN valid_depts vd
        """
        return (query, [profile_id])
