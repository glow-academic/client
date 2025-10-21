"""Profile queries - SQL query builders for profile and emulation operations."""

from typing import Any


class ProfileQueries:
    """Query builders for profile operations."""

    def get_profile(self, profile_id: str) -> tuple[str, list[Any]]:
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
        self, profile_id: str, updates: dict[str, Any]
    ) -> tuple[str, list[Any]]:
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
        params: list[Any] = []
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
            {", ".join(set_clauses)}
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

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = """
        SELECT role
        FROM profiles
        WHERE id = $1
        """
        return (query, [profile_id])

    def get_simulatable_profiles_combined(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get simulatable profiles in ONE query.

        Combines role lookup and profile filtering using CTE to eliminate
        the 2-query pattern in get_simulatable_profiles().

        Args:
            profile_id: UUID of the requester

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH requester_role AS (
            SELECT role
            FROM profiles
            WHERE id = $1
        )
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
            COALESCE(prl.requests_per_day, 0) as req_per_day,
            p.last_login,
            p.last_active,
            p.created_at,
            p.updated_at,
            pd.department_id as primary_department_id
        FROM profiles p
        CROSS JOIN requester_role rr
        LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
        LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
        WHERE p.id != $1
          AND CASE 
            WHEN rr.role = 'superadmin' THEN true
            WHEN rr.role = 'admin' THEN p.role IN ('instructional', 'ta', 'guest')
            WHEN rr.role = 'instructional' THEN p.role IN ('ta', 'guest')
            ELSE false
          END
        ORDER BY p.first_name, p.last_name
        """
        return (query, [profile_id])

    def get_profile_by_alias(self, alias: str) -> tuple[str, list[Any]]:
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

    def get_default_guest_profile(self) -> tuple[str, list[Any]]:
        """Build query to get default guest profile."""
        query = """
        SELECT id
        FROM profiles
        WHERE role = 'guest' AND default_profile = true
        LIMIT 1
        """
        return (query, [])

    def check_profile_exists_by_alias(self, alias: str) -> tuple[str, list[Any]]:
        """Build query to check if profile with alias exists."""
        query = """
        SELECT id
        FROM profiles
        WHERE alias = $1
        """
        return (query, [alias])

    def insert_profile(
        self,
        profile_id: str,
        first_name: str,
        alias: str,
        role: str,
        viewed_intro: bool,
    ) -> tuple[str, list[Any]]:
        """Build query to insert a new profile."""
        query = """
        INSERT INTO profiles (id, first_name, alias, role, viewed_intro)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, alias, role
        """
        return (query, [profile_id, first_name, alias, role, viewed_intro])

    def search_profiles_fuzzy(
        self, where_clause: str, limit: int
    ) -> tuple[str, list[Any]]:
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

    def get_student_simulation_report_complete(
        self, profile_id: str, recent: int = 50
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get complete student simulation report in ONE query.

        Fetches profile, attempts, chats, grades, messages, and feedback
        using CTEs and JSON aggregation to eliminate N+1 queries.

        Args:
            profile_id: UUID of the student profile
            recent: Limit messages per chat (default: 50)

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH profile_info AS (
            SELECT id, first_name, last_name, alias, role, created_at
            FROM profiles
            WHERE id = $1
        ),
        attempt_chats AS (
            SELECT 
                sa.id as attempt_id,
                sa.created_at as attempt_created_at,
                s.id as simulation_id,
                s.title as simulation_title,
                sc.id as chat_id,
                sc.title as chat_title,
                sc.completed as chat_completed,
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
        ),
        chat_messages AS (
            SELECT 
                ac.chat_id,
                COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'created_at', sm.created_at,
                            'type', sm.type,
                            'content', sm.content,
                            'completed', sm.completed
                        ) ORDER BY sm.created_at
                    ) 
                    FROM (
                        SELECT created_at, type, content, completed
                        FROM simulation_messages
                        WHERE chat_id = ac.chat_id
                        ORDER BY created_at DESC
                        LIMIT $2
                    ) sm),
                    '[]'::jsonb
                ) as messages
            FROM attempt_chats ac
            WHERE ac.chat_id IS NOT NULL
            GROUP BY ac.chat_id
        ),
        grade_feedbacks AS (
            SELECT 
                ac.grade_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'standard', st.name,
                            'points', scf.total,
                            'feedback', scf.feedback
                        )
                    ),
                    '[]'::jsonb
                ) as feedback
            FROM attempt_chats ac
            LEFT JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = ac.grade_id
            LEFT JOIN standards st ON st.id = scf.standard_id
            WHERE ac.grade_id IS NOT NULL
            GROUP BY ac.grade_id
        )
        SELECT 
            pi.id,
            pi.first_name,
            pi.last_name,
            pi.alias,
            pi.role,
            pi.created_at,
            COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'simulation_id', ac.simulation_id::text,
                        'title', ac.simulation_title,
                        'scenario', CASE 
                            WHEN ac.scenario_id IS NOT NULL THEN 
                                jsonb_build_object(
                                    'id', ac.scenario_id::text,
                                    'name', ac.scenario_name,
                                    'description', ac.scenario_description
                                )
                            ELSE '{}'::jsonb
                        END,
                        'chat', CASE 
                            WHEN ac.chat_id IS NOT NULL THEN
                                jsonb_build_object(
                                    'id', ac.chat_id::text,
                                    'title', ac.chat_title,
                                    'completed', ac.chat_completed,
                                    'messages', COALESCE(cm.messages, '[]'::jsonb),
                                    'grade', CASE 
                                        WHEN ac.grade_id IS NOT NULL THEN
                                            jsonb_build_object(
                                                'score', ac.score,
                                                'passed', ac.passed,
                                                'time_taken', ac.time_taken,
                                                'created_at', ac.grade_created_at
                                            )
                                        ELSE '{}'::jsonb
                                    END,
                                    'feedback', COALESCE(gf.feedback, '[]'::jsonb)
                                )
                            ELSE '{}'::jsonb
                        END
                    ) ORDER BY ac.attempt_created_at, ac.chat_created_at
                )
                FROM attempt_chats ac
                LEFT JOIN chat_messages cm ON cm.chat_id = ac.chat_id
                LEFT JOIN grade_feedbacks gf ON gf.grade_id = ac.grade_id
                WHERE ac.chat_id IS NOT NULL),
                '[]'::jsonb
            ) as attempts
        FROM profile_info pi
        """
        return (query, [profile_id, recent])

    def get_profile_overview_complete(
        self, profile_id_or_name: str, limit: int = 5
    ) -> tuple[str, list[Any]]:
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

    def get_profile_context_complete(
        self, actual_profile_id: str, effective_profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get complete profile context in ONE query.

        Fetches BOTH actual and effective profiles, plus departments, cohorts, 
        simulations, simulatable profiles, and earliest attempt date using CTEs 
        and JSON aggregation.
        
        The query uses effective_profile_id for role-based filtering and context data,
        and returns both profiles to avoid a second query.

        Args:
            actual_profile_id: UUID of the logged-in user's profile
            effective_profile_id: UUID of the profile being viewed (could be same or emulated)

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH effective_profile_role AS (
            -- Use effective profile's role for permissions filtering
            SELECT role FROM profiles WHERE id = $2
        ),
        actual_profile_data AS (
            -- Fetch the logged-in user's profile
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
                COALESCE(prl.requests_per_day, 0) as req_per_day,
                p.last_login,
                p.last_active,
                p.created_at,
                p.updated_at,
                pd.department_id as primary_department_id
            FROM profiles p
            LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            WHERE p.id = $1
        ),
        effective_profile_data AS (
            -- Fetch the profile being viewed (could be same as actual or emulated)
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
                COALESCE(prl.requests_per_day, 0) as req_per_day,
                p.last_login,
                p.last_active,
                p.created_at,
                p.updated_at,
                pd.department_id as primary_department_id
            FROM profiles p
            LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            WHERE p.id = $2
        ),
        dept_data AS (
            -- Departments for the effective profile
            SELECT 
                d.id,
                d.title,
                d.description,
                d.active,
                pd.is_primary
            FROM profile_departments pd
            JOIN departments d ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND pd.active = true
        ),
        cohort_data AS (
            -- Cohorts for the effective profile
            SELECT DISTINCT
                c.id,
                c.title,
                c.description,
                c.active,
                c.department_id
            FROM cohorts c
            JOIN cohort_profiles pc ON pc.cohort_id = c.id
            WHERE pc.profile_id = $2 
              AND pc.active = true
              AND c.active = true
        ),
        sim_data AS (
            -- Simulations for the effective profile's cohorts
            SELECT DISTINCT
                s.id,
                s.title,
                s.description,
                s.department_id,
                COALESCE(stl.time_limit_seconds, 0) as time_limit,
                s.active,
                s.default_simulation,
                s.practice_simulation
            FROM simulations s
            JOIN cohort_simulations cs ON cs.simulation_id = s.id
            JOIN cohort_data cd ON cd.id = cs.cohort_id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE s.active = true
        ),
        simulatable_data AS (
            -- Profiles that the actual user can emulate (based on actual user's role)
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
                COALESCE(prl.requests_per_day, 0) as req_per_day,
                p.last_login,
                p.last_active,
                p.created_at,
                p.updated_at,
                pd.department_id as primary_department_id
            FROM profiles p
            CROSS JOIN effective_profile_role pr
            LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            WHERE p.id != $1  -- Don't include actual user in emulation list
              AND CASE 
                WHEN pr.role = 'superadmin' THEN true
                WHEN pr.role = 'admin' THEN p.role IN ('instructional', 'ta', 'guest')
                WHEN pr.role = 'instructional' THEN p.role IN ('ta', 'guest')
                ELSE false
              END
        ),
        earliest_attempt AS (
            -- Earliest attempt for the effective profile
            SELECT MIN(sa.created_at) as earliest
            FROM simulation_attempts sa
            JOIN attempt_profiles ap ON ap.attempt_id = sa.id
            WHERE ap.profile_id = $2
        )
        SELECT 
            -- Actual profile fields (prefixed with actual_)
            apd.id as actual_id,
            apd.first_name as actual_first_name,
            apd.last_name as actual_last_name,
            apd.alias as actual_alias,
            apd.role as actual_role,
            apd.active as actual_active,
            apd.viewed_intro as actual_viewed_intro,
            apd.viewed_chat as actual_viewed_chat,
            apd.default_profile as actual_default_profile,
            apd.req_per_day as actual_req_per_day,
            apd.last_login as actual_last_login,
            apd.last_active as actual_last_active,
            apd.created_at as actual_created_at,
            apd.updated_at as actual_updated_at,
            apd.primary_department_id as actual_primary_department_id,
            -- Effective profile fields (unprefixed for backward compatibility)
            epd.id,
            epd.first_name,
            epd.last_name,
            epd.alias,
            epd.role,
            epd.active,
            epd.viewed_intro,
            epd.viewed_chat,
            epd.default_profile,
            epd.req_per_day,
            epd.last_login,
            epd.last_active,
            epd.created_at,
            epd.updated_at,
            epd.primary_department_id,
            -- Context data (based on effective profile)
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', d.id::text,
                    'title', d.title,
                    'description', d.description,
                    'active', d.active,
                    'is_primary', d.is_primary
                ) ORDER BY d.is_primary DESC, d.title)
                FROM dept_data d),
                '[]'::jsonb
            ) as departments,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', c.id::text,
                    'title', c.title,
                    'description', c.description,
                    'active', c.active,
                    'department_id', c.department_id::text
                ) ORDER BY c.title)
                FROM cohort_data c),
                '[]'::jsonb
            ) as cohorts,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', s.id::text,
                    'title', s.title,
                    'description', s.description,
                    'department_id', s.department_id::text,
                    'time_limit', s.time_limit,
                    'active', s.active,
                    'default_simulation', s.default_simulation,
                    'practice_simulation', s.practice_simulation
                ) ORDER BY s.title)
                FROM sim_data s),
                '[]'::jsonb
            ) as simulations,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', sp.id::text,
                    'first_name', sp.first_name,
                    'last_name', sp.last_name,
                    'alias', sp.alias,
                    'role', sp.role,
                    'active', sp.active,
                    'viewed_intro', sp.viewed_intro,
                    'viewed_chat', sp.viewed_chat,
                    'default_profile', sp.default_profile,
                    'req_per_day', sp.req_per_day,
                    'last_login', sp.last_login,
                    'last_active', sp.last_active,
                    'created_at', sp.created_at,
                    'updated_at', sp.updated_at,
                    'primary_department_id', sp.primary_department_id::text
                ) ORDER BY sp.first_name, sp.last_name)
                FROM simulatable_data sp),
                '[]'::jsonb
            ) as simulatable_profiles,
            (SELECT earliest FROM earliest_attempt) as earliest_attempt_date
        FROM actual_profile_data apd
        CROSS JOIN effective_profile_data epd
        """
        return (query, [actual_profile_id, effective_profile_id])
