"""Business logic and permissions for NEW home analytics API.

This module contains business logic that was previously embedded in SQL,
following the two-pass pattern where Python handles mode determination
and score classification while SQL handles data retrieval.
"""

from __future__ import annotations


def compute_mode(user_role: str | None) -> str:
    """Determine view mode from user role.

    Args:
        user_role: The user's role from profiles_resource (e.g., 'member',
            'instructional', 'admin', 'superadmin').

    Returns:
        'instructional' for instructional/admin/superadmin roles,
        'member' for all others (including None).
    """
    if user_role in ("instructional", "admin", "superadmin"):
        return "instructional"
    return "member"


def compute_score_status(
    score_percent: float | None,
    pass_threshold: float | None = 70.0,
) -> str | None:
    """Classify score into high/medium/low status.

    Args:
        score_percent: The score as a percentage (0-100), or None if not scored.
        pass_threshold: The passing threshold (default 70). Scores at or above
            this are 'high'. This comes from the context query.

    Returns:
        'high' if score >= pass_threshold,
        'medium' if score >= 40,
        'low' if score < 40,
        None if score_percent is None.
    """
    if score_percent is None:
        return None
    threshold = pass_threshold if pass_threshold is not None else 70.0
    if score_percent >= threshold:
        return "high"
    if score_percent >= 40:
        return "medium"
    return "low"
