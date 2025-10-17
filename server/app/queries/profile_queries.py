"""Profile queries - SQL query builders for profile and emulation operations."""

from typing import Any, Dict, List, Tuple


class ProfileQueries:
    """Query builders for profile operations."""

    def get_profile(self, profile_id: str) -> Tuple[str, List[Any]]:
        """Build query to get profile by ID."""
        query = """
        SELECT 
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        FROM profiles
        WHERE id = $1
        """
        return (query, [profile_id])

    def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Tuple[str, List[Any]]:
        """Build query to update profile fields."""
        # Build SET clause dynamically from updates
        set_clauses = []
        params: List[Any] = []
        param_counter = 1

        for key, value in updates.items():
            set_clauses.append(f"{key} = ${param_counter}")
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
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        """
        return (query, params)

    def get_simulatable_profiles_superadmin(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get all profiles except self (for superadmin)."""
        query = """
        SELECT 
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        FROM profiles
        WHERE id != $1
        ORDER BY first_name, last_name
        """
        return (query, [profile_id])

    def get_simulatable_profiles_admin(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get instructional/ta/guest profiles (for admin)."""
        query = """
        SELECT 
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        FROM profiles
        WHERE id != $1
          AND role IN ('instructional', 'ta', 'guest')
        ORDER BY first_name, last_name
        """
        return (query, [profile_id])

    def get_simulatable_profiles_instructional(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get ta/guest profiles (for instructional)."""
        query = """
        SELECT 
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        FROM profiles
        WHERE id != $1
          AND role IN ('ta', 'guest')
        ORDER BY first_name, last_name
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
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
            viewed_intro,
            viewed_chat,
            default_profile,
            req_per_day,
            last_login,
            last_active,
            created_at,
            updated_at
        FROM profiles
        WHERE alias = $1
        """
        return (query, [alias])

    def list_user_profiles_by_user(
        self, user_id: int
    ) -> Tuple[str, List[Any]]:
        """Build query to list user_profiles by user_id."""
        query = """
        SELECT 
            user_id,
            profile_id,
            is_primary,
            active,
            created_at,
            updated_at
        FROM user_profiles
        WHERE user_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """
        return (query, [user_id])

    def list_user_profiles_by_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to list user_profiles by profile_id."""
        query = """
        SELECT 
            user_id,
            profile_id,
            is_primary,
            active,
            created_at,
            updated_at
        FROM user_profiles
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """
        return (query, [profile_id])

    def create_user_profile(
        self, user_id: int, profile_id: str, is_primary: bool, active: bool
    ) -> Tuple[str, List[Any]]:
        """Build query to create a user_profile link."""
        query = """
        INSERT INTO user_profiles (user_id, profile_id, is_primary, active)
        VALUES ($1, $2, $3, $4)
        RETURNING 
            user_id,
            profile_id,
            is_primary,
            active,
            created_at,
            updated_at
        """
        return (query, [user_id, profile_id, is_primary, active])

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
