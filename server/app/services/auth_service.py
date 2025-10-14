"""Auth service layer - business logic for profile and emulation operations."""

from typing import Any, Dict, List, Optional, Tuple

from app.queries.auth_queries import AuthQueries
from app.schemas.auth import ProfileItem
from sqlalchemy import text
from sqlalchemy.orm import Session


class AuthService:
    """Service layer for auth operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = AuthQueries()

    def get_profile(self, profile_id: str) -> Optional[ProfileItem]:
        """Get profile by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            ProfileItem if found, None otherwise
        """
        query, params = self.queries.get_profile(profile_id)
        result = self.db.execute(text(query), params).fetchone()

        if not result:
            return None

        return self._row_to_profile_item(result)

    def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Optional[ProfileItem]:
        """Update profile fields.

        Args:
            profile_id: UUID of the profile
            updates: Dictionary of fields to update

        Returns:
            Updated ProfileItem if successful, None otherwise
        """
        if not updates:
            # No updates, just return the current profile
            return self.get_profile(profile_id)

        query, params = self.queries.update_profile(profile_id, updates)
        result = self.db.execute(text(query), params).fetchone()
        self.db.commit()

        if not result:
            return None

        return self._row_to_profile_item(result)

    def get_simulatable_profiles(
        self, profile_id: str, department_ids: List[str]
    ) -> List[ProfileItem]:
        """Get profiles that the requester can emulate.

        Role hierarchy for emulation:
        - superadmin: can emulate all profiles except self
        - admin: can emulate instructional/ta/guest (not superadmin/admin)
        - instructional: can emulate ta/guest (not superadmin/admin/instructional)
        - ta/guest: cannot emulate anyone

        Args:
            profile_id: UUID of the requester
            department_ids: List of department IDs (for future filtering)

        Returns:
            List of ProfileItem that can be emulated
        """
        # Get requester's role
        role_query, role_params = self.queries.get_profile_role(profile_id)
        role_result = self.db.execute(text(role_query), role_params).fetchone()

        if not role_result:
            return []

        requester_role = role_result.role

        # Get simulatable profiles based on role
        if requester_role == "superadmin":
            query, params = self.queries.get_simulatable_profiles_superadmin(profile_id)
        elif requester_role == "admin":
            query, params = self.queries.get_simulatable_profiles_admin(profile_id)
        elif requester_role == "instructional":
            query, params = self.queries.get_simulatable_profiles_instructional(
                profile_id
            )
        else:
            # ta and guest cannot emulate anyone
            return []

        result = self.db.execute(text(query), params).fetchall()

        return [self._row_to_profile_item(row) for row in result]

    def authorize_emulation(
        self, requester_profile_id: str, target_profile_id: str, department_ids: List[str]
    ) -> Tuple[bool, Optional[str]]:
        """Check if emulation is authorized.

        Args:
            requester_profile_id: UUID of the requester
            target_profile_id: UUID of the target profile to emulate
            department_ids: List of department IDs (for future filtering)

        Returns:
            Tuple of (allowed, reason)
        """
        # Check if trying to emulate self
        if requester_profile_id == target_profile_id:
            return (True, None)  # Emulating self is always allowed

        # Get requester profile
        requester_query, requester_params = self.queries.get_profile(
            requester_profile_id
        )
        requester_result = self.db.execute(
            text(requester_query), requester_params
        ).fetchone()

        if not requester_result:
            return (False, "Requester profile not found")

        # Get target profile
        target_query, target_params = self.queries.get_profile(target_profile_id)
        target_result = self.db.execute(text(target_query), target_params).fetchone()

        if not target_result:
            return (False, "Target profile not found")

        requester_role = requester_result.role
        target_role = target_result.role

        # Apply role hierarchy rules
        if requester_role == "superadmin":
            return (True, None)

        if requester_role == "admin":
            if target_role in ["instructional", "ta", "guest"]:
                return (True, None)
            return (False, f"Admins cannot emulate {target_role} profiles")

        if requester_role == "instructional":
            if target_role in ["ta", "guest"]:
                return (True, None)
            return (
                False,
                f"Instructional staff cannot emulate {target_role} profiles",
            )

        # ta and guest cannot emulate anyone
        return (False, f"{requester_role.capitalize()}s cannot emulate other profiles")

    def _row_to_profile_item(self, row: Any) -> ProfileItem:
        """Convert database row to ProfileItem schema.

        Args:
            row: Database row result

        Returns:
            ProfileItem schema
        """
        return ProfileItem(
            id=str(row.id),
            firstName=row.first_name,
            lastName=row.last_name,
            alias=row.alias,
            role=row.role,
            active=row.active,
            viewedIntro=row.viewed_intro,
            viewedChat=row.viewed_chat,
            defaultProfile=row.default_profile,
            reqPerDay=row.req_per_day,
            lastLogin=row.last_login.isoformat() if row.last_login else "",
            lastActive=row.last_active.isoformat() if row.last_active else None,
            createdAt=row.created_at.isoformat() if row.created_at else "",
            updatedAt=row.updated_at.isoformat() if row.updated_at else "",
        )

