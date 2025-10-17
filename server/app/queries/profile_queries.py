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
