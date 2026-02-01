"""Permission helpers for unified attempt detail API.

This module contains permission checking logic for the attempt detail endpoint.
"""

from __future__ import annotations

from uuid import UUID


def check_attempt_access(attempt_profile_id: UUID | None, request_profile_id: UUID) -> bool:
    """Check if the requesting user has access to the attempt.

    Args:
        attempt_profile_id: The profile ID associated with the attempt.
        request_profile_id: The profile ID of the requesting user.

    Returns:
        True if the user has access (profile IDs match), False otherwise.
    """
    if attempt_profile_id is None:
        return False
    return attempt_profile_id == request_profile_id
