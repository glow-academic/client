"""Staff queries - SQL query builders."""

from typing import Any, Dict, List, Tuple


class StaffQueries:
    """Query builders for staff operations."""

    def list_staff(
        self, department_ids: List[str], current_profile_id: str, campus_domain: str
    ) -> Tuple[str, Dict[str, Any]]:
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
            SELECT role FROM profiles WHERE id = :current_profile_id
        )
        SELECT 
            p.id as profile_id,
            p.first_name,
            p.last_name,
            p.alias,
            p.first_name || ' ' || p.last_name as name,
            p.role,
            p.alias || '@' || :campus_domain as email,
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
        WHERE pd.department_id = ANY(:department_ids)
        GROUP BY p.id, p.first_name, p.last_name, p.role, p.alias, p.active, 
                 p.last_active, p.req_per_day, p.default_profile, pc.cohort_ids, rr.run_count, up.role
        ORDER BY p.last_name, p.first_name
        """

        params = {
            "department_ids": department_ids,
            "current_profile_id": current_profile_id,
            "campus_domain": campus_domain,
        }
        return (query, params)

    def get_cohort_mapping(
        self, cohort_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for cohort mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description FROM cohorts WHERE id = ANY(:cohort_ids)"
        params = {"cohort_ids": cohort_ids}
        return (query, params)

    def get_department_mapping(
        self, department_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for department mapping."""
        query = "SELECT id, title as name, description FROM departments WHERE id = ANY(:department_ids)"
        params = {"department_ids": department_ids}
        return (query, params)

    def get_profile_by_id(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile by ID."""
        query = """
        SELECT 
            first_name || ' ' || last_name as name,
            alias,
            role,
            req_per_day as requests_per_day,
            active
        FROM profiles
        WHERE id = :profile_id
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_profile_department(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile's department."""
        query = """
        SELECT department_id FROM profile_departments 
        WHERE profile_id = :profile_id
        LIMIT 1
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_profile_cohorts(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile's cohorts."""
        query = """
        SELECT cohort_id FROM cohort_profiles 
        WHERE profile_id = :profile_id AND active = true
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        params: Dict[str, Any] = {}
        return (query, params)

    def get_profiles_by_ids(
        self, profile_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get multiple profiles."""
        query = """
        SELECT 
            id,
            role,
            req_per_day as requests_per_day
        FROM profiles
        WHERE id = ANY(:profile_ids)
        """
        params = {"profile_ids": profile_ids}
        return (query, params)

    def get_profile_departments_bulk(
        self, profile_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get departments for multiple profiles."""
        query = """
        SELECT DISTINCT department_id
        FROM profile_departments
        WHERE profile_id = ANY(:profile_ids)
        """
        params = {"profile_ids": profile_ids}
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

    def get_profile_name(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile name."""
        query = """
        SELECT first_name || ' ' || last_name as name 
        FROM profiles WHERE id = :profile_id
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def update_profile(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update profile."""
        query = """
        UPDATE profiles SET
            role = :role,
            req_per_day = :requests_per_day,
            active = :active,
            updated_at = NOW()
        WHERE id = :profile_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def update_profile_department(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update profile department."""
        query = """
        UPDATE profile_departments SET
            department_id = :department_id
        WHERE profile_id = :profile_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def bulk_update_profiles(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to bulk update profiles."""
        query = """
        UPDATE profiles SET
            {set_clauses}
            updated_at = NOW()
        WHERE id = ANY(:profile_ids)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def bulk_update_profile_departments(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to bulk update profile departments."""
        query = """
        UPDATE profile_departments SET
            department_id = :department_id
        WHERE profile_id = ANY(:profile_ids)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def check_default_profile(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to check if profile is default."""
        query = """
        SELECT default_profile FROM profiles WHERE id = :profile_id
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def delete_profile(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete profile."""
        query = "DELETE FROM profiles WHERE id = :profile_id"
        params = {"profile_id": profile_id}
        return (query, params)

    def bulk_check_default_profiles(
        self, profile_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check which profiles are default."""
        query = """
        SELECT id FROM profiles 
        WHERE id = ANY(:profile_ids) AND default_profile = true
        """
        params = {"profile_ids": profile_ids}
        return (query, params)

    def bulk_delete_profiles(
        self, profile_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to bulk delete profiles."""
        query = "DELETE FROM profiles WHERE id = ANY(:profile_ids)"
        params = {"profile_ids": profile_ids}
        return (query, params)

    def check_alias_exists(self, alias: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to check if alias exists."""
        query = "SELECT id, alias FROM profiles WHERE alias = :alias"
        params = {"alias": alias}
        return (query, params)

    def check_aliases_exist(self, aliases: List[str]) -> Tuple[str, Dict[str, Any]]:
        """Build query to check if aliases exist."""
        query = "SELECT id, alias FROM profiles WHERE alias = ANY(:aliases)"
        params = {"aliases": aliases}
        return (query, params)

    def create_profile(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create a profile."""
        query = """
        INSERT INTO profiles (
            id, first_name, last_name, alias, role, active, 
            default_profile, viewed_intro, viewed_chat, req_per_day
        ) VALUES (
            :id, :first_name, :last_name, :alias, :role, :active,
            :default_profile, :viewed_intro, :viewed_chat, :req_per_day
        )
        """
        params: Dict[str, Any] = {}
        return (query, params)

    def insert_profile_department(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert profile-department relationship."""
        query = """
        INSERT INTO profile_departments (profile_id, department_id)
        VALUES (:profile_id, :department_id)
        ON CONFLICT (profile_id, department_id) DO NOTHING
        """
        params: Dict[str, Any] = {}
        return (query, params)

