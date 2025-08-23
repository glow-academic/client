import logging
import re
from typing import Any, Dict, List, Optional

from app.db import get_session
from app.utils.analytics import AnalyticsFilters, fetch_analytics_base
from app.utils import dashboard as dashboard_utils
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlmodel import Session
from types import SimpleNamespace

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

@router.post("/history")
async def post_analytics_history(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Return the minimal data needed for the history page.
    """
    base = fetch_analytics_base(session, filters)

    attempts = base.get("attempts", []) or []
    chats = base.get("chats", []) or []
    grades = base.get("grades", []) or []
    simulations = base.get("simulations", []) or []
    scenarios = base.get("scenarios", []) or []
    profiles = base.get("profiles", []) or []
    rubrics = base.get("rubrics", []) or []

    # Index helpers
    sims_by_id: Dict[str, Dict[str, Any]] = {str(s.get("id")): s for s in simulations}
    scen_by_id: Dict[str, Dict[str, Any]] = {str(s.get("id")): s for s in scenarios}
    prof_by_id: Dict[str, Dict[str, Any]] = {str(p.get("id")): p for p in profiles}
    rubric_by_id: Dict[str, Dict[str, Any]] = {str(r.get("id")): r for r in rubrics}

    chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
    for c in chats:
        arr = chats_by_attempt.setdefault(str(c.get("attempt_id")), [])
        arr.append(c)

    grades_by_chat: Dict[str, List[Dict[str, Any]]] = {}
    for g in grades:
        arr = grades_by_chat.setdefault(str(g.get("simulation_chat_id")), [])
        arr.append(g)

    # Build persona name/color map for scenarios' persona_ids
    persona_ids: List[str] = []
    for sc in scenarios:
        pid = sc.get("persona_id")
        if pid:
            persona_ids.append(str(pid))
    uniq_persona_ids = list({pid for pid in persona_ids})

    persona_by_id: Dict[str, Dict[str, Any]] = {}
    if uniq_persona_ids:
        # Fetch only referenced personas
        try:
            placeholders = ",".join([f"'{pid}'" for pid in uniq_persona_ids])
            q = text(f"select id, name, color from personas where id in ({placeholders})")
            res = session.execute(q)
            for row in res:
                # row may be tuple-like or mapping
                try:
                    pid = str(row[0])
                    persona_by_id[pid] = {"id": pid, "name": row[1], "color": row[2]}
                except Exception:
                    m = getattr(row, "_mapping", None)
                    if m:
                        pid = str(m.get("id"))
                        persona_by_id[pid] = {
                            "id": pid,
                            "name": m.get("name"),
                            "color": m.get("color"),
                        }
        except Exception:
            persona_by_id = {}

    rows: List[Dict[str, Any]] = []
    for a in attempts:
        aid = str(a.get("id"))
        pid = str(a.get("profile_id")) if a.get("profile_id") else ""
        sid = str(a.get("simulation_id"))
        sim = sims_by_id.get(sid, {})
        rubric = rubric_by_id.get(str(sim.get("rubric_id")))
        rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
        attempt_chats = chats_by_attempt.get(aid, [])

        # scenarios array for row
        row_chats: List[Dict[str, Any]] = []
        for c in attempt_chats:
            completed = bool(c.get("completed")) or bool(c.get("completed_at"))
            row_chats.append({
                "id": str(c.get("id")),
                "attemptId": aid,
                "scenarioId": str(c.get("scenario_id")) if c.get("scenario_id") else None,
                "createdAt": str(c.get("created_at") or ""),
                "completedAt": str(c.get("completed_at")) if c.get("completed_at") else None,
                "completed": completed,
            })

        # interactionIds expected from simulation.scenario_ids
        interaction_ids = [str(x) for x in (sim.get("scenario_ids") or [])]

        # completed with rubric count
        completed_with_rubric = 0
        total_score_points = 0.0
        for c in attempt_chats:
            completed = bool(c.get("completed")) or bool(c.get("completed_at"))
            if not completed:
                continue
            gid = str(c.get("id"))
            g_list = grades_by_chat.get(gid, [])
            if g_list:
                completed_with_rubric += 1
                # take the latest grade if timestamps exist, else first
                try:
                    g_sorted = sorted(
                        g_list,
                        key=lambda gg: str(gg.get("created_at") or ""),
                    )
                    g = g_sorted[-1]
                except Exception:
                    g = g_list[0]
                total_score_points += float(g.get("score", 0.0))

        total_expected = len(interaction_ids) if interaction_ids else len(attempt_chats)
        avg_score_points = (total_score_points / max(1, total_expected))
        score_percent = int(round((avg_score_points / max(1.0, rubric_points)) * 100.0))

        # Completion flags
        completed_chats_count = sum(
            1 for c in attempt_chats if bool(c.get("completed")) or bool(c.get("completed_at"))
        )
        all_chats_completed = total_expected > 0 and completed_chats_count == total_expected
        is_incomplete = all_chats_completed and completed_with_rubric == 0

        # personas tested (names/colors) from scenarios
        persona_names: List[str] = []
        for c in attempt_chats:
            sid_sc = str(c.get("scenario_id")) if c.get("scenario_id") else None
            if not sid_sc:
                continue
            sc = scen_by_id.get(sid_sc)
            if not sc:
                continue
            pers_id = str(sc.get("persona_id")) if sc.get("persona_id") else None
            if not pers_id:
                continue
            pers = persona_by_id.get(pers_id)
            if pers and pers.get("name"):
                persona_names.append(str(pers.get("name")))
        personas_tested = list({n for n in persona_names})

        # root scenario ids for filtering
        root_scenario_ids = []
        seen_root = set()
        for c in attempt_chats:
            sid_sc = str(c.get("scenario_id")) if c.get("scenario_id") else None
            if not sid_sc:
                continue
            sc = scen_by_id.get(sid_sc)
            if not sc:
                continue
            root_id = str(sc.get("parent_id")) if sc.get("parent_id") else str(sc.get("id"))
            if root_id not in seen_root:
                seen_root.add(root_id)
                root_scenario_ids.append(root_id)

        prof = prof_by_id.get(pid, {})
        full_name = f"{prof.get('first_name','')} {prof.get('last_name','')}".strip()

        rows.append({
            "id": aid,
            "profileId": pid,
            "profileName": full_name,
            "simulationId": sid,
            "simulationTitle": str(sim.get("title") or "Simulation"),
            "createdAt": str(a.get("created_at") or ""),
            "archived": bool(a.get("archived", False)),
            "infiniteMode": bool(a.get("infinite_mode", False)),
            "infiniteModeTimeLimit": a.get("infinite_mode_time_limit"),
            "scenarios": row_chats,
            "interactionIds": interaction_ids,
            "completedWithRubricCount": completed_with_rubric,
            "totalExpected": total_expected,
            "scorePercent": score_percent,
            "isPractice": bool(sim.get("practice_simulation", False)),
            "rootScenarioIds": root_scenario_ids,
            "personasTested": personas_tested,
            "isIncomplete": is_incomplete,
        })

    # Build options for filters on client
    from typing import Set
    profile_options: List[Dict[str, Any]] = []
    seen_prof: Set[str] = set()
    for r in rows:
        pid_opt = r.get("profileId")
        pid = str(pid_opt) if pid_opt else None
        if pid and pid not in seen_prof:
            seen_prof.add(pid)
            profile_options.append({"id": pid, "name": r.get("profileName", "")})

    simulation_options: List[Dict[str, Any]] = []
    seen_sim: Set[str] = set()
    for r in rows:
        sim_id_opt = r.get("simulationId")
        sim_id = str(sim_id_opt) if sim_id_opt else None
        if sim_id and sim_id not in seen_sim:
            seen_sim.add(sim_id)
            simulation_options.append({"id": sim_id, "title": r.get("simulationTitle", "Simulation")})

    # Root scenarios from base
    root_scenarios = []
    seen_rs = set()
    for sc in scenarios:
        rid = str(sc.get("parent_id")) if sc.get("parent_id") else str(sc.get("id"))
        if rid in seen_rs:
            continue
        seen_rs.add(rid)
        # Find the representative name (parent's name if parent exists)
        name = None
        if sc.get("parent_id"):
            parent = scen_by_id.get(str(sc.get("parent_id")))
            name = parent.get("name") if parent else sc.get("name")
        else:
            name = sc.get("name")
        root_scenarios.append({"id": rid, "name": name or "Scenario"})

    return {
        "rows": rows,
        "profiles": profile_options,
        "simulations": simulation_options,
        "rootScenarios": root_scenarios,
    }


@router.post("/home")
async def post_analytics_home(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """
    Compute per-simulation progress rows for the Home page.

    Response rows provide counts to render progress bars without requiring
    client-side analytics filtering.
    """
    base = fetch_analytics_base(session, filters)

    profiles: List[Dict[str, Any]] = base.get("profiles", [])
    attempts: List[Dict[str, Any]] = base.get("attempts", [])
    chats: List[Dict[str, Any]] = base.get("chats", [])
    grades: List[Dict[str, Any]] = base.get("grades", [])
    simulations: List[Dict[str, Any]] = base.get("simulations", [])
    rubrics: List[Dict[str, Any]] = base.get("rubrics", [])
    cohorts: List[Dict[str, Any]] = base.get("cohorts", [])

    rubric_by_id = {str(r.get("id")): r for r in rubrics}

    # Index: chats by attempt; grades by chat
    chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
    for c in chats:
        arr = chats_by_attempt.setdefault(str(c.get("attempt_id")), [])
        arr.append(c)

    grades_by_chat: Dict[str, List[Dict[str, Any]]] = {}
    for g in grades:
        arr = grades_by_chat.setdefault(str(g.get("simulation_chat_id")), [])
        arr.append(g)

    # Cohort membership: for each simulation, union of profile_ids of cohorts that include it
    cohort_profile_ids_by_sim: Dict[str, List[str]] = {}
    cohort_ids_by_sim: Dict[str, List[str]] = {}
    cohort_titles_by_sim: Dict[str, List[str]] = {}
    for c in cohorts:
        sim_ids = [str(sid) for sid in (c.get("simulation_ids") or [])]
        profile_ids = [str(pid) for pid in (c.get("profile_ids") or [])]
        for sid in sim_ids:
            cohort_profile_ids_by_sim.setdefault(sid, [])
            cohort_profile_ids_by_sim[sid].extend(profile_ids)
            cohort_ids_by_sim.setdefault(sid, []).append(str(c.get("id")))
            title = c.get("title") or c.get("name") or ""
            cohort_titles_by_sim.setdefault(sid, []).append(str(title))

    # Fallback: if a simulation has no cohort, consider all distinct profiles in base
    all_profile_ids = [str(p.get("id")) for p in profiles]

    rows: List[Dict[str, Any]] = []
    for sim in simulations:
        sid = str(sim.get("id"))
        title = str(sim.get("title") or "Simulation")

        cohort_member_ids = cohort_profile_ids_by_sim.get(sid)
        member_ids = (
            [pid for pid in cohort_member_ids if pid]
            if cohort_member_ids and len(cohort_member_ids) > 0
            else all_profile_ids
        )
        # Ensure uniqueness
        unique_member_ids = list({pid for pid in member_ids if pid})

        # Group attempts by profile for this simulation
        user_attempts_by_profile: Dict[str, List[Dict[str, Any]]] = {}
        for att in attempts:
            if str(att.get("simulation_id")) != sid:
                continue
            pid = str(att.get("profile_id") or "")
            if not pid:
                continue
            arr = user_attempts_by_profile.setdefault(pid, [])
            arr.append(att)

        # For each profile, derive pass/in-progress via best attempt average vs rubric pass
        passed_members: List[str] = []
        in_progress_members: List[str] = []

        # Pass threshold per rubric
        rubric = rubric_by_id.get(str(sim.get("rubric_id")))
        rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
        pass_points = float(rubric.get("pass_points", 70)) if rubric else 70.0
        pass_threshold = (pass_points / max(rubric_points, 1.0)) * 100.0

        for pid in unique_member_ids:
            atts = user_attempts_by_profile.get(pid, [])
            if not atts:
                continue  # no attempts => handled in not_started

            # Build attempt average scores over its chats' grades
            best_avg_norm = 0.0
            for att in atts:
                chats_for_att = chats_by_attempt.get(str(att.get("id")), [])
                # Collect grades for chats
                scores: List[float] = []
                for ch in chats_for_att:
                    gid = str(ch.get("id"))
                    for g in grades_by_chat.get(gid, []):
                        score = float(g.get("score", 0.0))
                        norm = (score / max(rubric_points, 1.0)) * 100.0
                        scores.append(norm)
                if scores:
                    avg = sum(scores) / len(scores)
                    if avg > best_avg_norm:
                        best_avg_norm = avg

            if best_avg_norm >= pass_threshold:
                passed_members.append(pid)
            else:
                # Has attempts but hasn't met threshold
                in_progress_members.append(pid)

        total_members = len(unique_member_ids)
        passed_count = len(passed_members)
        in_progress_count = len(in_progress_members)
        not_started_count = max(0, total_members - passed_count - in_progress_count)

        rows.append({
            "simulation_id": sid,
            "simulation_title": title,
            "cohort_ids": cohort_ids_by_sim.get(sid, []),
            "cohort_titles": cohort_titles_by_sim.get(sid, []),
            "total_members": total_members,
            "passed_count": passed_count,
            "in_progress_count": in_progress_count,
            "not_started_count": not_started_count,
            "passed_members": passed_members,
            "in_progress_members": in_progress_members,
        })

    return rows


class DashboardFunctionCall(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class DashboardRequest(BaseModel):
    filters: AnalyticsFilters
    functions: List[DashboardFunctionCall]


@router.post("/dashboard")
async def post_analytics_dashboard(
    req: DashboardRequest, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Run requested analytics dashboard functions server-side and return JSON results.

    Body schema:
    {
      "filters": AnalyticsFilters,
      "functions": [ { name: string, args?: object }, ... ]
    }
    """
    base = fetch_analytics_base(session, req.filters)

    # Helper: convert list[dict] to list[SimpleNamespace] so utils can use attribute access
    def to_objs(items: List[Dict[str, Any]]) -> List[SimpleNamespace]:
        return [SimpleNamespace(**(i or {})) for i in (items or [])]

    # Core entities
    filtered = dashboard_utils.FilteredData(
        attempts=to_objs(base.get("attempts", [])),
        chats=to_objs(base.get("chats", [])),
        grades=to_objs(base.get("grades", [])),
        simulations=to_objs(base.get("simulations", [])),
        scenarios=to_objs(base.get("scenarios", [])),
        profiles=to_objs(base.get("profiles", [])),
        feedbacks=to_objs(base.get("feedbacks", [])),
        cohorts=to_objs(base.get("cohorts", [])),
        personas=[],  # filled below
        messages=to_objs(base.get("messages", [])),
    )

    rubrics = to_objs(base.get("rubrics", []))
    standards = to_objs(base.get("standards", []))
    standard_groups = to_objs(base.get("standardGroups", []))

    # Optionally fetch personas referenced by scenarios
    try:
        persona_ids: List[str] = []
        for scen in base.get("scenarios", []) or []:
            pid = scen.get("persona_id")
            if pid:
                persona_ids.append(str(pid))
        if persona_ids:
            placeholders = ",".join([f"'{pid}'" for pid in {"".join([])} or persona_ids])
            q = text(f"select id, name, color from personas where id in ({placeholders})")
            res = session.execute(q)
            fetched: List[Dict[str, Any]] = []
            for row in res:
                try:
                    fetched.append({"id": str(row[0]), "name": row[1], "color": row[2]})
                except Exception:
                    m = getattr(row, "_mapping", None)
                    if m:
                        fetched.append({"id": str(m.get("id")), "name": m.get("name"), "color": m.get("color")})
            filtered.personas = to_objs(fetched)
    except Exception:
        filtered.personas = []

    # Optionally fetch parameters and parameter_items when needed
    parameters: List[SimpleNamespace] = []
    parameter_items: List[SimpleNamespace] = []
    if any(fc.name in [
        "calculateScenarioAttributeBreakdown",
        "calculateScenarioPerformance",
        "calculateSimulationComposition",
    ] for fc in req.functions):
        try:
            res = session.execute(text("select id, name, description, numerical, active, default_parameter from parameters"))
            params_rows: List[Dict[str, Any]] = []
            for row in res:
                try:
                    params_rows.append({
                        "id": str(row[0]),
                        "name": row[1],
                        "description": row[2],
                        "numerical": bool(row[3]),
                        "active": bool(row[4]),
                        "default_parameter": bool(row[5]),
                    })
                except Exception:
                    m = getattr(row, "_mapping", None)
                    if m:
                        params_rows.append({
                            "id": str(m.get("id")),
                            "name": m.get("name"),
                            "description": m.get("description"),
                            "numerical": bool(m.get("numerical")),
                            "active": bool(m.get("active")),
                            "default_parameter": bool(m.get("default_parameter")),
                        })
            parameters = to_objs(params_rows)

            res2 = session.execute(text("select id, name, description, value, parameter_id, default_item from parameter_items"))
            items_rows: List[Dict[str, Any]] = []
            for row in res2:
                try:
                    items_rows.append({
                        "id": str(row[0]),
                        "name": row[1],
                        "description": row[2],
                        "value": row[3],
                        "parameter_id": str(row[4]) if row[4] else None,
                        "default_item": bool(row[5]),
                    })
                except Exception:
                    m = getattr(row, "_mapping", None)
                    if m:
                        items_rows.append({
                            "id": str(m.get("id")),
                            "name": m.get("name"),
                            "description": m.get("description"),
                            "value": m.get("value"),
                            "parameter_id": str(m.get("parameter_id")) if m.get("parameter_id") else None,
                            "default_item": bool(m.get("default_item")),
                        })
            parameter_items = to_objs(items_rows)
        except Exception:
            parameters = []
            parameter_items = []

    # Dispatcher
    def call_function(fc: DashboardFunctionCall) -> Any:
        name = fc.name
        args = fc.args or {}
        # Normalize aliases (camelCase -> snake for our function names)
        mapping = {
            # Header
            "calculateAverageScore": lambda: dashboard_utils.calculate_average_score(filtered, rubrics),
            "calculateCompletionPercentage": lambda: dashboard_utils.calculate_completion_percentage(filtered),
            "calculateFirstAttemptPassRate": lambda: dashboard_utils.calculate_first_attempt_pass_rate(filtered),
            "calculateHighestScore": lambda: dashboard_utils.calculate_highest_score(filtered, rubrics),
            "calculateUserSimulationPerformance": lambda: dashboard_utils.calculate_user_simulation_performance(
                filtered, rubrics, str(args.get("profileId", "")), str(args.get("simulationId", ""))
            ),
            "calculateUserPerformanceBySimulation": lambda: dashboard_utils.calculate_user_performance_by_simulation(
                filtered, rubrics, str(args.get("profileId", ""))
            ),
            "calculateMessagesPerSession": lambda: dashboard_utils.calculate_messages_per_session(filtered.messages, filtered),
            "calculatePersonaResponseTimes": lambda: dashboard_utils.calculate_persona_response_times(filtered.messages, filtered),
            "calculateSessionEfficiency": lambda: dashboard_utils.calculate_session_efficiency(filtered, rubrics),
            "calculateStagnationRate": lambda: dashboard_utils.calculate_stagnation_rate(filtered, rubrics),
            "calculateTimeSpent": lambda: dashboard_utils.calculate_time_spent(filtered),
            "calculateTotalAttempts": lambda: dashboard_utils.calculate_total_attempts(filtered),

            # Footer
            "calculateScenarioAttributeBreakdown": lambda: dashboard_utils.calculate_scenario_attribute_breakdown(
                filtered,
                rubrics,
                parameter_items,
                next((p for p in parameters if str(p.id) == str(args.get("selectedParameterId"))), None),
            ),
            "calculateScenarioPerformance": lambda: dashboard_utils.calculate_scenario_performance(
                filtered,
                rubrics,
                parameter_items,
                next((p for p in parameters if str(p.id) == str(args.get("selectedParameterId"))), None),
            ),
            "calculateSimulationComposition": lambda: dashboard_utils.calculate_simulation_composition(
                filtered, parameters, parameter_items, args.get("config", None)
            ),
            "calculateScenarioPerformanceWithinSimulation": lambda: dashboard_utils.calculate_scenario_performance_within_simulation(
                filtered,
                rubrics,
                next((s for s in filtered.simulations if str(s.id) == str(args.get("selectedSimulationId"))), None),
                args.get("thresholds", {"danger": 60, "warning": 75, "success": 85}),
            ),
            "calculateSimulationPerformance": lambda: dashboard_utils.calculate_simulation_performance(filtered, rubrics),

            # Primary
            "calculateAttemptImprovement": lambda: dashboard_utils.calculate_attempt_improvement(
                filtered, rubrics, args.get("selectedSimulationIds", [])
            ),
            "calculatePlatformGrowth": lambda: dashboard_utils.calculate_platform_growth(filtered, rubrics),
            "calculatePersonaPerformance": lambda: dashboard_utils.calculate_persona_performance(
                filtered, rubrics, filtered.personas, filtered.scenarios, args.get("selectedSimulationIds", [])
            ),

            # Secondary
            "calculateCohortPerformance": lambda: dashboard_utils.calculate_cohort_performance(
                filtered, rubrics, args.get("thresholds", {"danger": 60, "warning": 75, "success": 85}), args.get("selectedSimulationIds", [])
            ),
            "calculateSkillPerformance": lambda: dashboard_utils.calculate_skill_performance(
                filtered, standards, standard_groups, rubrics, args.get("selectedRubricIds", [])
            ),
            "calculateRubricHeatmap": lambda: dashboard_utils.calculate_rubric_heatmap(
                filtered, standards, standard_groups, rubrics, args.get("selectedRubricIds", [])
            ),
        }

        fn = mapping.get(name)
        if not fn:
            raise ValueError(f"Unknown function name: {name}")
        return fn()

    results: Dict[str, Any] = {}
    for fc in req.functions:
        try:
            results[fc.name] = call_function(fc)
        except Exception as e:
            logger.exception("analytics.dashboard.function_failed", extra={"function": fc.name})
            results[fc.name] = {"error": str(e)}

    return {"results": results}