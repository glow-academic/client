"""Staff queries - SQL query builders."""

from typing import Any


class StaffQueries:
    """Query builders for staff operations."""

    def list_staff(
        self, department_ids: list[str], current_profile_id: str, campus_domain: str
    ) -> tuple[str, list[Any]]:
        """Build query for staff list with permissions and JSONB mappings."""
        query = """
        WITH profile_active_cohort_links AS (
            SELECT 
                profile_id,
                COUNT(*) as active_cohort_count
            FROM cohort_profiles
            WHERE active = true
            GROUP BY profile_id
        ),
        profile_all_cohort_links AS (
            SELECT 
                profile_id,
                COUNT(*) as total_cohort_links
            FROM cohort_profiles
            GROUP BY profile_id
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
            SELECT role FROM profiles WHERE id = $2
        ),
        all_cohort_ids AS (
            SELECT DISTINCT unnest(cohort_ids) as cohort_id
            FROM profile_cohorts
        ),
        cohort_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                c.id::text,
                jsonb_build_object(
                    'name', c.title,
                    'description', COALESCE(c.description, '')
                )
            ), '{}'::jsonb) as cohort_mapping
            FROM cohorts c
            WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
        ),
        department_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ), '{}'::jsonb) as department_mapping
            FROM departments d
            WHERE d.id = ANY($1)
        )
        SELECT DISTINCT ON (p.id)
            p.id as profile_id,
            p.first_name,
            p.last_name,
            p.alias,
            p.first_name || ' ' || p.last_name as name,
            p.role,
            p.alias || '@' || $3 as email,
            SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1) as initials,
            p.active,
            p.last_active as lastActive,
            prl.requests_per_day as requests_per_day,
            p.default_profile,
            COALESCE(rr.run_count::int, 0) as requests_in_last_day,
            COALESCE(pc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
            COALESCE(pacl.active_cohort_count, 0) as active_cohort_count,
            COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
            CASE 
                WHEN COALESCE(pacl.active_cohort_count, 0) > 0 THEN false
                WHEN up.role = 'superadmin' THEN true
                WHEN up.role = 'admin' AND p.role NOT IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN p.default_profile = true THEN false
                WHEN COALESCE(pacl_all.total_cohort_links, 0) > 0 THEN false
                WHEN up.role = 'superadmin' THEN true
                WHEN up.role = 'admin' AND p.role NOT IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            cmd.cohort_mapping,
            dmd.department_mapping
        FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
        LEFT JOIN profile_active_cohort_links pacl ON pacl.profile_id = p.id
        LEFT JOIN profile_all_cohort_links pacl_all ON pacl_all.profile_id = p.id
        LEFT JOIN recent_runs rr ON rr.profile_id = p.id
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        CROSS JOIN user_profile up
        CROSS JOIN cohort_mapping_data cmd
        CROSS JOIN department_mapping_data dmd
        WHERE pd.department_id = ANY($1)
        ORDER BY p.id, p.last_name, p.first_name
        """

        return (query, [department_ids, current_profile_id, campus_domain])

    def get_cohort_mapping(self, cohort_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for cohort mapping."""
        query = "SELECT id, title as name, COALESCE(description, '') as description FROM cohorts WHERE id = ANY($1)"
        return (query, [cohort_ids])

    def get_department_mapping(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query for department mapping."""
        query = (
            "SELECT id, title as name, description FROM departments WHERE id = ANY($1)"
        )
        return (query, [department_ids])

    def get_profile_by_id(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile by ID."""
        query = """
        SELECT 
            p.first_name || ' ' || p.last_name as name,
            p.alias,
            p.role,
            prl.requests_per_day as requests_per_day,
            p.active
        FROM profiles p
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id = $1
        """
        return (query, [profile_id])

    def get_staff_detail_complete(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build complete query for staff detail with all related data and JSONB mappings."""
        query = """
        WITH profile_data AS (
            SELECT 
                p.first_name || ' ' || p.last_name as name,
                p.alias,
                p.role,
                prl.requests_per_day as requests_per_day,
                p.active
            FROM profiles p
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            WHERE p.id = $1
        ),
        profile_department AS (
            SELECT department_id 
            FROM profile_departments 
            WHERE profile_id = $1
            LIMIT 1
        ),
        profile_cohorts AS (
            SELECT ARRAY_AGG(cohort_id::text ORDER BY cohort_id) as cohort_ids
            FROM cohort_profiles 
            WHERE profile_id = $1 AND active = true
        ),
        cohort_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                c.id::text,
                jsonb_build_object(
                    'name', c.title,
                    'description', COALESCE(c.description, '')
                )
            ), '{}'::jsonb) as cohort_mapping
            FROM cohorts c
            WHERE c.id IN (
                SELECT cohort_id FROM cohort_profiles 
                WHERE profile_id = $1 AND active = true
            )
        )
        SELECT 
            pd.name,
            pd.alias,
            pd.role,
            pd.requests_per_day,
            pd.active,
            COALESCE(pde.department_id::text, '') as department_id,
            COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
            cmd.cohort_mapping
        FROM profile_data pd
        CROSS JOIN cohort_mapping_data cmd
        LEFT JOIN profile_department pde ON true
        LEFT JOIN profile_cohorts pc ON true
        """
        return (query, [profile_id])

    def get_profile_department(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile's department."""
        query = """
        SELECT department_id FROM profile_departments 
        WHERE profile_id = $1
        LIMIT 1
        """
        return (query, [profile_id])

    def get_profile_cohorts(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile's cohorts."""
        query = """
        SELECT cohort_id FROM cohort_profiles 
        WHERE profile_id = $1 AND active = true
        """
        return (query, [profile_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        return (query, [])

    def get_profiles_by_ids(self, profile_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to get multiple profiles with department data and JSONB mapping."""
        query = """
        WITH profile_departments_agg AS (
            SELECT 
                profile_id,
                ARRAY_AGG(DISTINCT department_id::text) as department_ids
            FROM profile_departments
            WHERE profile_id = ANY($1)
            GROUP BY profile_id
        ),
        all_department_ids AS (
            SELECT DISTINCT department_id
            FROM profile_departments
            WHERE profile_id = ANY($1)
        ),
        department_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ), '{}'::jsonb) as department_mapping
            FROM departments d
            WHERE d.id IN (SELECT department_id FROM all_department_ids)
        )
        SELECT 
            p.id,
            p.role,
            prl.requests_per_day as requests_per_day,
            COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
            dmd.department_mapping
        FROM profiles p
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
        CROSS JOIN department_mapping_data dmd
        WHERE p.id = ANY($1)
        """
        return (query, [profile_ids])

    def get_profile_departments_bulk(
        self, profile_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get departments for multiple profiles."""
        query = """
        SELECT DISTINCT department_id
        FROM profile_departments
        WHERE profile_id = ANY($1)
        """
        return (query, [profile_ids])

    def get_departments_mapping(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, title as name, description 
        FROM departments 
        WHERE id = ANY($1)
        ORDER BY title
        """
        return (query, [dept_ids])

    def get_profile_name(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile name."""
        query = """
        SELECT first_name || ' ' || last_name as name 
        FROM profiles WHERE id = $1
        """
        return (query, [profile_id])

    def update_profile(self) -> tuple[str, list[Any]]:
        """Build query to update profile."""
        query = """
        UPDATE profiles SET
            role = $2,
            active = $3,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def update_profile_department(self) -> tuple[str, list[Any]]:
        """Build query to update profile department."""
        query = """
        UPDATE profile_departments SET
            department_id = $2
        WHERE profile_id = $1
        """
        return (query, [])  # Will be filled at execution time

    def bulk_update_profiles(self) -> tuple[str, list[Any]]:
        """Build query to bulk update profiles."""
        query = """
        UPDATE profiles SET
            {set_clauses}
            updated_at = NOW()
        WHERE id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def bulk_update_profile_departments(self) -> tuple[str, list[Any]]:
        """Build query to bulk update profile departments."""
        query = """
        UPDATE profile_departments SET
            department_id = $2
        WHERE profile_id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def check_default_profile(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to check if profile is default."""
        query = """
        SELECT default_profile FROM profiles WHERE id = $1
        """
        return (query, [profile_id])

    def delete_profile(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to delete profile."""
        query = "DELETE FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def bulk_check_default_profiles(
        self, profile_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to check which profiles are default."""
        query = """
        SELECT id FROM profiles 
        WHERE id = ANY($1) AND default_profile = true
        """
        return (query, [profile_ids])

    def bulk_delete_profiles(self, profile_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to bulk delete profiles."""
        query = "DELETE FROM profiles WHERE id = ANY($1)"
        return (query, [profile_ids])

    def check_alias_exists(self, alias: str) -> tuple[str, list[Any]]:
        """Build query to check if alias exists."""
        query = "SELECT id, alias FROM profiles WHERE alias = $1"
        return (query, [alias])

    def check_aliases_exist(self, aliases: list[str]) -> tuple[str, list[Any]]:
        """Build query to check if aliases exist."""
        query = "SELECT id, alias FROM profiles WHERE alias = ANY($1)"
        return (query, [aliases])

    def create_profile(self) -> tuple[str, list[Any]]:
        """Build query to create a profile."""
        query = """
        INSERT INTO profiles (
            id, first_name, last_name, alias, role, active, 
            default_profile, viewed_intro, viewed_chat
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9
        )
        """
        return (query, [])

    def insert_profile_department(self) -> tuple[str, list[Any]]:
        """Build query to insert profile-department relationship."""
        query = """
        INSERT INTO profile_departments (profile_id, department_id)
        VALUES ($1, $2)
        ON CONFLICT (profile_id, department_id) DO NOTHING
        """
        return (query, [])

    def upsert_profile_request_limit(self) -> tuple[str, list[Any]]:
        """Build query to upsert profile request limit."""
        query = """
        INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
        VALUES ($1, $2, true)
        ON CONFLICT (profile_id, active) 
        WHERE active = true
        DO UPDATE SET 
            requests_per_day = EXCLUDED.requests_per_day,
            updated_at = NOW()
        """
        return (query, [])
