"""Profile queries - SQL query builders for profile and emulation operations."""

from typing import Any, Dict, List, Tuple


class ProfileQueries:
    """Query builders for profile operations."""

    def get_profile(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile by ID."""
        query = """
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.alias,
            p.role,
            p.active,
            p.viewed_intro,
            p.viewed_chat,
            p.default_profile,
            prl.requests_per_day as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id = $1
        """
        return (query, [profile_id])

    def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Tuple[str, List[Any]]:
        """Build query to update profile fields."""
        # Map camelCase API field names to snake_case database column names
        field_map = {
            "firstName": "first_name",
            "lastName": "last_name",
            "lastLogin": "last_login",
            "viewedIntro": "viewed_intro",
            "viewedChat": "viewed_chat",
            # reqPerDay moved to profile_request_limits junction table
            "lastActive": "last_active",
            "defaultProfile": "default_profile",
            # These are already snake_case or match
            "role": "role",
            "active": "active",
        }
        
        # Build SET clause dynamically from updates
        set_clauses = []
        params: List[Any] = []
        param_counter = 1

        for key, value in updates.items():
            # Convert camelCase to snake_case using the map
            db_field = field_map.get(key, key)
            set_clauses.append(f"{db_field} = ${param_counter}")
            params.append(value)
            param_counter += 1

        # Always update updated_at
        set_clauses.append("updated_at = NOW()")

        # Add profile_id as last parameter
        params.append(profile_id)

        query = f"""
        UPDATE profiles SET
            {', '.join(set_clauses)}
        WHERE id = ${param_counter}
        RETURNING 
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            (SELECT requests_per_day FROM profile_request_limits WHERE profile_id = id AND active = true LIMIT 1) as req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at,
            (SELECT department_id FROM profile_departments WHERE profile_id = id AND is_primary = TRUE LIMIT 1) as primary_department_id
        """
        return (query, params)

    def get_simulatable_profiles_superadmin(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get all profiles except self (for superadmin)."""
        query = """
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.alias,
            p.role,
            p.active,
            p.viewed_intro,
            p.viewed_chat,
            p.default_profile,
            prl.requests_per_day as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id != $1
        ORDER BY p.first_name, p.last_name
        """
        return (query, [profile_id])

    def get_simulatable_profiles_admin(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get instructional/ta/guest profiles (for admin)."""
        query = """
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.alias,
            p.role,
            p.active,
            p.viewed_intro,
            p.viewed_chat,
            p.default_profile,
            prl.requests_per_day as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id != $1
        AND p.role IN ('instructional', 'ta', 'guest')
        ORDER BY p.first_name, p.last_name
        """
        return (query, [profile_id])

    def get_simulatable_profiles_instructional(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get ta/guest profiles (for instructional)."""
        query = """
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.alias,
            p.role,
            p.active,
            p.viewed_intro,
            p.viewed_chat,
            p.default_profile,
            prl.requests_per_day as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id != $1
          AND p.role IN ('ta', 'guest')
        ORDER BY p.first_name, p.last_name
        """
        return (query, [profile_id])

    def get_profile_role(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile role."""
        query = """
        SELECT role
        FROM profiles
        WHERE id = $1
        """
        return (query, [profile_id])

    def get_profile_by_alias(self, alias: str) -> Tuple[str, List[Any]]:
        """Build query to get profile by alias."""
        query = """
        SELECT 
            p.id,
            p.first_name,
            p.last_name,
            p.alias,
            p.role,
            p.active,
            p.viewed_intro,
            p.viewed_chat,
            p.default_profile,
            prl.requests_per_day as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.alias = $1
        """
        return (query, [alias])

    def get_default_guest_profile(self) -> Tuple[str, List[Any]]:
        """Build query to get default guest profile."""
        query = """
        SELECT id
        FROM profiles
        WHERE role = 'guest' AND default_profile = true
        LIMIT 1
        """
        return (query, [])

    def check_profile_exists_by_alias(self, alias: str) -> Tuple[str, List[Any]]:
        """Build query to check if profile with alias exists."""
        query = """
        SELECT id
        FROM profiles
        WHERE alias = $1
        """
        return (query, [alias])

    def insert_profile(
        self, profile_id: str, first_name: str, alias: str, role: str, viewed_intro: bool
    ) -> Tuple[str, List[Any]]:
        """Build query to insert a new profile."""
        query = """
        INSERT INTO profiles (id, first_name, alias, role, viewed_intro)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, alias, role
        """
        return (query, [profile_id, first_name, alias, role, viewed_intro])

    def search_profiles_fuzzy(
        self, where_clause: str, limit: int
    ) -> Tuple[str, List[Any]]:
        """
        Build fuzzy search query for profiles by first_name, last_name, and alias.
        Uses dynamic WHERE clause built by search utilities.
        
        Params: Built dynamically by search utilities, plus limit at end
        """
        query = f"""
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                p.alias,
                p.role
            FROM profiles p
            WHERE {where_clause}
            LIMIT ${{param_count}}
        """
        return (query, [limit])

    # ===== Analytics Queries for MCP Tools =====

    def get_student_simulation_report_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get profile data for student simulation report."""
        query = """
        SELECT id, first_name, last_name, alias, role, created_at
        FROM profiles
        WHERE id = $1
        """
        return (query, [profile_id])

    def get_student_simulation_report_attempts(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get all attempts with chats, grades for a student."""
        query = """
        SELECT 
            sa.id as attempt_id,
            sa.created_at as attempt_created_at,
            s.id as simulation_id,
            s.title as simulation_title,
            sc.id as chat_id,
            sc.title as chat_title,
            sc.completed as chat_completed,
            sc.completed_at as chat_completed_at,
            sc.created_at as chat_created_at,
            scn.id as scenario_id,
            scn.name as scenario_name,
            scn.problem_statement as scenario_description,
            scg.id as grade_id,
            scg.score,
            scg.passed,
            scg.time_taken,
            scg.created_at as grade_created_at
        FROM simulation_attempts sa
        JOIN attempt_profiles ap ON sa.id = ap.attempt_id
        JOIN simulations s ON s.id = sa.simulation_id
        LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
        LEFT JOIN scenarios scn ON scn.id = sc.scenario_id
        LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
        WHERE ap.profile_id = $1 AND ap.active = true
        ORDER BY sa.created_at, sc.created_at
        """
        return (query, [profile_id])

    def get_student_simulation_report_messages(
        self, chat_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get messages for multiple chats."""
        query = """
        SELECT 
            chat_id,
            created_at,
            type,
            content,
            completed
        FROM simulation_messages
        WHERE chat_id = ANY($1)
        ORDER BY chat_id, created_at
        """
        return (query, [chat_ids])

    def get_student_simulation_report_feedback(
        self, grade_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get feedback for multiple grades."""
        query = """
        SELECT 
            scf.simulation_chat_grade_id,
            st.name as standard_name,
            scf.total as points,
            scf.feedback
        FROM simulation_chat_feedbacks scf
        JOIN standards st ON st.id = scf.standard_id
        WHERE scf.simulation_chat_grade_id = ANY($1)
        ORDER BY scf.simulation_chat_grade_id
        """
        return (query, [grade_ids])

    def get_profile_overview_complete(self, profile_id_or_name: str, limit: int = 5) -> Tuple[str, List[Any]]:
        """Build optimized query to get profile overview with all related data in ONE query.
        
        Fetches profile + latest grades using CTE and JSON aggregation to avoid N+1 queries.
        Supports searching by UUID or name (first_name, last_name, alias).
        
        Args:
            profile_id_or_name: UUID or name pattern to search for
            limit: Number of latest grades to return (default: 5)
            
        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH profile_match AS (
            SELECT id
            FROM profiles
            WHERE id::text = $1 
                OR LOWER(first_name) LIKE $2
                OR LOWER(last_name) LIKE $2
                OR LOWER(alias) LIKE $2
            LIMIT 1
        ),
        latest_attempts AS (
            SELECT sa.id as attempt_id, sa.simulation_id, sa.created_at
            FROM simulation_attempts sa
            JOIN attempt_profiles ap ON ap.attempt_id = sa.id
            JOIN profile_match pm ON pm.id = ap.profile_id
            WHERE ap.active = true
            ORDER BY sa.created_at DESC
            LIMIT $3
        ),
        attempt_grades AS (
            SELECT 
                s.title as simulation_title,
                scg.score,
                scg.passed,
                scg.time_taken,
                scg.created_at,
                ROW_NUMBER() OVER (PARTITION BY la.attempt_id ORDER BY sc.created_at DESC) as rn
            FROM latest_attempts la
            JOIN simulations s ON s.id = la.simulation_id
            JOIN simulation_chats sc ON sc.attempt_id = la.attempt_id
            JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
        )
        SELECT 
            p.id, p.first_name, p.last_name, p.alias, p.role, 
            p.last_login, p.viewed_intro, p.active, p.created_at,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'simulation_title', ag.simulation_title,
                    'score', ag.score,
                    'passed', ag.passed,
                    'time_taken', ag.time_taken,
                    'created_at', ag.created_at
                ) ORDER BY ag.created_at DESC)
                FROM attempt_grades ag
                WHERE ag.rn = 1),
                '[]'::jsonb
            ) as latest_grades
        FROM profiles p
        JOIN profile_match pm ON pm.id = p.id
        """
        search_pattern = f"%{profile_id_or_name.lower()}%"
        return (query, [profile_id_or_name, search_pattern, limit])

    # ===== WebSocket Connection Management Queries =====

    def update_profile_to_inactive(self) -> str:
        """Build query to set profile inactive with last_active timestamp.
        
        Params order: last_active, profile_id
        """
        return """
        UPDATE profiles 
        SET active = false, last_active = $1
        WHERE id = $2
        """

    def update_profile_to_active(self) -> str:
        """Build query to set profile active with last_active timestamp.
        
        Params order: last_active, profile_id
        """
        return """
        UPDATE profiles 
        SET active = true, last_active = $1 
        WHERE id = $2
        """

    def update_default_guest_profile_to_active(self) -> str:
        """Build query to set default guest profile active with last_active timestamp.
        
        Params order: last_active
        """
        return """
        UPDATE profiles 
        SET active = true, last_active = $1 
        WHERE role = 'guest' AND default_profile = true
        """

    def update_default_guest_profile_activity(self) -> str:
        """Build query to update default guest profile activity status.
        
        Params order: last_active, active
        """
        return """
        UPDATE profiles 
        SET last_active = $1, active = $2
        WHERE role = 'guest' AND default_profile = true
        """

    # ===== Profile context queries =====

    def get_profile_departments(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get departments for a profile with is_primary flag."""
        query = """
        SELECT 
            d.id,
            d.title,
            d.description,
            d.active,
            pd.is_primary
        FROM profile_departments pd
        JOIN departments d ON d.id = pd.department_id
        WHERE pd.profile_id = $1 AND pd.active = true
        ORDER BY pd.is_primary DESC, d.title
        """
        return (query, [profile_id])

    def get_profile_cohorts(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get cohorts for a profile."""
        query = """
        SELECT DISTINCT
            c.id,
            c.title,
            c.description,
            c.active,
            c.department_id
        FROM cohorts c
        JOIN cohort_profiles pc ON pc.cohort_id = c.id
        WHERE pc.profile_id = $1 
          AND pc.active = true
          AND c.active = true
        ORDER BY c.title
        """
        return (query, [profile_id])

    def get_cohort_simulations(
        self, cohort_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get simulations for cohorts."""
        query = """
        SELECT DISTINCT
            s.id,
            s.title,
            s.description,
            s.department_id,
            stl.time_limit_seconds as time_limit,
            s.active,
            s.default_simulation,
            s.practice_simulation
        FROM simulations s
        JOIN cohort_simulations cs ON cs.simulation_id = s.id
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        WHERE cs.cohort_id = ANY($1::uuid[])
          AND s.active = true
        ORDER BY s.title
        """
        return (query, [cohort_ids])

    def get_earliest_attempt_date(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get earliest attempt date for a profile."""
        query = """
        SELECT MIN(sa.created_at) as earliest
        FROM simulation_attempts sa
        JOIN attempt_profiles ap ON ap.attempt_id = sa.id
        WHERE ap.profile_id = $1
        """
        return (query, [profile_id])
