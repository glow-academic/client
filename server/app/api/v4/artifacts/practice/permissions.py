"""Business logic and permissions for practice analytics API.

This module contains business logic that was previously embedded in SQL,
following the two-pass pattern where Python handles mode determination
and score classification while SQL handles data retrieval.

Functions for overview endpoint:
- compute_pass_pct: Calculate pass percentage from rubric points
- compute_status: Determine simulation status (passed/in-progress/not-started)
- format_cohort_names: Format cohort names as "A, B, and C"

Functions for history endpoint:
- compute_score_status: Classify score into high/medium/low
- compute_show_view: Determine if attempt can be viewed
- compute_show_continue: Determine if attempt can be continued
"""

from __future__ import annotations


def compute_mode() -> str:
    """Return the view mode for practice.

    Practice endpoints always return 'practice' mode.

    Returns:
        'practice' - always.
    """
    return "practice"


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


def compute_pass_pct(
    total_points: int | None,
    pass_points: int | None,
) -> int | None:
    """Calculate pass percentage from rubric points.

    Args:
        total_points: Total possible points in the rubric.
        pass_points: Points required to pass.

    Returns:
        Pass percentage (0-100), or None if total_points is 0 or None.
    """
    if not total_points or total_points == 0:
        return None
    if pass_points is None:
        return None
    return round(100.0 * pass_points / total_points)


def compute_status(
    has_passed: bool | None,
    completed_count: int | None,
) -> str:
    """Determine simulation status for practice mode.

    Args:
        has_passed: Whether the user has passed any attempt.
        completed_count: Number of completed attempts/chats.

    Returns:
        'passed' if has_passed is True,
        'in-progress' if has some completed attempts but not passed,
        'not-started' otherwise.
    """
    if has_passed:
        return "passed"
    if completed_count and completed_count > 0:
        return "in-progress"
    return "not-started"


def format_cohort_names(names: list[str] | None) -> str | None:
    """Format cohort names as a natural language list.

    Args:
        names: List of cohort names.

    Returns:
        Formatted string like "A", "A and B", or "A, B, and C".
        None if names is empty or None.
    """
    if not names:
        return None
    names = sorted(set(names))  # Remove duplicates and sort
    if len(names) == 0:
        return None
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f", and {names[-1]}"


# =============================================================================
# History endpoint functions
# =============================================================================


def compute_show_view(is_archived: bool | None) -> bool:
    """Determine if an attempt can be viewed.

    Args:
        is_archived: Whether the attempt is archived.

    Returns:
        True if not archived, False otherwise.
    """
    return not (is_archived or False)


def compute_show_continue(
    is_archived: bool | None,
    infinite_mode: bool | None,
    num_scenarios: int | None,
    num_scenarios_completed: int | None,
    time_limit_seconds: int | None,
    elapsed_seconds: int | None,
    num_incomplete_chats: int | None,
) -> bool:
    """Determine if an attempt can be continued.

    Args:
        is_archived: Whether the attempt is archived.
        infinite_mode: Whether the attempt is in infinite mode.
        num_scenarios: Total scenarios in the simulation.
        num_scenarios_completed: Scenarios completed with grades.
        time_limit_seconds: Time limit for the simulation (None = no limit).
        elapsed_seconds: Time elapsed so far.
        num_incomplete_chats: Number of incomplete chats (for infinite mode).

    Returns:
        True if the attempt can be continued, False otherwise.
    """
    # Can't continue archived attempts
    if is_archived:
        return False

    if infinite_mode:
        # Infinite mode: can continue if time not exceeded and has incomplete chats
        time_ok = time_limit_seconds is None or (
            elapsed_seconds is not None and elapsed_seconds < time_limit_seconds
        )
        has_pending = (num_incomplete_chats or 0) > 0
        return time_ok and has_pending
    else:
        # Fixed mode: can continue if not all scenarios completed
        if num_scenarios is None:
            return False
        completed = num_scenarios_completed or 0
        return completed < num_scenarios
