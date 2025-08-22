import logging
import re
from typing import Any, Dict, List, Optional

from app.db import get_session
from app.utils.analytics import (AnalyticsFilters,
                                 fetch_analytics_base)
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/")
async def post_analytics(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Return the base analytics payload (attempts/chats/grades/messages/etc)."""
    try:
        data = fetch_analytics_base(session, filters)
        logger.info("analytics.base.success")
        return data
    except Exception as e:
        logger.exception("analytics.base.failed")
        raise e


@router.post("/leaderboard")
async def post_analytics_leaderboard(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """Compute leaderboard on the server using the base payload and return JSON rows."""
    base = fetch_analytics_base(session, filters)

    profiles: List[Dict[str, Any]] = base.get("profiles", [])
    attempts: List[Dict[str, Any]] = base.get("attempts", [])
    chats: List[Dict[str, Any]] = base.get("chats", [])
    grades: List[Dict[str, Any]] = base.get("grades", [])
    messages: List[Dict[str, Any]] = base.get("messages", [])
    rubrics: List[Dict[str, Any]] = base.get("rubrics", [])

    rubric_by_id = {str(r.get("id")): r for r in rubrics}

    chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
    for c in chats:
        arr = chats_by_attempt.setdefault(str(c.get("attempt_id")), [])
        arr.append(c)

    grades_by_chat: Dict[str, List[Dict[str, Any]]] = {}
    for g in grades:
        arr = grades_by_chat.setdefault(str(g.get("simulation_chat_id")), [])
        arr.append(g)

    messages_by_chat: Dict[str, int] = {}
    for m in messages:
        chat_id = str(m.get("chat_id"))
        messages_by_chat[chat_id] = messages_by_chat.get(chat_id, 0) + 1

    rows: List[Dict[str, Any]] = []
    for p in profiles:
        pid = str(p.get("id"))
        user_attempts = [a for a in attempts if str(a.get("profile_id")) == pid]
        user_attempt_ids = {str(a.get("id")) for a in user_attempts}
        user_chats = [c for c in chats if str(c.get("attempt_id")) in user_attempt_ids]
        user_chat_ids = {str(c.get("id")) for c in user_chats}
        user_grades = [g for g in grades if str(g.get("simulation_chat_id")) in user_chat_ids]

        # Avg normalized score
        avg_score = 0.0
        if user_grades:
            total_score = 0.0
            for g in user_grades:
                rubric = rubric_by_id.get(str(g.get("rubric_id")))
                rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
                score = float(g.get("score", 0))
                total_score += (score / max(rubric_points, 1.0)) * 100.0
            avg_score = total_score / len(user_grades)

        # Time spent minutes from chat timestamps
        time_spent_seconds = 0.0
        for chat in user_chats:
            created_at = chat.get("created_at")
            completed_at = chat.get("completed_at")
            if created_at and completed_at:
                try:
                    from datetime import datetime
                    start = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                    end = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00"))
                    diff = (end - start).total_seconds()
                    time_spent_seconds += max(0.0, diff)
                except Exception:
                    pass
        time_spent_minutes = time_spent_seconds / 60.0

        # Messages per session
        user_messages_counts = [messages_by_chat.get(str(chat.get("id")), 0) for chat in user_chats]
        messages_per_session = (
            sum(user_messages_counts) / len(user_messages_counts) if user_messages_counts else 0.0
        )

        # Quickest pass (minutes)
        quickest_pass_minutes = 0
        passed = [g for g in user_grades if bool(g.get("passed")) and float(g.get("time_taken", 0)) > 0]
        if passed:
            min_seconds = min(float(g.get("time_taken", 0)) for g in passed)
            quickest_pass_minutes = int(round(min_seconds / 60.0))

        # Improvement metrics per simulation
        attempts_by_sim: Dict[str, List[Dict[str, Any]]] = {}
        for grade in user_grades:
            # find chat and attempt
            chat_obj: Dict[str, Any] = next(
                (c for c in user_chats if str(c.get("id")) == str(grade.get("simulation_chat_id"))),
                {},
            )
            if not chat_obj:
                continue
            attempt: Dict[str, Any] = next(
                (a for a in user_attempts if str(a.get("id")) == str(chat_obj.get("attempt_id"))),
                {},
            )
            if not attempt:
                continue
            sim_id = str(attempt.get("simulation_id"))
            rubric = rubric_by_id.get(str(grade.get("rubric_id")))
            rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
            pct = (float(grade.get("score", 0)) / max(rubric_points, 1.0)) * 100.0
            arr = attempts_by_sim.setdefault(sim_id, [])
            arr.append({
                "createdAt": str(attempt.get("created_at")),
                "percent": pct,
            })

        most_improved_percent = 0.0
        improvement_rate_per_day = 0.0
        from datetime import datetime
        for entries in attempts_by_sim.values():
            if len(entries) < 2:
                continue
            try:
                sorted_entries = sorted(
                    entries,
                    key=lambda e: datetime.fromisoformat(str(e["createdAt"]).replace("Z", "+00:00")),
                )
                first = sorted_entries[0]
                last = sorted_entries[-1]
                improvement = float(last["percent"]) - float(first["percent"])
                if improvement > most_improved_percent:
                    most_improved_percent = improvement
                days = max(
                    1.0,
                    (
                        datetime.fromisoformat(str(last["createdAt"]).replace("Z", "+00:00"))
                        - datetime.fromisoformat(str(first["createdAt"]).replace("Z", "+00:00"))
                    ).total_seconds() / (60.0 * 60.0 * 24.0),
                )
                rate = improvement / days
                if rate > improvement_rate_per_day:
                    improvement_rate_per_day = rate
            except Exception:
                continue

        total_attempts = len(user_attempts)

        rows.append({
            "profile_id": pid,
            "first_name": p.get("first_name"),
            "last_name": p.get("last_name"),
            "total_attempts": total_attempts,
            "highest_score_avg": int(round(avg_score)),
            "messages_per_session": int(round(messages_per_session)),
            "time_spent_minutes": int(round(time_spent_minutes)),
            "quickest_pass_minutes": quickest_pass_minutes,
            "most_improved_percent": int(round(most_improved_percent)),
            "improvement_rate_per_day": int(round(improvement_rate_per_day)),
            "perfect_score_count": 0,
        })

    return rows

@router.post("/report")
async def post_analytics_report(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Return the base analytics payload (attempts/chats/grades/messages/etc)."""
    try:
        data = fetch_analytics_base(session, filters)
        logger.info("analytics.base.success")
        return data
    except Exception as e:
        logger.exception("analytics.base.failed")
        raise e