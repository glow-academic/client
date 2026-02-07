"""Types for activity summary view (mv_activity_summary)."""

from datetime import datetime

from pydantic import BaseModel


class ActivitySummaryItem(BaseModel):
    """Global activity summary from mv_activity_summary."""

    total_sessions: int = 0
    active_sessions: int = 0
    total_active_profiles: int = 0
    total_logins: int = 0
    total_content_created: int = 0
    total_drafts: int = 0
    total_problems: int = 0
    unresolved_problems: int = 0

    sessions_last_24h: int = 0
    logins_last_24h: int = 0
    events_last_24h: int = 0

    sessions_last_7d: int = 0
    logins_last_7d: int = 0
    active_profiles_last_7d: int = 0

    refreshed_at: datetime | None = None


class GetActivitySummaryResponse(BaseModel):
    """Response with activity summary."""

    summary: ActivitySummaryItem | None = None
