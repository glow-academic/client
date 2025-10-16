"""Profile repository - thin wrapper around service."""

from typing import Any, Dict, List, Optional, Tuple

import asyncpg # type: ignore
from app.schemas.profile import (ProfileContextRequest, ProfileContextResponse,
                                 ProfileItem, UserProfileItem)
from app.services.profile_service import ProfileService


class ProfileRepository:
    """Repository for profile management."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = ProfileService(conn)

    async def get_profile(self, profile_id: str) -> Optional[ProfileItem]:
        """Get profile by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            ProfileItem if found, None otherwise
        """
        return await self.service.get_profile(profile_id)

    async def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Optional[ProfileItem]:
        """Update profile fields.

        Args:
            profile_id: UUID of the profile
            updates: Dictionary of fields to update

        Returns:
            Updated ProfileItem if successful, None otherwise
        """
        return await self.service.update_profile(profile_id, updates)

    async def get_simulatable_profiles(
        self, profile_id: str, department_ids: List[str]
    ) -> List[ProfileItem]:
        """Get profiles that the requester can emulate.

        Args:
            profile_id: UUID of the requester
            department_ids: List of department IDs (for future filtering)

        Returns:
            List of ProfileItem that can be emulated
        """
        return await self.service.get_simulatable_profiles(profile_id, department_ids)

    async def authorize_emulation(
        self,
        requester_profile_id: str,
        target_profile_id: str,
        department_ids: List[str],
    ) -> Tuple[bool, Optional[str]]:
        """Check if emulation is authorized.

        Args:
            requester_profile_id: UUID of the requester
            target_profile_id: UUID of the target profile to emulate
            department_ids: List of department IDs (for future filtering)

        Returns:
            Tuple of (allowed, reason)
        """
        return await self.service.authorize_emulation(
            requester_profile_id, target_profile_id, department_ids
        )

    async def get_profile_context(
        self, request: ProfileContextRequest
    ) -> ProfileContextResponse:
        """Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

        Args:
            request: ProfileContextRequest with userId, effectiveProfileId, pathname

        Returns:
            ProfileContextResponse with all consolidated data
        """
        return await self.service.get_profile_context(request)

    async def mark_intro_complete(self, profile_id: str) -> bool:
        """Mark viewedIntro as complete.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        return await self.service.mark_intro_complete(profile_id)

    async def mark_chat_complete(self, profile_id: str) -> bool:
        """Mark viewedChat as complete.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        return await self.service.mark_chat_complete(profile_id)

    async def get_profile_by_alias(self, alias: str) -> Optional[ProfileItem]:
        """Get profile by alias.

        Args:
            alias: Profile alias (e.g., 'jdoe')

        Returns:
            ProfileItem if found, None otherwise
        """
        return await self.service.get_profile_by_alias(alias)

    async def list_user_profiles_by_user(self, user_id: int) -> List[UserProfileItem]:
        """List user_profiles by user ID.

        Args:
            user_id: Integer user ID

        Returns:
            List of UserProfileItem
        """
        return await self.service.list_user_profiles_by_user(user_id)

    async def list_user_profiles_by_profile(
        self, profile_id: str
    ) -> List[UserProfileItem]:
        """List user_profiles by profile ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            List of UserProfileItem
        """
        return await self.service.list_user_profiles_by_profile(profile_id)

    async def create_user_profile(
        self, user_id: int, profile_id: str, is_primary: bool, active: bool
    ) -> UserProfileItem:
        """Create a user_profile link.

        Args:
            user_id: Integer user ID
            profile_id: UUID of the profile
            is_primary: Whether this is the primary profile for the user
            active: Whether the link is active

        Returns:
            Created UserProfileItem
        """
        return await self.service.create_user_profile(
            user_id, profile_id, is_primary, active
        )


def get_profile_repository(conn: asyncpg.Connection) -> ProfileRepository:
    """Get profile repository instance."""
    return ProfileRepository(conn)
