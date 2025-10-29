"""Cohort queries - SQL query builders."""

from typing import Any


class CohortQueries:
    """Query builders for cohort operations."""

    def list_cohorts(
        self, department_ids: list[str], profile_id: str, campus_domain: str
    ) -> tuple[str, list[Any]]:
        """Build query for cohorts list with permissions, relationships, and mappings in one query."""
        query = """
        WITH cohort_profiles_agg AS (
            SELECT 
                cp.cohort_id,
                ARRAY_AGG(cp.profile_id ORDER BY p.last_name, p.first_name) as profile_ids
            FROM cohort_profiles cp
            JOIN profiles p ON p.id = cp.profile_id
            WHERE cp.active = true
            GROUP BY cp.cohort_id
        ),
        cohort_simulations_agg AS (
            SELECT 
                cs.cohort_id,
                ARRAY_AGG(cs.simulation_id ORDER BY s.title) as simulation_ids
            FROM cohort_simulations cs
            JOIN simulations s ON s.id = cs.simulation_id
            WHERE cs.active = true
            GROUP BY cs.cohort_id
        ),
        cohort_usage AS (
            SELECT DISTINCT cp.cohort_id, COUNT(DISTINCT ap.attempt_id) as usage_count
            FROM cohort_profiles cp
            JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
            WHERE cp.active = true
            GROUP BY cp.cohort_id
        ),
        cohort_departments_data AS (
            SELECT 
                cd.cohort_id,
                ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
            FROM cohort_departments cd
            WHERE cd.active = true
            GROUP BY cd.cohort_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        user_in_cohort AS (
            SELECT cohort_id
            FROM cohort_profiles
            WHERE profile_id = $2 AND active = true
        ),
        all_profile_ids AS (
            SELECT DISTINCT unnest(profile_ids) as profile_id
            FROM cohort_profiles_agg
        ),
        all_simulation_ids AS (
            SELECT DISTINCT unnest(simulation_ids) as simulation_id
            FROM cohort_simulations_agg
        )
        SELECT 
            c.id as cohort_id,
            c.title as name,
            c.description,
            c.active,
            COALESCE(cdd.department_ids, NULL) as department_ids,
            COALESCE(cp.profile_ids, ARRAY[]::uuid[]) as profile_ids,
            COALESCE(cs.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
            COALESCE(cu.usage_count, 0) as usage_count,
            COALESCE(array_length(cp.profile_ids, 1), 0) as num_members,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') AND COALESCE(cu.usage_count, 0) = 0 THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate,
            CASE
                WHEN up.role = 'instructional' 
                    AND uic.cohort_id IS NOT NULL  -- User is in cohort
                    AND (
                        -- Can leave if there are other instructional users
                        SELECT COUNT(*) > 1
                        FROM cohort_profiles cp2
                        JOIN profiles p2 ON p2.id = cp2.profile_id
                        WHERE cp2.cohort_id = c.id
                            AND cp2.active = true
                            AND p2.role = 'instructional'
                    )
                THEN true
                ELSE false
            END as can_leave,
            -- Profile mapping as JSONB
            (
                SELECT COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.first_name || ' ' || p.last_name,
                        'description', p.alias || '@' || $3
                    )
                ), '{}'::jsonb)
                FROM profiles p
                WHERE p.id IN (SELECT profile_id FROM all_profile_ids)
            ) as profile_mapping,
            -- Simulation mapping as JSONB
            (
                SELECT COALESCE(jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.title,
                        'description', COALESCE(s.description, ''),
                        'time_limit', stl.time_limit_seconds
                    )
                ), '{}'::jsonb)
                FROM simulations s
                LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
                WHERE s.id IN (SELECT simulation_id FROM all_simulation_ids)
            ) as simulation_mapping
        FROM cohorts c
        LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
        LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
        LEFT JOIN cohort_profiles_agg cp ON cp.cohort_id = c.id
        LEFT JOIN cohort_simulations_agg cs ON cs.cohort_id = c.id
        LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
        LEFT JOIN user_in_cohort uic ON uic.cohort_id = c.id
        CROSS JOIN user_profile up
        WHERE (
                -- Admin/superadmin see all
                up.role IN ('admin', 'superadmin')
                OR
                -- Instructional users only see cohorts they're in
                (up.role = 'instructional' AND uic.cohort_id IS NOT NULL)
                OR
                -- Other roles see all
                up.role NOT IN ('admin', 'superadmin', 'instructional')
            )
        GROUP BY c.id, c.title, c.description, c.active, 
                 cp.profile_ids, cs.simulation_ids, cu.usage_count, up.role, uic.cohort_id
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
        ORDER BY c.title
        """

        return (query, [department_ids, profile_id, campus_domain])

    def get_cohort_detail_complete(
        self, cohort_id: str, profile_id: str, campus_domain: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get all cohort detail data in one query."""
        query = """
        WITH cohort_departments_data AS (
            SELECT 
                cd.cohort_id,
                ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
            FROM cohort_departments cd
            WHERE cd.cohort_id = $1 AND cd.active = true
            GROUP BY cd.cohort_id
        ),
        cohort_data AS (
            SELECT 
                c.id,
                c.title,
                c.description,
                c.active,
                COALESCE(cdd.department_ids, NULL) as department_ids
            FROM cohorts c
            LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
            WHERE c.id = $1
        ),
        cohort_profile_ids AS (
            SELECT cp.profile_id
            FROM cohort_profiles cp
            WHERE cp.cohort_id = $1 AND cp.active = true
        ),
        cohort_simulation_ids AS (
            SELECT cs.simulation_id, cs.active
            FROM cohort_simulations cs
            WHERE cs.cohort_id = $1
        ),
        cohort_simulation_stats AS (
            SELECT 
                cs.simulation_id,
                cs.active,
                s.title as name,
                COALESCE(s.description, '') as description,
                stl.time_limit_seconds as time_limit,
                COUNT(DISTINCT sa.id) as usage_count,
                COALESCE(
                    ROUND(
                        100.0 * SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END)::numeric 
                        / NULLIF(COUNT(scg.id), 0)
                    )::int,
                    0
                ) as success_rate,
                MAX(sa.created_at) as last_used
            FROM cohort_simulation_ids cs
            JOIN simulations s ON s.id = cs.simulation_id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            LEFT JOIN simulation_attempts sa ON sa.simulation_id = cs.simulation_id 
            LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
            LEFT JOIN cohort_profile_ids cp ON cp.profile_id = ap.profile_id
            LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            GROUP BY cs.simulation_id, cs.active, s.title, s.description, stl.time_limit_seconds
        ),
        valid_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        valid_dept_ids AS (
            SELECT id FROM valid_departments
        ),
        valid_simulations AS (
            SELECT DISTINCT s.id
            FROM simulations s
            LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
            WHERE s.active = true
            GROUP BY s.id
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ),
        valid_profiles AS (
            SELECT DISTINCT p.id
            FROM profiles p
            JOIN profile_departments pd ON pd.profile_id = p.id
            WHERE pd.department_id IN (SELECT id FROM valid_dept_ids)
                AND p.active = true
        )
        SELECT 
            cd.title,
            cd.description,
            cd.department_ids,
            cd.active,
            -- Profile IDs in cohort
            (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
             FROM cohort_profile_ids) as profile_ids,
            -- Simulation IDs in cohort (active only)
            (SELECT COALESCE(array_agg(simulation_id::text), ARRAY[]::text[])
             FROM cohort_simulation_ids
             WHERE active = true) as simulation_ids,
            -- Valid department IDs
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_dept_ids) as valid_department_ids,
            -- Valid simulation IDs
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_simulations) as valid_simulation_ids,
            -- Valid profile IDs
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_profiles) as valid_profile_ids,
            -- Simulations list with cohort-specific statistics
            (SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'simulation_id', css.simulation_id::text,
                    'name', css.name,
                    'description', css.description,
                    'time_limit', css.time_limit,
                    'active', css.active,
                    'usage_count', css.usage_count,
                    'success_rate', css.success_rate,
                    'last_used', css.last_used,
                    'can_remove', CASE WHEN css.usage_count = 0 THEN true ELSE false END
                )
             ), '[]'::jsonb)
             FROM cohort_simulation_stats css
            ) as simulations_list,
            -- Simulation mapping (all valid simulations user can pick from)
            (SELECT COALESCE(jsonb_object_agg(
                s.id::text,
                jsonb_build_object(
                    'name', s.title,
                    'description', COALESCE(s.description, ''),
                    'time_limit', stl.time_limit_seconds
                )
             ), '{}'::jsonb)
             FROM simulations s
             LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
             WHERE s.id IN (SELECT id FROM valid_simulations)
            ) as simulation_mapping,
            -- Profile mapping
            (SELECT COALESCE(jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.first_name || ' ' || p.last_name,
                    'description', p.alias || '@' || $3
                )
             ), '{}'::jsonb)
             FROM profiles p
             WHERE p.id IN (SELECT profile_id FROM cohort_profile_ids)
            ) as profile_mapping,
            -- Department mapping
            (SELECT COALESCE(jsonb_object_agg(
                vd.id::text,
                jsonb_build_object(
                    'name', vd.name,
                    'description', COALESCE(vd.description, '')
                )
             ), '{}'::jsonb)
             FROM valid_departments vd
            ) as department_mapping
        FROM cohort_data cd
        """
        return (query, [cohort_id, profile_id, campus_domain])

    def get_cohort_detail_default_complete(
        self, profile_id: str, campus_domain: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get default cohort detail with all data in one query."""
        query = """
        WITH         user_departments AS (
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        default_cohort AS (
            SELECT c.id
            FROM cohorts c
            LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
            WHERE c.active = true
            GROUP BY c.id
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY((SELECT dept_ids FROM user_departments))) > 0
                OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
            ORDER BY c.created_at DESC
            LIMIT 1
        ),
        cohort_departments_data AS (
            SELECT 
                cd.cohort_id,
                ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
            FROM cohort_departments cd
            WHERE cd.cohort_id = (SELECT id FROM default_cohort) AND cd.active = true
            GROUP BY cd.cohort_id
        ),
        cohort_data AS (
            SELECT 
                c.id,
                c.title,
                c.description,
                c.active,
                COALESCE(cdd.department_ids, NULL) as department_ids
            FROM cohorts c
            LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
            WHERE c.id = (SELECT id FROM default_cohort)
        ),
        cohort_profile_ids AS (
            SELECT cp.profile_id
            FROM cohort_profiles cp
            WHERE cp.cohort_id = (SELECT id FROM default_cohort) AND cp.active = true
        ),
        cohort_simulation_ids AS (
            SELECT cs.simulation_id, cs.active
            FROM cohort_simulations cs
            WHERE cs.cohort_id = (SELECT id FROM default_cohort)
        ),
        cohort_simulation_stats AS (
            SELECT 
                cs.simulation_id,
                cs.active,
                s.title as name,
                COALESCE(s.description, '') as description,
                stl.time_limit_seconds as time_limit,
                COUNT(DISTINCT sa.id) as usage_count,
                COALESCE(
                    ROUND(
                        100.0 * SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END)::numeric 
                        / NULLIF(COUNT(scg.id), 0)
                    )::int,
                    0
                ) as success_rate,
                MAX(sa.created_at) as last_used
            FROM cohort_simulation_ids cs
            JOIN simulations s ON s.id = cs.simulation_id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            LEFT JOIN simulation_attempts sa ON sa.simulation_id = cs.simulation_id 
            LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
            LEFT JOIN cohort_profile_ids cp ON cp.profile_id = ap.profile_id
            LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            GROUP BY cs.simulation_id, cs.active, s.title, s.description, stl.time_limit_seconds
        ),
        valid_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        valid_dept_ids AS (
            SELECT id FROM valid_departments
        ),
        valid_simulations AS (
            SELECT DISTINCT s.id
            FROM simulations s
            LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
            WHERE s.active = true
            GROUP BY s.id
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ),
        valid_profiles AS (
            SELECT DISTINCT p.id
            FROM profiles p
            JOIN profile_departments pd ON pd.profile_id = p.id
            WHERE pd.department_id IN (SELECT id FROM valid_dept_ids)
                AND p.active = true
        )
        SELECT 
            cd.title,
            cd.description,
            cd.department_ids,
            cd.active,
            (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
             FROM cohort_profile_ids) as profile_ids,
            (SELECT COALESCE(array_agg(simulation_id::text), ARRAY[]::text[])
             FROM cohort_simulation_ids
             WHERE active = true) as simulation_ids,
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_dept_ids) as valid_department_ids,
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_simulations) as valid_simulation_ids,
            (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
             FROM valid_profiles) as valid_profile_ids,
            (SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'simulation_id', css.simulation_id::text,
                    'name', css.name,
                    'description', css.description,
                    'time_limit', css.time_limit,
                    'active', css.active,
                    'usage_count', css.usage_count,
                    'success_rate', css.success_rate,
                    'last_used', css.last_used,
                    'can_remove', CASE WHEN css.usage_count = 0 THEN true ELSE false END
                )
             ), '[]'::jsonb)
             FROM cohort_simulation_stats css
            ) as simulations_list,
            (SELECT COALESCE(jsonb_object_agg(
                s.id::text,
                jsonb_build_object(
                    'name', s.title,
                    'description', COALESCE(s.description, ''),
                    'time_limit', stl.time_limit_seconds
                )
             ), '{}'::jsonb)
             FROM simulations s
             LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
             WHERE s.id IN (SELECT id FROM valid_simulations)
            ) as simulation_mapping,
            (SELECT COALESCE(jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.first_name || ' ' || p.last_name,
                    'description', p.alias || '@' || $2
                )
             ), '{}'::jsonb)
             FROM profiles p
             WHERE p.id IN (SELECT profile_id FROM cohort_profile_ids)
            ) as profile_mapping,
            (SELECT COALESCE(jsonb_object_agg(
                vd.id::text,
                jsonb_build_object(
                    'name', vd.name,
                    'description', COALESCE(vd.description, '')
                )
             ), '{}'::jsonb)
             FROM valid_departments vd
            ) as department_mapping
        FROM cohort_data cd
        """
        return (query, [profile_id, campus_domain])

    def create_cohort(self) -> tuple[str, list[Any]]:
        """Build query to create cohort."""
        query = """
        INSERT INTO cohorts (
            title,
            description,
            active
        )
        VALUES (
            $1,
            $2,
            $3
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def insert_cohort_profile(self) -> tuple[str, list[Any]]:
        """Build query to insert cohort profile."""
        query = """
        INSERT INTO cohort_profiles (cohort_id, profile_id, active)
        VALUES ($1, $2, true)
        """
        return (query, [])  # Will be filled at execution time

    def insert_cohort_simulation(self) -> tuple[str, list[Any]]:
        """Build query to insert cohort simulation."""
        query = """
        INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
        VALUES ($1, $2, true)
        """
        return (query, [])  # Will be filled at execution time

    def get_cohort_title(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to get cohort title."""
        query = "SELECT id, title, description, active FROM cohorts WHERE id = $1"
        return (query, [cohort_id])

    def get_cohort_with_profiles_complete(
        self,
        cohort_id: str,
        department_ids: list[str],
        current_profile_id: str,
        campus_domain: str,
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get cohort with available profiles in one query."""
        query = """
        WITH cohort_data AS (
            SELECT id, title, description, active
            FROM cohorts
            WHERE id = $1
        ),
        current_cohort_profiles AS (
            SELECT cp.profile_id
            FROM cohort_profiles cp
            WHERE cp.cohort_id = $1 AND cp.active = true
        ),
        profile_cohorts AS (
            SELECT 
                cp.profile_id,
                ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
            FROM cohort_profiles cp
            JOIN cohorts c ON c.id = cp.cohort_id
            WHERE cp.active = true
            GROUP BY cp.profile_id
        ),
        recent_runs AS (
            SELECT 
                mrp.profile_id,
                COUNT(*) as run_count
            FROM model_runs mr
            JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
            WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY mrp.profile_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $3
        ),
        all_staff AS (
            SELECT DISTINCT ON (p.id)
                p.id as profile_id,
                p.first_name,
                p.last_name,
                p.alias,
                p.first_name || ' ' || p.last_name as name,
                p.role,
                p.alias || '@' || $4 as email,
                SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1) as initials,
                p.active,
                p.last_active as lastActive,
                prl.requests_per_day as requests_per_day,
                p.default_profile,
                COALESCE(rr.run_count::int, 0) as requests_in_last_day,
                COALESCE(pc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN up.role = 'admin' AND p.role != 'superadmin' THEN true
                    ELSE false
                END as can_edit,
                CASE 
                    WHEN up.role = 'superadmin' AND p.default_profile = false THEN true
                    ELSE false
                END as can_delete
            FROM profiles p
            JOIN profile_departments pd ON pd.profile_id = p.id
            LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
            LEFT JOIN recent_runs rr ON rr.profile_id = p.id
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            CROSS JOIN user_profile up
            WHERE pd.department_id = ANY($2)
            ORDER BY p.id, p.last_name, p.first_name
        ),
        available_profiles AS (
            SELECT *
            FROM all_staff
            WHERE profile_id NOT IN (SELECT profile_id FROM current_cohort_profiles)
                AND default_profile = false
                AND role IN ('instructional', 'ta')
        )
        SELECT
            cd.id::text as cohort_id,
            cd.title,
            cd.description,
            cd.active,
            -- Current profile IDs
            (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
             FROM current_cohort_profiles) as current_profile_ids,
            -- Available profiles as JSONB array
            (SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'profile_id', ap.profile_id::text,
                    'first_name', ap.first_name,
                    'last_name', ap.last_name,
                    'alias', ap.alias,
                    'name', ap.name,
                    'role', ap.role,
                    'email', ap.email,
                    'initials', ap.initials,
                    'active', ap.active,
                    'lastActive', ap.lastActive,
                    'cohort_ids', (
                        SELECT array_agg(cid::text)
                        FROM unnest(ap.cohort_ids) as cid
                    ),
                    'requests_per_day', ap.requests_per_day,
                    'default_profile', ap.default_profile,
                    'requests_in_last_day', ap.requests_in_last_day,
                    'can_edit', ap.can_edit,
                    'can_delete', ap.can_delete
                ) ORDER BY ap.last_name, ap.first_name
             ), '[]'::jsonb)
             FROM available_profiles ap
            ) as available_profiles,
            -- Department mapping
            (SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', d.description
                )
             ), '{}'::jsonb)
             FROM departments d
             WHERE d.id = ANY($2)
            ) as department_mapping
        FROM cohort_data cd
        """
        return (query, [cohort_id, department_ids, current_profile_id, campus_domain])

    def update_cohort(self) -> tuple[str, list[Any]]:
        """Build query to update cohort."""
        query = """
        UPDATE cohorts SET
            title = $2,
            description = $3,
            active = $4,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_cohort_profiles(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to delete cohort profiles."""
        query = "DELETE FROM cohort_profiles WHERE cohort_id = $1"
        return (query, [cohort_id])

    def delete_cohort_simulations(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to delete cohort simulations."""
        query = "DELETE FROM cohort_simulations WHERE cohort_id = $1"
        return (query, [cohort_id])

    def remove_cohort_profiles(self) -> tuple[str, list[Any]]:
        """Build query to remove profiles from cohort (set active = false)."""
        query = """
        UPDATE cohort_profiles 
        SET active = false, updated_at = NOW()
        WHERE cohort_id = $1 AND profile_id = ANY($2)
        """
        return (query, [])

    def get_cohort_for_duplicate(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to get cohort data for duplication."""
        query = """
        SELECT 
            title,
            description
        FROM cohorts
        WHERE id = $1
        """
        return (query, [cohort_id])

    def insert_duplicate_cohort(self) -> tuple[str, list[Any]]:
        """Build query to insert duplicate cohort."""
        query = """
        INSERT INTO cohorts (
            title,
            description,
            active
        )
        VALUES (
            $1 || ' Copy',
            $2,
            false
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def copy_cohort_profiles(self) -> tuple[str, list[Any]]:
        """Build query to copy cohort profiles."""
        query = """
        INSERT INTO cohort_profiles (cohort_id, profile_id, active)
        SELECT $1, profile_id, active
        FROM cohort_profiles
        WHERE cohort_id = $2
        """
        return (query, [])  # Will be filled at execution time

    def copy_cohort_simulations(self) -> tuple[str, list[Any]]:
        """Build query to copy cohort simulations."""
        query = """
        INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
        SELECT $1, simulation_id, active
        FROM cohort_simulations
        WHERE cohort_id = $2
        """
        return (query, [])  # Will be filled at execution time

    def check_cohort_usage(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to check cohort usage via attempt_profiles."""
        query = """
        SELECT COUNT(DISTINCT ap.attempt_id) as usage_count
        FROM cohort_profiles cp
        JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
        WHERE cp.cohort_id = $1 AND cp.active = true
        """
        return (query, [cohort_id])

    def delete_cohort(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build query to delete cohort."""
        query = "DELETE FROM cohorts WHERE id = $1"
        return (query, [cohort_id])

    def leave_cohort(self, cohort_id: str, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to remove profile from cohort."""
        query = """
        DELETE FROM cohort_profiles 
        WHERE cohort_id = $1 AND profile_id = $2
        """
        return (query, [cohort_id, profile_id])

    # ===== Analytics Queries for MCP Tools =====

    def get_cohort_with_members(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Build optimized query to get cohort with members, simulations, and all results in one query."""
        query = """
        WITH cohort_members AS (
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                p.alias
            FROM profiles p
            JOIN cohort_profiles cp ON p.id = cp.profile_id
            WHERE cp.cohort_id = $1 AND cp.active = true
        ),
        cohort_sims AS (
            SELECT 
                s.id,
                s.title,
                s.active,
                stl.time_limit_seconds as time_limit
            FROM simulations s
            JOIN cohort_simulations cs ON s.id = cs.simulation_id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE cs.cohort_id = $1 AND cs.active = true
        ),
        student_simulation_results AS (
            SELECT 
                cm.id as student_id,
                cs.id as simulation_id,
                best_results.best_score,
                best_results.passed,
                best_results.time_taken,
                best_results.attempt_count,
                best_results.last_attempt
            FROM cohort_members cm
            CROSS JOIN cohort_sims cs
            LEFT JOIN LATERAL (
                WITH student_attempts AS (
                    SELECT sa.id AS attempt_id, sa.created_at
                    FROM simulation_attempts sa
                    JOIN attempt_profiles ap ON sa.id = ap.attempt_id
                    WHERE ap.profile_id = cm.id
                      AND ap.active = true
                      AND sa.simulation_id = cs.id
                ),
                chat_grades AS (
                    SELECT 
                        sa.attempt_id,
                        sa.created_at,
                        scg.score,
                        scg.passed,
                        scg.time_taken,
                        ROW_NUMBER() OVER (
                            PARTITION BY sa.attempt_id 
                            ORDER BY sc.created_at DESC
                        ) as rn
                    FROM student_attempts sa
                    JOIN simulation_chats sc ON sc.attempt_id = sa.attempt_id
                    JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                )
                SELECT 
                    MAX(score) as best_score,
                    BOOL_OR(passed) as passed,
                    (ARRAY_AGG(time_taken ORDER BY score DESC))[1] as time_taken,
                    COUNT(DISTINCT attempt_id) as attempt_count,
                    MAX(created_at) as last_attempt
                FROM chat_grades
                WHERE rn = 1
            ) best_results ON true
        )
        SELECT 
            c.id,
            c.title,
            c.description,
            c.active,
            c.created_at,
            COALESCE(
                json_agg(DISTINCT jsonb_build_object(
                    'id', cm.id,
                    'first_name', cm.first_name,
                    'last_name', cm.last_name,
                    'alias', cm.alias
                )) FILTER (WHERE cm.id IS NOT NULL),
                '[]'::json
            ) as members,
            COALESCE(
                json_agg(DISTINCT jsonb_build_object(
                    'id', cs.id,
                    'title', cs.title,
                    'active', cs.active,
                    'time_limit', cs.time_limit
                )) FILTER (WHERE cs.id IS NOT NULL),
                '[]'::json
            ) as simulations,
            -- Student results as JSONB with nested structure
            COALESCE(
                (SELECT jsonb_object_agg(
                    ssr.student_id::text,
                    jsonb_object_agg(
                        ssr.simulation_id::text,
                        CASE 
                            WHEN ssr.best_score IS NOT NULL THEN
                                jsonb_build_object(
                                    'score', ssr.best_score,
                                    'passed', ssr.passed,
                                    'time_taken', ssr.time_taken,
                                    'attempt_count', ssr.attempt_count,
                                    'last_attempt', ssr.last_attempt
                                )
                            ELSE NULL
                        END
                    )
                 )
                 FROM (
                     SELECT 
                         student_id,
                         simulation_id,
                         best_score,
                         passed,
                         time_taken,
                         attempt_count,
                         last_attempt
                     FROM student_simulation_results
                 ) ssr
                 GROUP BY ssr.student_id
                ),
                '{}'::jsonb
            ) as student_results
        FROM cohorts c
        LEFT JOIN cohort_members cm ON true
        LEFT JOIN cohort_sims cs ON true
        WHERE c.id = $1
        GROUP BY c.id, c.title, c.description, c.active, c.created_at
        """
        return (query, [cohort_id])

    def search_cohorts_fuzzy(
        self, where_clause: str, limit: int
    ) -> tuple[str, list[Any]]:
        """
        Build fuzzy search query for cohorts by title and description.
        Uses dynamic WHERE clause built by search utilities.
        Includes profile counts in the same query.

        Params: Built dynamically by search utilities, plus limit at end
        """
        query = f"""
            SELECT 
                c.id,
                c.title,
                c.active,
                c.description,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM cohort_profiles cp
                     WHERE cp.cohort_id = c.id AND cp.active = true),
                    0
                ) as profile_count
            FROM cohorts c
            WHERE {where_clause}
            LIMIT ${{param_count}}
        """
        return (query, [limit])

    def get_cohort_overview_complete(self, cohort_id: Any) -> tuple[str, list[Any]]:
        """Build optimized query to get cohort overview with all related data in ONE query.

        Fetches cohort + profiles (roster) + simulations using LEFT JOINs and JSON aggregation
        to avoid N+1 queries.

        Args:
            cohort_id: UUID of the cohort

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        SELECT 
            c.id, c.title, c.description, c.active, c.created_at,
            -- Profiles array (json_agg with ordering)
            COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', p.id,
                    'first_name', p.first_name,
                    'last_name', p.last_name,
                    'alias', p.alias,
                    'role', p.role
                ) ORDER BY p.last_name, p.first_name) FILTER (WHERE p.id IS NOT NULL),
                '[]'::jsonb
            ) as roster,
            -- Simulations array (json_agg with filtering)
            COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'active', s.active,
                    'time_limit', stl.time_limit_seconds
                )) FILTER (WHERE s.id IS NOT NULL),
                '[]'::jsonb
            ) as simulations
        FROM cohorts c
        LEFT JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.active = true
        LEFT JOIN profiles p ON p.id = cp.profile_id
        LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.active = true
        LEFT JOIN simulations s ON s.id = cs.simulation_id AND s.active = true
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        WHERE c.id = $1
        GROUP BY c.id, c.title, c.description, c.active, c.created_at
        """
        return (query, [cohort_id])
