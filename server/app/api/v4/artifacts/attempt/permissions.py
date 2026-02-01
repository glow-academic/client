"""Permission helpers for unified attempt detail API.

This module contains permission checking logic for the attempt detail endpoint.
Business logic for computing display values is also here (following persona pattern).
"""

from __future__ import annotations

from uuid import UUID

# Default styling for user messages
DEFAULT_USER_COLOR = "#6366f1"  # Indigo
DEFAULT_USER_ICON = "User"
DEFAULT_ASSISTANT_COLOR = "#06b6d4"  # Cyan
DEFAULT_ASSISTANT_ICON = "Bot"


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


def compute_content_display(
    message_type: str | None,
    profile_name: str | None,
    persona_name: str | None,
    persona_color: str | None,
    persona_icon: str | None,
    is_own_attempt: bool = False,
) -> tuple[str | None, str, str]:
    """Compute display name, color, and icon for a content item.

    Business logic:
    - For 'query' (user) messages:
      - If viewing own attempt: show "You"
      - Otherwise: show profile_name
    - For 'response' (assistant) messages: use persona name/color/icon

    Args:
        message_type: 'query' or 'response'
        profile_name: The actor/user's name
        persona_name: The persona's name (for responses)
        persona_color: The persona's color (for responses)
        persona_icon: The persona's icon (for responses)
        is_own_attempt: True if the requesting user owns this attempt

    Returns:
        Tuple of (name, color, icon)
    """
    if message_type == "query":
        # Show "You" if viewing own attempt, otherwise show the profile name
        display_name = "You" if is_own_attempt else profile_name
        return (
            display_name,
            DEFAULT_USER_COLOR,
            DEFAULT_USER_ICON,
        )
    else:
        # Response message - use persona info
        return (
            persona_name,
            persona_color or DEFAULT_ASSISTANT_COLOR,
            persona_icon or DEFAULT_ASSISTANT_ICON,
        )
