"""Auth repository - thin wrapper around service."""

from typing import Any, Dict, List, Optional, Tuple

from app.schemas.auth import (ProfileContextRequest, ProfileContextResponse,
                              ProfileItem)
from app.services.auth_service import AuthService
from sqlalchemy.orm import Session


class AuthRepository:
    """Repository for authentication and profile management."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.service = AuthService(db)

    def get_profile(self, profile_id: str) -> Optional[ProfileItem]:
        """Get profile by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            ProfileItem if found, None otherwise
        """
        return self.service.get_profile(profile_id)

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
        return self.service.update_profile(profile_id, updates)

    def get_simulatable_profiles(
        self, profile_id: str, department_ids: List[str]
    ) -> List[ProfileItem]:
        """Get profiles that the requester can emulate.

        Args:
            profile_id: UUID of the requester
            department_ids: List of department IDs (for future filtering)

        Returns:
            List of ProfileItem that can be emulated
        """
        return self.service.get_simulatable_profiles(profile_id, department_ids)

    def authorize_emulation(
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
        return self.service.authorize_emulation(
            requester_profile_id, target_profile_id, department_ids
        )

    def get_profile_context(
        self, request: ProfileContextRequest
    ) -> ProfileContextResponse:
        """Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

        Args:
            request: ProfileContextRequest with userId, effectiveProfileId, pathname

        Returns:
            ProfileContextResponse with all consolidated data
        """
        return self.service.get_profile_context(request)

    def mark_intro_complete(self, profile_id: str) -> bool:
        """Mark viewedIntro as complete.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        return self.service.mark_intro_complete(profile_id)

    def mark_chat_complete(self, profile_id: str) -> bool:
        """Mark viewedChat as complete.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        return self.service.mark_chat_complete(profile_id)
