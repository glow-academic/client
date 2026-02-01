"""Permission helpers for unified attempt detail API.

This module contains permission checking logic for the attempt detail endpoint.
Business logic for computing display values and derived fields is centralized here.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from app.api.v4.artifacts.attempt.types import ChatData

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


# =============================================================================
# Derived Field Computation (from chats)
# =============================================================================


def compute_chat_position_and_current(chats: list["ChatData"]) -> None:
    """Compute position and is_current for each chat in-place.

    Position is the 0-based index in the list (ordered by created_at).
    is_current is True for the first incomplete chat, or the last chat if all complete.

    Args:
        chats: List of ChatData objects (mutated in-place)
    """
    current_found = False
    for i, chat in enumerate(chats):
        chat.position = i
        chat.is_current = False

    # Find first incomplete chat
    for chat in chats:
        if not chat.completed:
            chat.is_current = True
            current_found = True
            break

    # If all complete, mark last chat as current
    if not current_found and chats:
        chats[-1].is_current = True


def compute_attempt_aggregates(chats: list["ChatData"]) -> dict:
    """Compute attempt-level aggregates from chats.

    Args:
        chats: List of ChatData objects

    Returns:
        Dict with: total_chats, completed_chats, total_score, all_passed, elapsed_seconds
    """
    total_chats = len(chats)
    completed_chats = sum(1 for c in chats if c.completed)

    # Sum scores from completed chats with grades
    total_score = 0.0
    all_passed = True
    elapsed_seconds = 0

    for chat in chats:
        if chat.grade:
            if chat.grade.score is not None:
                total_score += chat.grade.score
            if chat.grade.passed is False:
                all_passed = False
            if chat.grade.time_taken is not None:
                elapsed_seconds += chat.grade.time_taken

    # If no chats or no completed chats, all_passed is False
    if total_chats == 0 or completed_chats == 0:
        all_passed = False

    return {
        "total_chats": total_chats,
        "completed_chats": completed_chats,
        "total_score": total_score,
        "all_passed": all_passed,
        "elapsed_seconds": elapsed_seconds,
    }


def compute_total_possible_points(chats: list["ChatData"]) -> float:
    """Compute total possible points from completed chats' rubric total_points.

    Args:
        chats: List of ChatData objects

    Returns:
        Sum of rubric total_points for completed chats
    """
    total = 0.0
    for chat in chats:
        if chat.completed and chat.rubric and chat.rubric.total_points:
            total += chat.rubric.total_points
    return total


def compute_percentage(total_score: float, total_possible: float) -> float:
    """Compute percentage score.

    Args:
        total_score: Total score achieved
        total_possible: Total possible points

    Returns:
        Percentage (0-100), or 0.0 if total_possible is 0
    """
    if total_possible > 0:
        return round((total_score / total_possible) * 100, 2)
    return 0.0


def compute_current_chat_index(chats: list["ChatData"]) -> int:
    """Compute the current chat index (first incomplete, or last if all complete).

    Args:
        chats: List of ChatData objects

    Returns:
        Index of current chat
    """
    for i, chat in enumerate(chats):
        if not chat.completed:
            return i
    return len(chats) - 1 if chats else 0


def compute_total_time_limit(chats: list["ChatData"]) -> int:
    """Compute total time limit from all chats' time_limit_seconds.

    Args:
        chats: List of ChatData objects (must have time_limit_seconds from view)

    Returns:
        Sum of time_limit_seconds for all chats (0 if no limit)
    """
    # Note: time_limit_seconds comes from ChatViewItem, not ChatData
    # This is called with the raw view items before transformation
    return 0  # Placeholder - actual sum done in get.py before transformation


def compute_achieved_standards(
    feedbacks: list[dict],
) -> list[dict]:
    """Derive achieved standards from feedbacks.

    A standard is "achieved" if it has feedback (i.e., was evaluated).

    Args:
        feedbacks: List of feedback dicts with 'standard_id' key

    Returns:
        List of dicts with 'standard_id' and 'achieved' keys
    """
    achieved = []
    for fb in feedbacks:
        standard_id = fb.get("standard_id")
        if standard_id:
            achieved.append({
                "standard_id": standard_id,
                "achieved": True,
            })
    return achieved


def compute_passed_standards(
    feedbacks: list[dict],
    standard_groups_meta: dict[UUID, dict],
    standards_meta: dict[UUID, dict],
) -> list[dict]:
    """Derive passed standards from feedbacks and standard_group pass_points.

    A standard is "passed" if its feedback total >= the standard_group's pass_points.

    Args:
        feedbacks: List of feedback dicts with 'standard_id' and 'total' keys
        standard_groups_meta: Dict mapping standard_group_id to metadata with 'pass_points'
        standards_meta: Dict mapping standard_id to metadata with 'standard_group_id'

    Returns:
        List of dicts with 'standard_id' and 'passed' keys
    """
    passed = []
    for fb in feedbacks:
        standard_id = fb.get("standard_id")
        total = fb.get("total") or 0.0

        if standard_id:
            # Look up standard_group_id from standards metadata
            std_meta = standards_meta.get(standard_id, {})
            sg_id = std_meta.get("standard_group_id")

            # Look up pass_points from standard_groups metadata
            pass_points = 0.0
            if sg_id:
                sg_meta = standard_groups_meta.get(sg_id, {})
                pass_points = sg_meta.get("pass_points") or 0.0

            passed.append({
                "standard_id": standard_id,
                "passed": total >= pass_points,
            })
    return passed
