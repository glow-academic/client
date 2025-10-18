"""Staff queries - SQL query builders."""

from typing import Any, List, Tuple


class StaffQueries:
    """Query builders for staff operations."""

    def list_staff(
        self, department_ids: List[str], current_profile_id: str, campus_domain: str
    ) -> Tuple[str, List[Any]]:
        """Build query for staff list with permissions."""
        query = """
        WITH profile_cohorts AS (
            SELECT 
                cp.profile_id,
                ARRAY_AGG(cp.cohort_id ORDER BY c.name) as cohort_ids
            FROM cohort_profiles cp
            JOIN cohorts c ON c.id = cp.cohort_id
            WHERE cp.active = true
            GROUP BY cp.profile_id
        ),
        recent_runs AS (
            SELECT 
                profile_id,
                COUNT(*) as run_count
            FROM model_runs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY profile_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
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
            p.req_per_day as requests_per_day,
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
        CROSS JOIN user_profile up
        WHERE pd.department_id = ANY($1)
        GROUP BY p.id, p.first_name, p.last_name, p.role, p.alias, p.active, 
                 p.last_active, p.req_per_day, p.default_profile, pc.cohort_ids, rr.run_count, up.role
        ORDER BY p.last_name, p.first_name
        """

        return (query, [department_ids, current_profile_id, campus_domain])

    def get_cohort_mapping(
        self, cohort_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for cohort mapping."""
        query = "SELECT id, title as name, COALESCE(description, '') as description FROM cohorts WHERE id = ANY($1)"
        return (query, [cohort_ids])

    def get_department_mapping(
        self, department_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for department mapping."""
        query = "SELECT id, title as name, description FROM departments WHERE id = ANY($1)"
        return (query, [department_ids])

    def get_profile_by_id(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile by ID."""
        query = """
        SELECT 
            first_name || ' ' || last_name as name,
            alias,
            role,
            req_per_day as requests_per_day,
            active
        FROM profiles
        WHERE id = $1
        """
        return (query, [profile_id])

    def get_profile_department(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get profile's department."""
        query = """
        SELECT department_id FROM profile_departments 
        WHERE profile_id = $1
        LIMIT 1
        """
        return (query, [profile_id])

    def get_profile_cohorts(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile's cohorts."""
        query = """
        SELECT cohort_id FROM cohort_profiles 
        WHERE profile_id = $1 AND active = true
        """
        return (query, [profile_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        return (query, [])

    def get_profiles_by_ids(
        self, profile_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get multiple profiles."""
        query = """
        SELECT 
            id,
            role,
            req_per_day as requests_per_day
        FROM profiles
        WHERE id = ANY($1)
        """
        return (query, [profile_ids])

    def get_profile_departments_bulk(
        self, profile_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get departments for multiple profiles."""
        query = """
        SELECT DISTINCT department_id
        FROM profile_departments
        WHERE profile_id = ANY($1)
        """
        return (query, [profile_ids])

    def get_departments_mapping(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, title as name, description 
        FROM departments 
        WHERE id = ANY($1)
        ORDER BY title
        """
        return (query, [dept_ids])

    def get_profile_name(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile name."""
        query = """
        SELECT first_name || ' ' || last_name as name 
        FROM profiles WHERE id = $1
        """
        return (query, [profile_id])

    def update_profile(self) -> Tuple[str, List[Any]]:
        """Build query to update profile."""
        query = """
        UPDATE profiles SET
            role = $2,
            req_per_day = $3,
            active = $4,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def update_profile_department(self) -> Tuple[str, List[Any]]:
        """Build query to update profile department."""
        query = """
        UPDATE profile_departments SET
            department_id = $2
        WHERE profile_id = $1
        """
        return (query, [])  # Will be filled at execution time

    def bulk_update_profiles(self) -> Tuple[str, List[Any]]:
        """Build query to bulk update profiles."""
        query = """
        UPDATE profiles SET
            {set_clauses}
            updated_at = NOW()
        WHERE id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def bulk_update_profile_departments(self) -> Tuple[str, List[Any]]:
        """Build query to bulk update profile departments."""
        query = """
        UPDATE profile_departments SET
            department_id = $2
        WHERE profile_id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def check_default_profile(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to check if profile is default."""
        query = """
        SELECT default_profile FROM profiles WHERE id = $1
        """
        return (query, [profile_id])

    def delete_profile(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete profile."""
        query = "DELETE FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def bulk_check_default_profiles(
        self, profile_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to check which profiles are default."""
        query = """
        SELECT id FROM profiles 
        WHERE id = ANY($1) AND default_profile = true
        """
        return (query, [profile_ids])

    def bulk_delete_profiles(
        self, profile_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to bulk delete profiles."""
        query = "DELETE FROM profiles WHERE id = ANY($1)"
        return (query, [profile_ids])

    def check_alias_exists(self, alias: str) -> Tuple[str, List[Any]]:
        """Build query to check if alias exists."""
        query = "SELECT id, alias FROM profiles WHERE alias = $1"
        return (query, [alias])

    def check_aliases_exist(self, aliases: List[str]) -> Tuple[str, List[Any]]:
        """Build query to check if aliases exist."""
        query = "SELECT id, alias FROM profiles WHERE alias = ANY($1)"
        return (query, [aliases])

    def create_profile(self) -> Tuple[str, List[Any]]:
        """Build query to create a profile."""
        query = """
        INSERT INTO profiles (
            id, first_name, last_name, alias, role, active, 
            default_profile, viewed_intro, viewed_chat, req_per_day
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10
        )
        """
        return (query, [])

    def insert_profile_department(self) -> Tuple[str, List[Any]]:
        """Build query to insert profile-department relationship."""
        query = """
        INSERT INTO profile_departments (profile_id, department_id)
        VALUES ($1, $2)
        ON CONFLICT (profile_id, department_id) DO NOTHING
        """
        return (query, [])
