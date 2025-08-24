import logging
from typing import Any, Dict, List

from app.db import get_session
from app.utils.analytics import AnalyticsFilters, fetch_analytics_base
from fastapi import APIRouter, Depends
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

    # Get simulations data for total expected chats calculation
    simulations = base.get("simulations", [])

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

        # Calculate attempt-level scores using the same logic as client-side
        attempt_scores: List[float] = []
        
        # Group chats by attempt for this user
        user_chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
        for chat in user_chats:
            attempt_id = str(chat.get("attempt_id"))
            if attempt_id not in user_chats_by_attempt:
                user_chats_by_attempt[attempt_id] = []
            user_chats_by_attempt[attempt_id].append(chat)
        
        # Calculate score for each attempt
        for user_attempt in user_attempts:
            attempt_id = str(user_attempt.get("id"))
            attempt_chats = user_chats_by_attempt.get(attempt_id, [])
            
            # Get simulation to find total expected chats
            simulation_id = str(user_attempt.get("simulation_id"))
            simulation = next((s for s in simulations if str(s.get("id")) == simulation_id), None)
            total_expected = len(simulation.get("scenario_ids", [])) if simulation else len(attempt_chats)
            
            if total_expected == 0:
                continue
            
            # Count completed chats
            completed_chats = [c for c in attempt_chats if bool(c.get("completed"))]
            
            # If no chats are completed, skip this attempt
            if len(completed_chats) == 0:
                continue
            
            # Calculate total score including zeros for ALL expected chats
            total_score = 0.0
            
            # For each expected chat, find if it exists and has a grade
            for i in range(total_expected):
                if i < len(attempt_chats) and bool(attempt_chats[i].get("completed")):
                    # Find grade for this chat
                    chat_id = str(attempt_chats[i].get("id"))
                    grade = next((g for g in user_grades if str(g.get("simulation_chat_id")) == chat_id), None)
                    if grade:
                        total_score += float(grade.get("score", 0))
                    # If no grade exists, add 0 (implicit)
                # If chat doesn't exist or is not completed, add 0 (implicit)
            
            # Calculate average score for this attempt
            attempt_avg_score = total_score / total_expected
            
            # Normalize by rubric points
            if attempt_chats:
                # Use the first chat's rubric (all chats in an attempt should have the same rubric)
                first_chat = attempt_chats[0]
                grade = next((g for g in user_grades if str(g.get("simulation_chat_id")) == str(first_chat.get("id"))), None)
                if grade:
                    rubric = rubric_by_id.get(str(grade.get("rubric_id")))
                    rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
                    normalized_attempt_score = (attempt_avg_score / max(rubric_points, 1.0)) * 100.0
                    attempt_scores.append(normalized_attempt_score)
        
        # Calculate overall average score
        avg_score = sum(attempt_scores) / len(attempt_scores) if attempt_scores else 0.0
        
        # Calculate highest score (maximum of all attempt scores)
        highest_score = max(attempt_scores) if attempt_scores else 0.0

        # Calculate perfect score count - count individual simulation chat grades that achieved 100% of total points
        perfect_score_count = 0
        for grade in user_grades:
            # Check if this grade achieved 100% of the total points
            score = float(grade.get("score", 0))
            rubric = rubric_by_id.get(str(grade.get("rubric_id")))
            if rubric:
                total_points = float(rubric.get("points", 100))
                # Count as perfect score if the grade equals the total points (100%)
                if score >= total_points:
                    perfect_score_count += 1

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
            "highest_score_avg": int(round(highest_score)),
            "messages_per_session": int(round(messages_per_session)),
            "time_spent_minutes": int(round(time_spent_minutes)),
            "quickest_pass_minutes": quickest_pass_minutes,
            "most_improved_percent": int(round(most_improved_percent)),
            "improvement_rate_per_day": int(round(improvement_rate_per_day)),
            "perfect_score_count": perfect_score_count,
        })

    return rows

