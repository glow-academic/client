import uuid
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Tuple

from app.db import get_session
from app.models import ModelRuns, Profiles
from fastapi import Depends
from sqlmodel import Session, select


def check_rate_limit(profile_id: uuid.UUID | None, session: Session = Depends(get_session)) -> Tuple[bool, str | None]:
    """
    Checks if the profile has exceeded their daily request limit.
    Returns (True, None) if under the limit, or (False, error_message) if exceeded.
    If req_per_day is None, unlimited requests are allowed.
    """
    if not profile_id:
        return False, "Profile not found. Please contact support."

    profile = session.exec(select(Profiles).where(Profiles.id == profile_id)).one_or_none()
    if not profile:
        return False, "Profile not found."

    req_per_day = getattr(profile, "req_per_day", None)
    if req_per_day is None:
        # Unlimited requests allowed
        return True, None

    # Calculate the start of the current day in UTC
    now_utc = datetime.now(timezone.utc)
    start_of_day_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

    # Count model runs for this profile since the start of the day via model_run_profiles junction
    from app.models import ModelRunProfiles
    profile_run_links = session.exec(
        select(ModelRunProfiles).where(
            ModelRunProfiles.profile_id == profile_id,
            ModelRunProfiles.active == True
        )
    ).all()
    
    run_ids = [link.model_run_id for link in profile_run_links]
    if run_ids:
        model_runs_today = session.exec(
            select(ModelRuns)
            .where(
                (ModelRuns.id.in_(run_ids)) &
                (ModelRuns.created_at >= start_of_day_utc)
            )
        ).all()
    else:
        model_runs_today = []

    if len(model_runs_today) >= req_per_day:
        # Find the earliest run today to determine when the next request is allowed
        earliest_run = min(model_runs_today, key=lambda run: run.created_at)
        # Next available time is 24h after the earliest run today
        next_allowed_utc = earliest_run.created_at + timedelta(days=1)
        # Convert to US/Eastern for user-friendly display using zoneinfo (Python 3.9+)
        eastern_tz: tzinfo
        try:
            from zoneinfo import ZoneInfo
            eastern_tz = ZoneInfo("America/New_York")
        except ImportError:
            # Fallback for Python <3.9: use UTC and indicate as such
            eastern_tz = timezone.utc

        next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
        # Use %-I for Linux, but on Windows use %#I. We'll use %-I and fallback if ValueError.
        try:
            formatted_time = next_allowed_et.strftime("%-I:%M %p ET").replace("AM", "am").replace("PM", "pm")
        except ValueError:
            formatted_time = next_allowed_et.strftime("%#I:%M %p ET").replace("AM", "am").replace("PM", "pm")
        return (
            False,
            f"You've reached your daily request limit. You can make your next request after {formatted_time}."
        )

    return True, None