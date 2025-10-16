"""Cohort queries - SQL query builders."""

from typing import Any, List, Tuple


class CohortQueries:
    """Query builders for cohort operations."""

    def list_cohorts(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for cohorts list with permissions and relationships."""
        query = """
        WITH cohort_profiles AS (
            SELECT 
                cp.cohort_id,
                ARRAY_AGG(cp.profile_id ORDER BY p.last_name, p.first_name) as profile_ids
            FROM cohort_profiles cp
            JOIN profiles p ON p.id = cp.profile_id
            WHERE cp.active = true
            GROUP BY cp.cohort_id
        ),
        cohort_simulations AS (
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
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        user_in_cohort AS (
            SELECT cohort_id
            FROM cohort_profiles
            WHERE profile_id = $2 AND active = true
        )
        SELECT 
            c.id as cohort_id,
            c.title as name,
            c.description,
            c.active,
            c.default_cohort,
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
            END as can_leave
        FROM cohorts c
        LEFT JOIN cohort_profiles cp ON cp.cohort_id = c.id
        LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
        LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
        LEFT JOIN user_in_cohort uic ON uic.cohort_id = c.id
        CROSS JOIN user_profile up
        WHERE c.department_id = ANY($1)
            AND (
                -- Admin/superadmin see all
                up.role IN ('admin', 'superadmin')
                OR
                -- Instructional users only see cohorts they're in
                (up.role = 'instructional' AND uic.cohort_id IS NOT NULL)
                OR
                -- Other roles see all
                up.role NOT IN ('admin', 'superadmin', 'instructional')
            )
        GROUP BY c.id, c.title, c.description, c.active, c.default_cohort, 
                 cp.profile_ids, cs.simulation_ids, cu.usage_count, up.role, uic.cohort_id
        ORDER BY c.title
        """

        return (query, [department_ids, profile_id])

    def get_profile_mapping(
        self, profile_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for profile mapping."""
        query = """
        SELECT id, first_name || ' ' || last_name as name, COALESCE(email, '') as description 
        FROM profiles 
        WHERE id = ANY($1)
        """
        return (query, [profile_ids])

    def get_simulation_mapping(
        self, simulation_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for simulation mapping."""
        query = "SELECT id, title as name, COALESCE(description, '') as description FROM simulations WHERE id = ANY($1)"
        return (query, [simulation_ids])

    def get_cohort_by_id(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to get cohort by ID."""
        query = """
        SELECT 
            title,
            description,
            department_id,
            active,
            default_cohort
        FROM cohorts
        WHERE id = $1
        """
        return (query, [cohort_id])

    def get_cohort_profiles(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to get cohort's profiles."""
        query = """
        SELECT profile_id FROM cohort_profiles 
        WHERE cohort_id = $1 AND active = true
        """
        return (query, [cohort_id])

    def get_cohort_simulations(
        self, cohort_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get cohort's simulations."""
        query = """
        SELECT simulation_id FROM cohort_simulations 
        WHERE cohort_id = $1 AND active = true
        """
        return (query, [cohort_id])

    def get_valid_simulations(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for valid simulations."""
        query = """
        SELECT id FROM simulations 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY title
        """
        return (query, [dept_ids])

    def get_valid_profiles(self, dept_ids: List[str]) -> Tuple[str, List[Any]]:
        """Build query for valid profiles."""
        query = """
        SELECT DISTINCT p.id
        FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE pd.department_id = ANY($1) AND p.active = true
        ORDER BY p.last_name, p.first_name
        """
        return (query, [dept_ids])

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

    def get_default_cohort(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query for default cohort."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        user_cohorts AS (
            SELECT c.*
            FROM cohorts c
            JOIN user_departments ud ON ud.department_id = c.department_id
            WHERE c.active = true
            ORDER BY c.default_cohort ASC, c.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_cohorts
        """
        return (query, [profile_id])

    def create_cohort(self) -> Tuple[str, List[Any]]:
        """Build query to create cohort."""
        query = """
        INSERT INTO cohorts (
            title,
            description,
            department_id,
            active,
            default_cohort
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

    def insert_cohort_profile(self) -> Tuple[str, List[Any]]:
        """Build query to insert cohort profile."""
        query = """
        INSERT INTO cohort_profiles (cohort_id, profile_id, active)
        VALUES ($1, $2, true)
        """
        return (query, [])  # Will be filled at execution time

    def insert_cohort_simulation(self) -> Tuple[str, List[Any]]:
        """Build query to insert cohort simulation."""
        query = """
        INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
        VALUES ($1, $2, true)
        """
        return (query, [])  # Will be filled at execution time

    def get_cohort_title(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to get cohort title."""
        query = "SELECT title FROM cohorts WHERE id = $1"
        return (query, [cohort_id])

    def update_cohort(self) -> Tuple[str, List[Any]]:
        """Build query to update cohort."""
        query = """
        UPDATE cohorts SET
            title = $2,
            description = $3,
            department_id = $4,
            active = $5,
            default_cohort = $6,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_cohort_profiles(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete cohort profiles."""
        query = "DELETE FROM cohort_profiles WHERE cohort_id = $1"
        return (query, [cohort_id])

    def delete_cohort_simulations(
        self, cohort_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete cohort simulations."""
        query = "DELETE FROM cohort_simulations WHERE cohort_id = $1"
        return (query, [cohort_id])

    def remove_cohort_profiles(self) -> Tuple[str, List[Any]]:
        """Build query to remove profiles from cohort (set active = false)."""
        query = """
        UPDATE cohort_profiles 
        SET active = false, updated_at = NOW()
        WHERE cohort_id = $1 AND profile_id = ANY($2)
        """
        return (query, [])

    def get_cohort_for_duplicate(
        self, cohort_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get cohort data for duplication."""
        query = """
        SELECT 
            title,
            description,
            department_id
        FROM cohorts
        WHERE id = $1
        """
        return (query, [cohort_id])

    def insert_duplicate_cohort(self) -> Tuple[str, List[Any]]:
        """Build query to insert duplicate cohort."""
        query = """
        INSERT INTO cohorts (
            title,
            description,
            department_id,
            active,
            default_cohort
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            false,
            false
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def copy_cohort_profiles(self) -> Tuple[str, List[Any]]:
        """Build query to copy cohort profiles."""
        query = """
        INSERT INTO cohort_profiles (cohort_id, profile_id, active)
        SELECT $1, profile_id, active
        FROM cohort_profiles
        WHERE cohort_id = $2
        """
        return (query, [])  # Will be filled at execution time

    def copy_cohort_simulations(self) -> Tuple[str, List[Any]]:
        """Build query to copy cohort simulations."""
        query = """
        INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
        SELECT $1, simulation_id, active
        FROM cohort_simulations
        WHERE cohort_id = $2
        """
        return (query, [])  # Will be filled at execution time

    def check_cohort_usage(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to check cohort usage via attempt_profiles."""
        query = """
        SELECT COUNT(DISTINCT ap.attempt_id) as usage_count
        FROM cohort_profiles cp
        JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
        WHERE cp.cohort_id = $1 AND cp.active = true
        """
        return (query, [cohort_id])

    def delete_cohort(self, cohort_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete cohort."""
        query = "DELETE FROM cohorts WHERE id = $1"
        return (query, [cohort_id])

    def leave_cohort(
        self, cohort_id: str, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to remove profile from cohort."""
        query = """
        DELETE FROM cohort_profiles 
        WHERE cohort_id = $1 AND profile_id = $2
        """
        return (query, [cohort_id, profile_id])