@router.post("/reports")
async def post_analytics_reports(
    filters: AnalyticsFilters, session: Session = Depends(get_session)
) -> Dict[str, Any]:
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
    simulations: List[Dict[str, Any]] = base.get("simulations", [])

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

        # Handle profiles with no attempts - set all metrics to zero/defaults
        if not user_attempts:
            rows.append({
                "id": pid,
                "firstName": p.get("first_name"),
                "lastName": p.get("last_name"),
                "username": p.get("alias") or "",
                "averageScore": 0,
                "completionPercentage": 0,
                "firstAttemptPassRate": 0,
                "highestScore": 0,
                "messagesPerSession": 0,
                "personaResponseTimes": 0,
                "sessionEfficiency": 0,
                "stagnationRate": 0,
                "timeSpent": 0,
                "totalAttempts": 0,
                "perfectScoreCount": 0,
                "riskLevel": "good",
                "riskDetails": {
                    "dangerCount": 0,
                    "warningCount": 0,
                    "goodCount": 10,
                },
                "completedSessions": 0,
                "totalSessions": 0,
                "lastActivity": None,
                "scenariosCompleted": 0,
                "personasTested": [],
                "scenarioIds": [],
                "simulationIds": [],
                "simulationMetrics": {},
                "hover": {
                    "scoreStats": {
                        "mean": 0,
                        "median": 0,
                        "mode": 0,
                        "top": [],
                    },
                    "timeStats": {
                        "avgSessionMinutes": 0,
                        "avgChatMinutes": 0,
                        "avgOverallMinutes": 0,
                    },
                    "messageStats": {
                        "mean": 0.0,
                        "median": 0.0,
                        "count": 0,
                    },
                    "completionStats": {
                        "completed": 0,
                        "total": 0,
                        "percent": 0,
                    },
                    "firstAttemptStats": {
                        "passed": 0,
                        "total": 0,
                        "percent": 0,
                    },
                    "personaResponseStats": {
                        "meanSeconds": 0,
                        "medianSeconds": 0,
                        "samples": 0,
                    },
                    "efficiencyStats": {
                        "avgScorePercent": 0,
                        "avgMinutes": 0,
                        "efficiency": 0,
                    },
                    "stagnationStats": {
                        "tracked": 0,
                        "stagnant": 0,
                        "ratePercent": 0,
                    },
                },
            })
            continue

        # Calculate attempt-level scores using the same logic as client-side
        # Group attempts and calculate average scores including zeros for missing chats
        attempt_scores: List[float] = []
        normalized_scores: List[float] = []
        
        # Group chats by attempt
        chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
        for chat in user_chats:
            attempt_id = str(chat.get("attempt_id"))
            if attempt_id not in chats_by_attempt:
                chats_by_attempt[attempt_id] = []
            chats_by_attempt[attempt_id].append(chat)
        
        # Calculate score for each attempt
        for attempt in user_attempts:
            attempt_id = str(attempt.get("id"))
            attempt_chats = chats_by_attempt.get(attempt_id, [])
            
            # Get simulation to find total expected chats
            simulation_id = str(attempt.get("simulation_id"))
            simulation = next((s for s in simulations if str(s.get("id")) == simulation_id), None)
            total_expected = len(simulation.get("scenario_ids", [])) if simulation else len(attempt_chats)
            
            if total_expected == 0:
                continue
            
            # Count completed chats
            completed_chats = [c for c in attempt_chats if bool(c.get("completed"))]
            
            # If no chats are completed, skip this attempt
            if len(completed_chats) == 0:
                continue
            
            # Calculate total score including zeros for ALL expected chats
            total_score = 0.0
            
            # For each expected chat, find if it exists and has a grade
            for i in range(total_expected):
                if i < len(attempt_chats) and bool(attempt_chats[i].get("completed")):
                    # Find grade for this chat
                    chat_id = str(attempt_chats[i].get("id"))
                    grade = next((g for g in user_grades if str(g.get("simulation_chat_id")) == chat_id), None)
                    if grade:
                        total_score += float(grade.get("score", 0))
                    # If no grade exists, add 0 (implicit)
                # If chat doesn't exist or is not completed, add 0 (implicit)
            
            # Calculate average score for this attempt
            attempt_avg_score = total_score / total_expected
            
            # Normalize by rubric points
            if attempt_chats:
                # Use the first chat's rubric (all chats in an attempt should have the same rubric)
                first_chat = attempt_chats[0]
                grade = next((g for g in user_grades if str(g.get("simulation_chat_id")) == str(first_chat.get("id"))), None)
                if grade:
                    rubric = rubric_by_id.get(str(grade.get("rubric_id")))
                    rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
                    normalized_attempt_score = (attempt_avg_score / max(rubric_points, 1.0)) * 100.0
                    attempt_scores.append(normalized_attempt_score)
                    normalized_scores.append(normalized_attempt_score)
        
        # Calculate overall average and highest scores
        avg_score = sum(attempt_scores) / len(attempt_scores) if attempt_scores else 0.0
        highest_score = max(attempt_scores) if attempt_scores else 0.0

        # Calculate perfect score count - count individual simulation chat grades that achieved 100% of total points
        perfect_score_count = 0
        for grade in user_grades:
            # Check if this grade achieved 100% of the total points
            score = float(grade.get("score", 0))
            rubric = rubric_by_id.get(str(grade.get("rubric_id")))
            if rubric:
                total_points = float(rubric.get("points", 100))
                # Count as perfect score if the grade equals the total points (100%)
                if score >= total_points:
                    perfect_score_count += 1

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

        # User response times (seconds) - calculate how long users take to respond to persona messages
        user_response_times: List[float] = []
        
        # Group messages by chat and calculate response times
        messages_by_chat_detailed: Dict[str, List[Dict[str, Any]]] = {}
        for m in messages:
            chat_id = str(m.get("chat_id"))
            if chat_id not in messages_by_chat_detailed:
                messages_by_chat_detailed[chat_id] = []
            messages_by_chat_detailed[chat_id].append(m)
        
        # For each chat, calculate user response times
        for chat_id, chat_messages in messages_by_chat_detailed.items():
            if chat_id not in user_chat_ids:
                continue  # Skip chats not belonging to this user
                
            # Sort messages by created_at
            try:
                sorted_messages = sorted(
                    chat_messages,
                    key=lambda msg: datetime.fromisoformat(str(msg.get("created_at")).replace("Z", "+00:00"))
                )
            except Exception:
                continue
            
            # Calculate response times for response->query pairs (persona message -> user response)
            for i in range(len(sorted_messages) - 1):
                current_msg = sorted_messages[i]
                next_msg = sorted_messages[i + 1]
                
                # Look for response -> query pairs (persona response followed by user query)
                if (current_msg.get("type") == "response" and 
                    next_msg.get("type") == "query" and
                    current_msg.get("created_at") and 
                    next_msg.get("created_at")):
                    try:
                        persona_time = datetime.fromisoformat(str(current_msg.get("created_at")).replace("Z", "+00:00"))
                        user_time = datetime.fromisoformat(str(next_msg.get("created_at")).replace("Z", "+00:00"))
                        response_time_seconds = (user_time - persona_time).total_seconds()
                        
                        # Only include reasonable response times (between 1 second and 1 hour)
                        if 1.0 <= response_time_seconds <= 3600.0:
                            user_response_times.append(response_time_seconds)
                    except Exception:
                        continue
        
        # Calculate average user response time in seconds
        persona_response_seconds = (
            sum(user_response_times) / len(user_response_times) if user_response_times else 0.0
        )

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

        # Calculate per-simulation metrics for export
        simulation_metrics: Dict[str, Dict[str, float]] = {}
        for simulation_id in user_simulation_ids:
            # Get attempts for this simulation
            sim_attempts = [a for a in user_attempts if str(a.get("simulation_id")) == simulation_id]
            sim_attempt_ids = {str(a.get("id")) for a in sim_attempts}
            sim_chats = [c for c in user_chats if str(c.get("attempt_id")) in sim_attempt_ids]
            sim_chat_ids = {str(c.get("id")) for c in sim_chats}
            sim_grades = [g for g in user_grades if str(g.get("simulation_chat_id")) in sim_chat_ids]
            
            # Calculate per-simulation scores using the same logic as overall
            sim_attempt_scores: List[float] = []
            sim_chats_by_attempt: Dict[str, List[Dict[str, Any]]] = {}
            for chat in sim_chats:
                attempt_id = str(chat.get("attempt_id"))
                if attempt_id not in sim_chats_by_attempt:
                    sim_chats_by_attempt[attempt_id] = []
                sim_chats_by_attempt[attempt_id].append(chat)
            
            for attempt in sim_attempts:
                attempt_id = str(attempt.get("id"))
                attempt_chats = sim_chats_by_attempt.get(attempt_id, [])
                
                # Get simulation to find total expected chats
                simulation = next((s for s in simulations if str(s.get("id")) == simulation_id), None)
                total_expected = len(simulation.get("scenario_ids", [])) if simulation else len(attempt_chats)
                
                if total_expected == 0:
                    continue
                
                # Count completed chats
                completed_chats = [c for c in attempt_chats if bool(c.get("completed"))]
                
                # If no chats are completed, skip this attempt
                if len(completed_chats) == 0:
                    continue
                
                # Calculate total score including zeros for ALL expected chats
                total_score = 0.0
                
                # For each expected chat, find if it exists and has a grade
                for i in range(total_expected):
                    if i < len(attempt_chats) and bool(attempt_chats[i].get("completed")):
                        # Find grade for this chat
                        chat_id = str(attempt_chats[i].get("id"))
                        grade = next((g for g in sim_grades if str(g.get("simulation_chat_id")) == chat_id), None)
                        if grade:
                            total_score += float(grade.get("score", 0))
                        # If no grade exists, add 0 (implicit)
                    # If chat doesn't exist or is not completed, add 0 (implicit)
                
                # Calculate average score for this attempt
                attempt_avg_score = total_score / total_expected
                
                # Normalize by rubric points
                if attempt_chats:
                    # Use the first chat's rubric (all chats in an attempt should have the same rubric)
                    first_chat = attempt_chats[0]
                    grade = next((g for g in sim_grades if str(g.get("simulation_chat_id")) == str(first_chat.get("id"))), None)
                    if grade:
                        rubric = rubric_by_id.get(str(grade.get("rubric_id")))
                        rubric_points = float(rubric.get("points", 100)) if rubric else 100.0
                        normalized_attempt_score = (attempt_avg_score / max(rubric_points, 1.0)) * 100.0
                        sim_attempt_scores.append(normalized_attempt_score)
            
            # Calculate per-simulation metrics
            sim_avg_score = sum(sim_attempt_scores) / len(sim_attempt_scores) if sim_attempt_scores else 0.0
            sim_highest_score = max(sim_attempt_scores) if sim_attempt_scores else 0.0
            
            # Calculate other per-simulation metrics
            sim_completed_sessions = sum(1 for c in sim_chats if bool(c.get("completed")))
            sim_total_sessions = len(sim_chats)
            sim_completion_percentage = (sim_completed_sessions / sim_total_sessions * 100.0) if sim_total_sessions > 0 else 0.0
            
            # First attempt pass rate for this simulation
            sim_first_attempts = [a for a in sim_attempts]
            sim_first_attempt = min(sim_first_attempts, key=lambda a: str(a.get("created_at"))) if sim_first_attempts else None
            sim_first_attempt_passed = False
            if sim_first_attempt:
                first_attempt_id = str(sim_first_attempt.get("id"))
                first_attempt_chats = [c for c in sim_chats if str(c.get("attempt_id")) == first_attempt_id]
                first_attempt_chat_ids = {str(c.get("id")) for c in first_attempt_chats}
                first_attempt_grades = [g for g in sim_grades if str(g.get("simulation_chat_id")) in first_attempt_chat_ids]
                sim_first_attempt_passed = any(bool(g.get("passed")) for g in first_attempt_grades)
            
            sim_first_attempt_pass_rate = 100.0 if sim_first_attempt_passed else 0.0
            
            # Time spent for this simulation
            sim_time_spent_seconds = 0.0
            for chat in sim_chats:
                created_at = chat.get("created_at")
                completed_at = chat.get("completed_at")
                if created_at and completed_at:
                    try:
                        start = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                        end = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00"))
                        diff = (end - start).total_seconds()
                        sim_time_spent_seconds += max(0.0, diff)
                    except Exception:
                        pass
            sim_time_spent_minutes = sim_time_spent_seconds / 60.0
            
            # Messages per session for this simulation
            sim_messages_counts = [messages_by_chat.get(str(chat.get("id")), 0) for chat in sim_chats]
            sim_messages_per_session = (sum(sim_messages_counts) / len(sim_messages_counts)) if sim_messages_counts else 0.0
            
            # Session efficiency for this simulation
            sim_avg_minutes = (sim_time_spent_minutes / max(sim_total_sessions, 1)) if sim_total_sessions > 0 else sim_time_spent_minutes
            sim_session_efficiency = max(0.0, min(100.0, sim_avg_score * (1.0 - min(1.0, sim_avg_minutes / 120.0))))
            
            # Store per-simulation metrics
            simulation_metrics[simulation_id] = {
                "averageScore": sim_avg_score,
                "highestScore": sim_highest_score,
                "completionPercentage": sim_completion_percentage,
                "firstAttemptPassRate": sim_first_attempt_pass_rate,
                "timeSpent": sim_time_spent_minutes,
                "messagesPerSession": sim_messages_per_session,
                "sessionEfficiency": sim_session_efficiency,
                "totalAttempts": len(sim_attempts),
            }

        # Risk assessment
        thresholds = {
            "averageScore": {"danger": 70, "warning": 80},
            "completionPercentage": {"danger": 70, "warning": 80},
            "firstAttemptPassRate": {"danger": 70, "warning": 80},
            "highestScore": {"danger": 80, "warning": 85},
            "messagesPerSession": {"danger": 5, "warning": 8},
            "personaResponseTimes": {"danger": 600, "warning": 300},
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
            "personaResponseTimes": band(persona_response_seconds, "personaResponseTimes", invert=True),
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
            "personaResponseTimes": int(round(persona_response_seconds)),
            "sessionEfficiency": int(round(session_efficiency)),
            "stagnationRate": int(round(stagnation_rate)),
            "timeSpent": int(round(time_spent_minutes)),
            "totalAttempts": len(user_attempts),
            "perfectScoreCount": perfect_score_count,
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
            "simulationMetrics": simulation_metrics,
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
                    "meanSeconds": int(round(sum(user_response_times) / len(user_response_times))) if user_response_times else 0,
                    "medianSeconds": int(round(sorted(user_response_times)[len(user_response_times) // 2])) if user_response_times else 0,
                    "samples": len(user_response_times),
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

    # Get cohort simulation IDs following client-side filtering logic
    cohort_simulation_ids: List[str] = []
    if filters.cohortIds:
        # When cohortIds are provided: get simulation IDs from those cohorts
        for cohort in cohorts:
            if str(cohort.get("id")) in filters.cohortIds:
                cohort_simulation_ids.extend([
                    str(sim_id) for sim_id in cohort.get("simulation_ids", [])
                    if str(sim_id) != "RAY"  # Exclude placeholder
                ])
        # Remove duplicates
        cohort_simulation_ids = list(set(cohort_simulation_ids))
    else:
        # When no cohortIds: get all simulation IDs from filtered simulations
        cohort_simulation_ids = [str(s.get("id")) for s in simulations]

    return {
        "rows": rows,
        "cohortSimulationIds": cohort_simulation_ids
    }

