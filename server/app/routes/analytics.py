import logging
import re
from typing import Any, Dict, List, Optional

from app.db import get_session
from app.utils.analytics import AnalyticsFilters, fetch_analytics_base
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

@router.post("/reports")
async def post_analytics_reports(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """Compute per-profile report rows (full header metrics) server-side."""
    base = fetch_analytics_base(session, filters)

    profiles: List[Dict[str, Any]] = base.get("profiles", [])
    attempts: List[Dict[str, Any]] = base.get("attempts", [])
    chats: List[Dict[str, Any]] = base.get("chats", [])
    grades: List[Dict[str, Any]] = base.get("grades", [])
    messages: List[Dict[str, Any]] = base.get("messages", [])
    rubrics: List[Dict[str, Any]] = base.get("rubrics", [])
    scenarios: List[Dict[str, Any]] = base.get("scenarios", [])
    cohorts: List[Dict[str, Any]] = base.get("cohorts", [])

    rubric_by_id = {str(r.get("id")): r for r in rubrics}
    scenario_by_id = {str(s.get("id")): s for s in scenarios}

    # Pre-compute message counts per chat
    messages_by_chat: Dict[str, int] = {}
    # Persona response time requires message roles; base messages may lack type, so we skip detailed RT
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

        # Average and highest normalized score; collect list for stats
        avg_score = 0.0
        highest_score = 0.0
        normalized_scores: List[float] = []
        if user_grades:
            total_score = 0.0
            for g in user_grades:
                rubric = rubric_by_id.get(str(g.get("rubric_id")))
                rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
                score = float(g.get("score", 0))
                norm = (score / max(rubric_points, 1.0)) * 100.0
                total_score += norm
                if norm > highest_score:
                    highest_score = norm
                normalized_scores.append(norm)
            avg_score = total_score / len(user_grades)

        # Time spent (minutes) from completed chats
        time_spent_seconds = 0.0
        last_activity_ts = None
        from datetime import datetime
        for chat in user_chats:
            created_at = chat.get("created_at")
            completed_at = chat.get("completed_at")
            # track last activity from completed or created timestamps
            try:
                ts = completed_at or created_at
                if ts:
                    tsv = datetime.fromisoformat(str(ts).replace("Z", "+00:00")).timestamp()
                    last_activity_ts = max(last_activity_ts, tsv) if last_activity_ts else tsv
            except Exception:
                pass
            if created_at and completed_at:
                try:
                    start = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                    end = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00"))
                    diff = (end - start).total_seconds()
                    time_spent_seconds += max(0.0, diff)
                except Exception:
                    pass
        time_spent_minutes = time_spent_seconds / 60.0

        # Messages per session and counts per chat for stats
        user_messages_counts = [messages_by_chat.get(str(chat.get("id")), 0) for chat in user_chats]
        messages_per_session = (
            sum(user_messages_counts) / len(user_messages_counts) if user_messages_counts else 0.0
        )

        # Completion percentage
        completed_sessions = sum(1 for c in user_chats if bool(c.get("completed")))
        total_sessions = len(user_chats)
        completion_percentage = (completed_sessions / total_sessions * 100.0) if total_sessions > 0 else 0.0

        # First attempt pass rate per simulation
        # For each simulation, find earliest attempt, pass if any grade on chats of that attempt passed
        first_attempt_by_sim: Dict[str, Dict[str, Any]] = {}
        for att in user_attempts:
            sim_id = str(att.get("simulation_id"))
            created_at = att.get("created_at")
            prev = first_attempt_by_sim.get(sim_id)
            if prev is None or str(created_at) < str(prev.get("created_at")):
                first_attempt_by_sim[sim_id] = att
        first_attempt_passes = 0
        for sim_id, att in first_attempt_by_sim.items():
            att_id = str(att.get("id"))
            att_chats = [c for c in user_chats if str(c.get("attempt_id")) == att_id]
            att_chat_ids = {str(c.get("id")) for c in att_chats}
            att_grades = [g for g in user_grades if str(g.get("simulation_chat_id")) in att_chat_ids]
            if any(bool(g.get("passed")) for g in att_grades):
                first_attempt_passes += 1
        first_attempt_total = len(first_attempt_by_sim)
        first_attempt_pass_rate = (first_attempt_passes / first_attempt_total * 100.0) if first_attempt_total > 0 else 0.0

        # Persona response times (seconds) - base messages lack role; return 0 for now
        persona_response_seconds = 0

        # Session efficiency: score adjusted by time (bounded 0..100)
        avg_minutes = (time_spent_minutes / max(total_sessions, 1)) if total_sessions > 0 else time_spent_minutes
        session_efficiency = max(0.0, min(100.0, avg_score * (1.0 - min(1.0, avg_minutes / 120.0))))

        # Stagnation rate: percent of non-increasing score transitions over time
        sorted_grades = []
        try:
            sorted_grades = sorted(
                user_grades,
                key=lambda g: str(g.get("created_at") or "")
            )
        except Exception:
            sorted_grades = user_grades
        stagnant = 0
        transitions = 0
        prev_norm = None
        for g in sorted_grades:
            rubric = rubric_by_id.get(str(g.get("rubric_id")))
            rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
            norm = (float(g.get("score", 0)) / max(rubric_points, 1.0)) * 100.0
            if prev_norm is not None:
                transitions += 1
                if norm <= prev_norm + 0.1:
                    stagnant += 1
            prev_norm = norm
        stagnation_rate = (stagnant / transitions * 100.0) if transitions > 0 else 0.0

        # --- Hover stats helpers ---
        def compute_median(values: List[float]) -> float:
            n = len(values)
            if n == 0:
                return 0.0
            vs = sorted(values)
            mid = n // 2
            if n % 2 == 1:
                return vs[mid]
            return (vs[mid - 1] + vs[mid]) / 2.0

        def compute_mode(values: List[float]) -> float:
            if not values:
                return 0.0
            from collections import Counter
            cnt = Counter(int(round(v)) for v in values)
            most = cnt.most_common(1)
            return float(most[0][0]) if most else 0.0

        # Score stats (percent scale)
        score_mean = float(avg_score)
        score_median = compute_median(normalized_scores)
        score_mode = compute_mode(normalized_scores)

        # Top scores (top 3 normalized integer percents)
        top_scores = sorted((int(round(v)) for v in normalized_scores), reverse=True)[:3]

        # Time stats (minutes)
        chat_minutes = [
            max(0.0, (
                __import__('datetime').datetime.fromisoformat(str(c.get("completed_at")).replace("Z", "+00:00")) -
                __import__('datetime').datetime.fromisoformat(str(c.get("created_at")).replace("Z", "+00:00"))
            ).total_seconds() / 60.0)
            for c in user_chats
            if c.get("created_at") and c.get("completed_at")
        ]
        avg_chat_minutes = (sum(chat_minutes) / len(chat_minutes)) if chat_minutes else 0.0
        avg_session_minutes = avg_chat_minutes  # sessions ~= chats
        avg_overall_minutes = (time_spent_minutes / max(1, total_sessions)) if total_sessions > 0 else time_spent_minutes

        # Message stats (per chat)
        msg_mean = (sum(user_messages_counts) / len(user_messages_counts)) if user_messages_counts else 0.0
        msg_median = compute_median([float(x) for x in user_messages_counts]) if user_messages_counts else 0.0
        msg_count = len(user_messages_counts)

        # Completion stats
        completion_stats = {
            "completed": completed_sessions,
            "total": total_sessions,
            "percent": int(round(completion_percentage)),
        }

        # First attempt stats
        first_attempt_stats = {
            "passed": first_attempt_passes,
            "total": first_attempt_total,
            "percent": int(round(first_attempt_pass_rate)),
        }

        # Personas/scenarios/simulations worked on
        user_scenario_ids = [str(c.get("scenario_id")) for c in user_chats if c.get("scenario_id")]
        user_persona_ids = []
        for sid in user_scenario_ids:
            persona_id = scenario_by_id.get(sid, {}).get("persona_id") if scenario_by_id.get(sid) else None
            if persona_id:
                user_persona_ids.append(str(persona_id))
        user_simulation_ids = list({str(a.get("simulation_id")) for a in user_attempts})

        # Risk assessment
        thresholds = {
            "averageScore": {"danger": 70, "warning": 80},
            "completionPercentage": {"danger": 70, "warning": 80},
            "firstAttemptPassRate": {"danger": 70, "warning": 80},
            "highestScore": {"danger": 80, "warning": 85},
            "messagesPerSession": {"danger": 5, "warning": 8},
            "personaResponseTimes": {"danger": 10, "warning": 5},
            "sessionEfficiency": {"danger": 70, "warning": 80},
            "stagnationRate": {"danger": 30, "warning": 20},
            "timeSpent": {"danger": 120, "warning": 90},
            "totalAttempts": {"danger": 2, "warning": 5},
        }
        def band(val: float, metric: str, invert: bool = False) -> str:
            if invert:
                # lower is better
                if val > thresholds[metric]["danger"]:
                    return "danger"
                if val > thresholds[metric]["warning"]:
                    return "warning"
                return "good"
            else:
                if val < thresholds[metric]["danger"]:
                    return "danger"
                if val < thresholds[metric]["warning"]:
                    return "warning"
                return "good"
        risk_map = {
            "averageScore": band(avg_score, "averageScore"),
            "completionPercentage": band(completion_percentage, "completionPercentage"),
            "firstAttemptPassRate": band(first_attempt_pass_rate, "firstAttemptPassRate"),
            "highestScore": band(highest_score, "highestScore"),
            "messagesPerSession": band(messages_per_session, "messagesPerSession"),
            "personaResponseTimes": band(persona_response_seconds / 60.0, "personaResponseTimes", invert=True),
            "sessionEfficiency": band(session_efficiency, "sessionEfficiency"),
            "stagnationRate": band(stagnation_rate, "stagnationRate", invert=True),
            "timeSpent": band(time_spent_minutes, "timeSpent", invert=True),
            "totalAttempts": band(float(len(user_attempts)), "totalAttempts"),
        }
        danger_count = sum(1 for v in risk_map.values() if v == "danger")
        warning_count = sum(1 for v in risk_map.values() if v == "warning")
        risk_level = "good"
        if danger_count >= 5:
            risk_level = "danger"
        elif danger_count >= 2 or warning_count >= 4:
            risk_level = "warning"

        rows.append({
            "id": pid,
            "firstName": p.get("first_name"),
            "lastName": p.get("last_name"),
            "username": p.get("alias") or "",
            "averageScore": int(round(avg_score)),
            "completionPercentage": int(round(completion_percentage)),
            "firstAttemptPassRate": int(round(first_attempt_pass_rate)),
            "highestScore": int(round(highest_score)),
            "messagesPerSession": int(round(messages_per_session)),
            "personaResponseTimes": int(round(persona_response_seconds / 60.0)),
            "sessionEfficiency": int(round(session_efficiency)),
            "stagnationRate": int(round(stagnation_rate)),
            "timeSpent": int(round(time_spent_minutes)),
            "totalAttempts": len(user_attempts),
            "riskLevel": risk_level,
            "riskDetails": {
                "dangerCount": danger_count,
                "warningCount": warning_count,
                "goodCount": 10 - danger_count - warning_count,
            },
            # legacy/extra fields
            "completedSessions": completed_sessions,
            "totalSessions": total_sessions,
            "lastActivity": (None if last_activity_ts is None else int(last_activity_ts)),
            "scenariosCompleted": len({sid for sid in user_scenario_ids if sid}),
            "personasTested": list({pid for pid in user_persona_ids}),
            "scenarioIds": list({sid for sid in user_scenario_ids}),
            "simulationIds": user_simulation_ids,
            # hover details fully server-backed
            "hover": {
                "scoreStats": {
                    "mean": int(round(score_mean)),
                    "median": int(round(score_median)),
                    "mode": int(round(score_mode)),
                    "top": top_scores,
                },
                "timeStats": {
                    "avgSessionMinutes": int(round(avg_session_minutes)),
                    "avgChatMinutes": int(round(avg_chat_minutes)),
                    "avgOverallMinutes": int(round(avg_overall_minutes)),
                },
                "messageStats": {
                    "mean": float(f"{msg_mean:.2f}"),
                    "median": float(f"{msg_median:.2f}"),
                    "count": msg_count,
                },
                "completionStats": completion_stats,
                "firstAttemptStats": first_attempt_stats,
                "personaResponseStats": {
                    "meanSeconds": 0,
                    "medianSeconds": 0,
                    "samples": 0,
                },
                "efficiencyStats": {
                    "avgScorePercent": int(round(avg_score)),
                    "avgMinutes": int(round(avg_overall_minutes)),
                    "efficiency": int(round(session_efficiency)),
                },
                "stagnationStats": {
                    "tracked": transitions,
                    "stagnant": stagnant,
                    "ratePercent": int(round(stagnation_rate)),
                },
            },
        })

    return rows