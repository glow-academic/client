"""Profile queries - SQL query builders for profile and emulation operations."""

from typing import Any, Dict, List, Tuple


class ProfileQueries:
    """Query builders for profile operations."""

    def get_profile(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
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
        WHERE id = :profile_id
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to update profile fields."""
        # Build SET clause dynamically from updates
        set_clauses = []
        params: Dict[str, Any] = {"profile_id": profile_id}

        for key, value in updates.items():
            set_clauses.append(f"{key} = :{key}")
            params[key] = value

        # Always update updated_at
        set_clauses.append("updated_at = NOW()")

        query = f"""
        UPDATE profiles SET
            {', '.join(set_clauses)}
        WHERE id = :profile_id
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
    ) -> Tuple[str, Dict[str, Any]]:
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
        WHERE id != :profile_id
        ORDER BY first_name, last_name
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_simulatable_profiles_admin(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
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
        WHERE id != :profile_id
          AND role IN ('instructional', 'ta', 'guest')
        ORDER BY first_name, last_name
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_simulatable_profiles_instructional(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
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
        WHERE id != :profile_id
          AND role IN ('ta', 'guest')
        ORDER BY first_name, last_name
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_profile_role(self, profile_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get profile role."""
        query = """
        SELECT role
        FROM profiles
        WHERE id = :profile_id
        """
        params = {"profile_id": profile_id}
        return (query, params)

