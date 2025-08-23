from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import sqrt
from typing import Any, Callable, Dict, List, Optional, Tuple, cast

from app.models import (Agents, AppFeedback, AssistantChats, AssistantMessages,
                        AssistantToolCalls, Cohorts, DebugInfo, Documents,
                        ModelRuns, Models, ParameterItems, Parameters,
                        Personas, Profiles, Rubrics, Scenarios,
                        SimulationAttempts,
                        SimulationChatCrowdsourcedFeedbacks,
                        SimulationChatFeedbacks, SimulationChatGrades,
                        SimulationChats, SimulationCrowdsourcedMessages,
                        SimulationMessages, Simulations, StandardGroups,
                        Standards)

# --------------------------------------------------------------------------------------
# Shared container and helpers
# --------------------------------------------------------------------------------------


@dataclass
class FilteredData:
    attempts: List[SimulationAttempts]
    chats: List[SimulationChats]
    grades: List[SimulationChatGrades]
    simulations: List[Simulations]
    scenarios: List[Scenarios]
    profiles: List[Profiles]
    feedbacks: List[SimulationChatFeedbacks]
    cohorts: List[Cohorts]
    personas: List[Personas]
    messages: List[SimulationMessages]


def _fmt(dt: datetime, fmt: str) -> str:
    return dt.strftime(fmt)


def _safe_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    try:
        # attempt isoformat parsing
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _rubric_for_simulation(simulation_id: Any, rubrics: List[Rubrics], simulations: List[Simulations]) -> Optional[Rubrics]:
    sim = next((s for s in simulations if str(s.id) == str(simulation_id)), None)
    if not sim:
        return None
    return next((r for r in rubrics if str(r.id) == str(sim.rubric_id)), None)


def _rubric_points_for_simulation(simulation_id: Any, rubrics: List[Rubrics], simulations: List[Simulations]) -> int:
    rubric = _rubric_for_simulation(simulation_id, rubrics, simulations)
    return rubric.points if rubric else 100


def _grade_percent(grade: SimulationChatGrades, rubrics: List[Rubrics], simulations: List[Simulations], chats: List[SimulationChats], attempts: List[SimulationAttempts]) -> int:
    chat = next((c for c in chats if str(c.id) == str(grade.simulation_chat_id)), None)
    attempt = next((a for a in attempts if str(a.id) == str(chat.attempt_id)), None) if chat else None
    if not attempt:
        # fallback to rubric on grade if present, else default 100
        rubric = next((r for r in rubrics if str(r.id) == str(getattr(grade, "rubric_id", ""))), None)
        total = rubric.points if rubric else 100
        return round((grade.score / total) * 100) if total else 0
    total_points = _rubric_points_for_simulation(attempt.simulation_id, rubrics, simulations)
    return round((grade.score / (total_points if total_points else 100)) * 100)


def _group_by_date(items: List[Any], key_fn: Callable[[Any], Any], fmt: str) -> Dict[str, List[Any]]:
    by_date: Dict[str, List[Any]] = {}
    for item in items:
        dt = _safe_dt(key_fn(item))
        if not dt:
            continue
        date_key = dt.strftime("%Y-%m-%d")
        if date_key not in by_date:
            by_date[date_key] = []
        by_date[date_key].append(item)
    # Convert keys to requested display format later as needed
    return by_date


# --------------------------------------------------------------------------------------
# Header analytics (ported from client/utils/analytics/header.ts)
# --------------------------------------------------------------------------------------


def calculate_average_score(filtered: FilteredData, rubrics: List[Rubrics]) -> Dict[str, Any]:
    if len(filtered.grades) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    score_sum = sum(
        _grade_percent(grade, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
        for grade in filtered.grades
    )
    current_value = round(score_sum / len(filtered.grades))

    grades_by_day = _group_by_date(filtered.grades, lambda g: g.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_grades in grades_by_day.items():
        day_sum = sum(
            _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
            for g in day_grades
        )
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({
            "date": _fmt(dt, "%m/%d"),
            "value": round(day_sum / len(day_grades)) if day_grades else 0,
            "count": len(day_grades),
        })

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_completion_percentage(filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.chats) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    passing_chat_ids = {str(g.simulation_chat_id) for g in filtered.grades if getattr(g, "passed", False)}
    passing_chats = [c for c in filtered.chats if str(c.id) in passing_chat_ids]
    current_value = round((len(passing_chats) / len(filtered.chats)) * 100) if filtered.chats else 0

    chats_by_day = _group_by_date(filtered.chats, lambda c: c.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_chats in chats_by_day.items():
        day_passing = [c for c in day_chats if str(c.id) in passing_chat_ids]
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({
            "date": _fmt(dt, "%m/%d"),
            "value": round((len(day_passing) / len(day_chats)) * 100) if day_chats else 0,
            "count": len(day_chats),
        })

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_first_attempt_pass_rate(filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.attempts) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    # Determine first attempt per (profile, simulation)
    first_attempts: Dict[str, SimulationAttempts] = {}
    for attempt in filtered.attempts:
        key = f"{attempt.profile_id}-{attempt.simulation_id}"
        existing = first_attempts.get(key)
        if not existing or (_safe_dt(attempt.created_at) or datetime.min) < (_safe_dt(existing.created_at) or datetime.min):
            first_attempts[key] = attempt

    def _attempt_passed(a: SimulationAttempts) -> bool:
        attempt_chats = [c for c in filtered.chats if str(c.attempt_id) == str(a.id)]
        for chat in attempt_chats:
            grade = next((g for g in filtered.grades if str(g.simulation_chat_id) == str(chat.id)), None)
            if grade and getattr(grade, "passed", False):
                return True
        return False

    passed_first = [a for a in first_attempts.values() if _attempt_passed(a)]
    current_value = round((len(passed_first) / len(first_attempts)) * 100) if first_attempts else 0

    attempts_by_day = _group_by_date(filtered.attempts, lambda a: a.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_attempts in attempts_by_day.items():
        # recompute first-attempts for that day
        day_first: Dict[str, SimulationAttempts] = {}
        for attempt in day_attempts:
            key = f"{attempt.profile_id}-{attempt.simulation_id}"
            existing = day_first.get(key)
            if not existing or (_safe_dt(attempt.created_at) or datetime.min) < (_safe_dt(existing.created_at) or datetime.min):
                day_first[key] = attempt
        passed_day = [a for a in day_first.values() if _attempt_passed(a)]
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({
            "date": _fmt(dt, "%m/%d"),
            "value": round((len(passed_day) / len(day_first)) * 100) if day_first else 0,
            "count": len(day_first),
        })

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_highest_score(filtered: FilteredData, rubrics: List[Rubrics]) -> Dict[str, Any]:
    if len(filtered.grades) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    highest = max(
        _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
        for g in filtered.grades
    )

    grades_by_day = _group_by_date(filtered.grades, lambda g: g.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_grades in grades_by_day.items():
        day_high = 0
        if day_grades:
            day_high = max(
                _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
                for g in day_grades
            )
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": day_high, "count": len(day_grades)})

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": highest, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_user_simulation_performance(
    filtered: FilteredData, rubrics: List[Rubrics], profile_id: str, simulation_id: str
) -> Dict[str, Any]:
    if not profile_id:
        return {"highestScorePercent": 0, "passed": False}

    rubric = _rubric_for_simulation(simulation_id, rubrics, filtered.simulations)
    rubric_points = rubric.points if rubric else 100
    pass_points = rubric.pass_points if rubric and getattr(rubric, "pass_points", None) is not None else 70

    attempts = [a for a in filtered.attempts if str(a.profile_id) == str(profile_id) and str(a.simulation_id) == str(simulation_id)]
    if not attempts:
        return {"highestScorePercent": 0, "passed": False}

    attempt_avgs: List[float] = []
    for a in attempts:
        a_chats = [c for c in filtered.chats if str(c.attempt_id) == str(a.id)]
        chat_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in a_chats)]
        if not chat_grades:
            attempt_avgs.append(0)
        else:
            total = sum(g.score for g in chat_grades)
            attempt_avgs.append(total / len(chat_grades))

    highest_raw = max(attempt_avgs) if attempt_avgs else 0
    highest_percent = round((highest_raw / (rubric_points if rubric_points else 100)) * 100) if rubric_points else 0
    passed = highest_raw >= pass_points
    return {"highestScorePercent": highest_percent, "passed": passed}


def calculate_user_performance_by_simulation(
    filtered: FilteredData, rubrics: List[Rubrics], profile_id: str
) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    if not profile_id:
        return result

    simulations_for_profile = {str(a.simulation_id) for a in filtered.attempts if str(a.profile_id) == str(profile_id)}
    for sim_id in simulations_for_profile:
        result[sim_id] = calculate_user_simulation_performance(filtered, rubrics, profile_id, sim_id)
    return result


def calculate_messages_per_session(messages: List[SimulationMessages], filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.chats) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    def _count_msgs(chat_id: Any) -> int:
        return len([m for m in messages if str(m.chat_id) == str(chat_id)])

    total_messages = sum(_count_msgs(c.id) for c in filtered.chats)
    current_value = round(total_messages / len(filtered.chats)) if filtered.chats else 0

    chats_by_day = _group_by_date(filtered.chats, lambda c: c.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_chats in chats_by_day.items():
        day_total = sum(_count_msgs(c.id) for c in day_chats)
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({
            "date": _fmt(dt, "%m/%d"),
            "value": round(day_total / len(day_chats)) if day_chats else 0,
            "count": len(day_chats),
        })

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_persona_response_times(messages: List[SimulationMessages], filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.chats) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    def _sorted_msgs(chat_id: Any) -> List[SimulationMessages]:
        ms = [m for m in messages if str(m.chat_id) == str(chat_id)]
        ms.sort(key=lambda m: _safe_dt(m.created_at) or datetime.min)
        return ms

    response_times: List[float] = []
    for c in filtered.chats:
        ms = _sorted_msgs(c.id)
        for i in range(1, len(ms)):
            cur = ms[i]
            prev = ms[i - 1]
            # message.type is Enum('query','response') in DB
            if getattr(cur, "type", None) == "response" and getattr(prev, "type", None) == "query":
                cur_dt = _safe_dt(cur.created_at)
                prev_dt = _safe_dt(prev.created_at)
                if cur_dt and prev_dt:
                    response_times.append((cur_dt.timestamp() - prev_dt.timestamp()))

    current_value = round((sum(response_times) / len(response_times))) if response_times else 0

    chats_by_day = _group_by_date(filtered.chats, lambda c: c.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_chats in chats_by_day.items():
        day_times: List[float] = []
        for c in day_chats:
            ms = _sorted_msgs(c.id)
            for i in range(1, len(ms)):
                cur = ms[i]
                prev = ms[i - 1]
                if getattr(cur, "type", None) == "response" and getattr(prev, "type", None) == "query":
                    cur_dt = _safe_dt(cur.created_at)
                    prev_dt = _safe_dt(prev.created_at)
                    if cur_dt and prev_dt:
                        day_times.append((cur_dt.timestamp() - prev_dt.timestamp()))
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        avg = round((sum(day_times) / len(day_times))) if day_times else 0
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": avg, "count": len(day_chats)})

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_session_efficiency(filtered: FilteredData, rubrics: List[Rubrics]) -> Dict[str, Any]:
    if len(filtered.grades) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    scores = [
        _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
        for g in filtered.grades
    ]
    avg_score = sum(scores) / len(scores) if scores else 0
    times_minutes = [getattr(g, "time_taken", 0) / 60 for g in filtered.grades]
    avg_time_min = (sum(times_minutes) / len(times_minutes)) if times_minutes else 0
    if avg_time_min == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}
    current_value = round((avg_score / avg_time_min) * 10) / 10

    grades_by_day = _group_by_date(filtered.grades, lambda g: g.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_grades in grades_by_day.items():
        day_scores = [
            _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
            for g in day_grades
        ]
        day_avg_score = (sum(day_scores) / len(day_scores)) if day_scores else 0
        day_times_min = [getattr(g, "time_taken", 0) / 60 for g in day_grades]
        day_avg_time = (sum(day_times_min) / len(day_times_min)) if day_times_min else 0
        day_eff = round((day_avg_score / day_avg_time) * 10) / 10 if day_avg_time > 0 else 0
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": day_eff, "count": len(day_grades)})

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_stagnation_rate(filtered: FilteredData, rubrics: List[Rubrics]) -> Dict[str, Any]:
    if len(filtered.attempts) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    # Group attempts by profile-simulation
    attempts_map: Dict[str, List[SimulationAttempts]] = {}
    for a in filtered.attempts:
        key = f"{a.profile_id}-{a.simulation_id}"
        attempts_map.setdefault(key, []).append(a)

    stagnant_profiles = 0
    total_profiles_multi = 0

    for key, attempts in attempts_map.items():
        if len(attempts) < 3:
            continue
        total_profiles_multi += 1
        attempts.sort(key=lambda a: _safe_dt(a.created_at) or datetime.min)
        first, last = attempts[0], attempts[-1]
        # average percent for first
        def _attempt_avg_percent(attempt: SimulationAttempts) -> float:
            a_chats = [c for c in filtered.chats if str(c.attempt_id) == str(attempt.id)]
            a_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in a_chats)]
            if not a_grades:
                return 0.0
            percents = [
                _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
                for g in a_grades
            ]
            return sum(percents) / len(percents)

        first_avg = _attempt_avg_percent(first)
        last_avg = _attempt_avg_percent(last)
        improvement = ((last_avg - first_avg) / first_avg) * 100 if first_avg > 0 else 0
        if improvement < 5:
            stagnant_profiles += 1

    current_value = 0 if total_profiles_multi == 0 else round((stagnant_profiles / total_profiles_multi) * 100)

    attempts_by_day = _group_by_date(filtered.attempts, lambda a: a.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_attempts in attempts_by_day.items():
        # heuristic per TS implementation
        rate = round(min(100, (len(day_attempts) / 10) * 100)) if day_attempts else 0
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": rate, "count": len(day_attempts)})

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_time_spent(filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.chats) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    total: float = 0.0
    for c in filtered.chats:
        if getattr(c, "completed_at", None):
            start = _safe_dt(c.created_at)
            end = _safe_dt(c.completed_at)
            if start and end:
                total += (end.timestamp() - start.timestamp())

    current_value = round(total)

    chats_by_day = _group_by_date(filtered.chats, lambda c: c.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_chats in chats_by_day.items():
        day_total: float = 0.0
        for c in day_chats:
            if getattr(c, "completed_at", None):
                start = _safe_dt(c.created_at)
                end = _safe_dt(c.completed_at)
                if start and end:
                    day_total += (end.timestamp() - start.timestamp())
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": round(day_total), "count": len(day_chats)})

    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


def calculate_total_attempts(filtered: FilteredData) -> Dict[str, Any]:
    if len(filtered.attempts) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}
    current_value = len(filtered.attempts)
    by_day = _group_by_date(filtered.attempts, lambda a: a.created_at, "%Y-%m-%d")
    trend_data: List[Dict[str, Any]] = []
    for date_key, day_attempts in by_day.items():
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        trend_data.append({"date": _fmt(dt, "%m/%d"), "value": len(day_attempts), "count": len(day_attempts)})
    trend_data.sort(key=lambda d: datetime.strptime(d["date"], "%m/%d"))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": any(d["count"] > 0 for d in trend_data)}


# --------------------------------------------------------------------------------------
# Footer analytics (ported from client/utils/analytics/footer.ts)
# --------------------------------------------------------------------------------------


def calculate_scenario_attribute_breakdown(
    filtered: FilteredData, rubrics: List[Rubrics], parameter_items: List[ParameterItems], selected_parameter: Parameters
) -> List[Dict[str, Any]]:
    items_for_selected = [pi for pi in parameter_items if str(pi.parameter_id) == str(selected_parameter.id)]
    items_for_selected.sort(key=lambda x: x.value)
    if not items_for_selected or len(filtered.grades) == 0:
        return []

    # attempted scenario ids from grades->chats
    attempted_scenario_ids = set()
    for grade in filtered.grades:
        chat = next((c for c in filtered.chats if str(c.id) == str(grade.simulation_chat_id)), None)
        if chat:
            attempted_scenario_ids.add(str(chat.scenario_id))

    attempted_scenarios = [s for s in filtered.scenarios if str(s.id) in attempted_scenario_ids]

    total_param_occurrences = 0
    for scenario in attempted_scenarios:
        ids = getattr(scenario, "parameter_item_ids", None) or []
        scenario_param_items = [pid for pid in ids if any(str(pi.id) == str(pid) for pi in items_for_selected)]
        total_param_occurrences += len(scenario_param_items)

    colors = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#06b6d4",
        "#84cc16",
        "#f97316",
        "#ec4899",
        "#6366f1",
        "#14b8a6",
        "#f43f5e",
    ]

    elements: List[Dict[str, Any]] = []
    for idx, param_item in enumerate(items_for_selected):
        total_occ = 0
        for scenario in attempted_scenarios:
            ids = getattr(scenario, "parameter_item_ids", None) or []
            if any(str(param_item.id) == str(pid) for pid in ids):
                total_occ += 1
        count = total_occ
        percentage = (count / total_param_occurrences) * 100 if total_param_occurrences > 0 else 0

        total_score = 0
        total_completion = 0
        total_attempts = 0
        grade_count = 0
        attribute_grades: List[Tuple[int, datetime]] = []

        scenarios_with_attribute = [s for s in attempted_scenarios if any(str(param_item.id) == str(pid) for pid in (getattr(s, "parameter_item_ids", None) or []))]
        for scenario in scenarios_with_attribute:
            scenario_chats = [c for c in filtered.chats if str(c.scenario_id) == str(scenario.id)]
            scenario_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in scenario_chats)]
            for g in scenario_grades:
                chat = next((c for c in filtered.chats if str(c.id) == str(g.simulation_chat_id)), None)
                attempt = next((a for a in filtered.attempts if chat and str(a.id) == str(chat.attempt_id)), None)
                simulation = next((s for s in filtered.simulations if attempt and str(s.id) == str(attempt.simulation_id)), None)
                rubric = next((r for r in rubrics if simulation and str(r.id) == str(simulation.rubric_id)), None)
                rubric_points = rubric.points if rubric else 100
                score_pct = round((g.score / rubric_points) * 100) if rubric_points else 0
                total_score += score_pct
                grade_count += 1
                attribute_grades.append((score_pct, _safe_dt(g.created_at) or datetime.min))
            for c in scenario_chats:
                if getattr(c, "completed", False):
                    total_completion += 1
                total_attempts += 1

        avg_score = (total_score / grade_count) if grade_count > 0 else 0
        completion_rate = (total_completion / total_attempts) * 100 if total_attempts > 0 else 0
        trend: List[Dict[str, Any]] = [
            {
                "date": (_safe_dt(dt) or datetime.min).strftime("%b %d"),
                "score": round(score),
                "timestamp": int((_safe_dt(dt) or datetime.min).timestamp() * 1000),
            }
            for (score, dt) in attribute_grades
        ]
        trend.sort(key=lambda x: x["timestamp"])  # already int

        insight = ""
        if len(trend) >= 2:
            recent = trend[-3:]
            earlier = trend[:3]
            if recent and earlier:
                recent_avg = sum(float(t["score"]) for t in recent) / len(recent)
                earlier_avg = sum(float(t["score"]) for t in earlier) / len(earlier)
                improvement = recent_avg - earlier_avg
                if improvement > 5:
                    insight = f"Performance has improved by {round(improvement)}% recently. Consider using this {selected_parameter.name} more frequently."
                elif improvement < -5:
                    insight = f"Performance has declined by {round(abs(improvement))}% recently. Review training approach for this {selected_parameter.name}."
                else:
                    insight = f"Performance has remained stable. Current average score is {round(avg_score)}% with {round(completion_rate)}% completion rate."
        else:
            insight = f"Limited data available. Current average score is {round(avg_score)}% with {round(completion_rate)}% completion rate."

        elements.append(
            {
                "id": str(param_item.id),
                "name": param_item.value,
                "displayName": param_item.value,
                "icon": "📊",
                "color": colors[idx % len(colors)],
                "count": count,
                "percentage": round(percentage * 10) / 10,
                "avgScore": round(avg_score),
                "completionRate": round(completion_rate),
                "totalAttempts": total_attempts,
                "trendData": trend,
                "insight": insight,
            }
        )

    return [e for e in sorted(elements, key=lambda x: x["percentage"], reverse=True) if e["count"] > 0]


def calculate_scenario_performance(
    filtered: FilteredData, rubrics: List[Rubrics], parameter_items: List[ParameterItems], selected_parameter: Parameters
) -> Dict[str, Any]:
    items_for_selected = [pi for pi in parameter_items if str(pi.parameter_id) == str(selected_parameter.id)]
    items_for_selected.sort(key=lambda x: float(x.value) if _is_float(x.value) else 0.0)
    if not items_for_selected or len(filtered.grades) == 0:
        return {"performanceData": [], "correlationData": {"correlation": 0, "pValue": 1}}

    metric_groups: Dict[str, Dict[str, Any]] = {}
    for scenario in filtered.scenarios:
        scenario_chats = [c for c in filtered.chats if str(c.scenario_id) == str(scenario.id)]
        scenario_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in scenario_chats)]
        if not scenario_grades:
            continue
        # find parameter item for selected param
        scenario_param_item_id = next(
            (pid for pid in (getattr(scenario, "parameter_item_ids", None) or []) if any(str(pi.id) == str(pid) for pi in items_for_selected)),
            None,
        )
        if scenario_param_item_id is None:
            continue
        item = next((pi for pi in items_for_selected if str(pi.id) == str(scenario_param_item_id)), None)
        metric_value = item.value if item else ""
        if not metric_value:
            continue

        # convert grades to percentage
        pct_scores = [
            _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
            for g in scenario_grades
        ]
        avg_score = round(sum(pct_scores) / len(pct_scores)) if pct_scores else 0
        group = metric_groups.setdefault(metric_value, {"scores": [], "count": 0, "rubricPoints": 0})
        group["scores"].append(avg_score)
        group["count"] += len(scenario_chats)
        if group["rubricPoints"] == 0 and scenario_grades:
            # get rubric points from first grade
            first_grade = scenario_grades[0]
            rubric = next((r for r in rubrics if str(r.id) == str(first_grade.rubric_id)), None)
            group["rubricPoints"] = rubric.points if rubric else 0

    performance_data = [
        {
            "metricLevel": k,
            "avgScore": round(sum(v["scores"]) / len(v["scores"])) if v["scores"] else 0,
            "scenarioCount": len(v["scores"]),
            "totalAttempts": v["count"],
            "rubricPoints": v["rubricPoints"],
        }
        for k, v in metric_groups.items()
    ]
    try:
        performance_data.sort(key=lambda x: float(x["metricLevel"]))
    except Exception:
        performance_data.sort(key=lambda x: x["metricLevel"])  # fallback
    performance_data = [p for p in performance_data if p["scenarioCount"] >= 1]

    # correlation
    correlation, p_value = 0.0, 1.0
    if len(performance_data) >= 2:
        xs = [float(p["metricLevel"]) if _is_float(p["metricLevel"]) else 0.0 for p in performance_data]
        ys = [p["avgScore"] for p in performance_data]
        correlation = _pearson(xs, ys)
        p_value = _p_value(correlation, len(xs))

    return {"performanceData": performance_data, "correlationData": {"correlation": correlation, "pValue": p_value}}


def calculate_simulation_composition(
    filtered: FilteredData,
    parameters: List[Parameters],
    parameter_items: List[ParameterItems],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if len(filtered.grades) == 0:
        return {
            "highPerforming": [],
            "lowPerforming": [],
            "highPerformingCount": 0,
            "lowPerformingCount": 0,
            "highPerformingDetails": [],
            "lowPerformingDetails": [],
        }

    cfg = {
        "method": "percentile",
        "topPercentage": 25,
        "bottomPercentage": 25,
    }
    if config:
        cfg.update(config)

    # Group by simulation
    performance: Dict[str, Dict[str, Any]] = {}
    for grade in filtered.grades:
        chat = next((c for c in filtered.chats if str(c.id) == str(grade.simulation_chat_id)), None)
        if not chat:
            continue
        attempt = next((a for a in filtered.attempts if str(a.id) == str(chat.attempt_id)), None)
        if not attempt:
            continue
        simulation = next((s for s in filtered.simulations if str(s.id) == str(attempt.simulation_id)), None)
        if not simulation:
            continue
        if str(simulation.id) not in performance:
            performance[str(simulation.id)] = {
                "simulation": simulation,
                "grades": [],
                "chats": [],
                "avgScore": 0.0,
                "completionRate": 0.0,
                "totalAttempts": 0,
                "timeLimit": getattr(simulation, "time_limit", None),
                "scenarioCount": len(getattr(simulation, "scenario_ids", []) or []),
                "parameterBreakdown": [],
            }
        entry = performance[str(simulation.id)]
        entry["grades"].append(grade)
        entry["chats"].append(chat)

    # compute metrics
    for sim_id, entry in performance.items():
        chats = entry["chats"]
        grades = entry["grades"]
        completed = [c for c in chats if getattr(c, "completed", False)]
        entry["avgScore"] = (sum(g.score for g in grades) / len(grades)) if grades else 0.0
        entry["completionRate"] = (len(completed) / len(chats) * 100) if chats else 0.0
        entry["totalAttempts"] = len(chats)

        # collect parameter usage from scenarios used by chats
        used_param_items: Dict[str, Dict[str, Any]] = {}
        scenario_ids = {str(c.scenario_id) for c in chats}
        sim_scenarios = [s for s in filtered.scenarios if str(s.id) in scenario_ids]
        for scenario in sim_scenarios:
            for pid in (getattr(scenario, "parameter_item_ids", None) or []):
                pitem = next((pi for pi in parameter_items if str(pi.id) == str(pid)), None)
                if not pitem:
                    continue
                parameter = next((p for p in parameters if str(p.id) == str(pitem.parameter_id)), None)
                if not parameter:
                    continue
                key = f"{pitem.parameter_id}-{pitem.id}"
                if key not in used_param_items:
                    used_param_items[key] = {
                        "parameterName": parameter.name,
                        "parameterValue": pitem.value,
                        "isNumerical": bool(getattr(parameter, "numerical", False)),
                        "count": 0,
                    }
                used_param_items[key]["count"] += 1
        entry["parameterBreakdown"] = [
            {
                "parameterName": v["parameterName"],
                "parameterValue": v["parameterValue"],
                "isNumerical": v["isNumerical"],
            }
            for v in sorted(used_param_items.values(), key=lambda x: x["count"], reverse=True)
        ]

    # combined score
    sims_with_score = []
    for entry in performance.values():
        combined = entry["avgScore"] * 0.7 + entry["completionRate"] * 0.3
        sims_with_score.append({**entry, "combinedScore": combined})
    sims_with_score.sort(key=lambda x: x["combinedScore"], reverse=True)

    method = cfg["method"]
    if method == "percentile":
        _top_raw = cfg.get("topPercentage", 25)
        _bottom_raw = cfg.get("bottomPercentage", 25)
        top_pct: float = float(_top_raw) if isinstance(_top_raw, (int, float, str)) else 25.0
        bottom_pct: float = float(_bottom_raw) if isinstance(_bottom_raw, (int, float, str)) else 25.0
        top_count = max(1, round((len(sims_with_score) * top_pct) / 100))
        bottom_count = max(1, round((len(sims_with_score) * bottom_pct) / 100))
        high = sims_with_score[:top_count]
        low = sims_with_score[-bottom_count:] if bottom_count > 0 else []
    elif method == "quartile":
        q = max(1, round(len(sims_with_score) * 0.25))
        high = sims_with_score[:q]
        low = sims_with_score[-q:]
    elif method == "standard_deviation":
        scores = [s["combinedScore"] for s in sims_with_score]
        mean = sum(scores) / len(scores) if scores else 0
        variance = (sum((s - mean) ** 2 for s in scores) / len(scores)) if scores else 0
        std = sqrt(variance)
        high = [s for s in sims_with_score if s["combinedScore"] >= mean + std]
        low = [s for s in sims_with_score if s["combinedScore"] <= mean - std]
    else:
        top_count = max(1, round((len(sims_with_score) * 25) / 100))
        high = sims_with_score[:top_count]
        low = sims_with_score[-top_count:]

    def _detail(sim_entry: Dict[str, Any]) -> Dict[str, Any]:
        sim = sim_entry["simulation"]
        return {
            "id": str(sim.id),
            "title": sim.title,
            "avgScore": round(sim_entry["avgScore"]),
            "completionRate": round(sim_entry["completionRate"]),
            "totalAttempts": sim_entry["totalAttempts"],
            "combinedScore": round(sim_entry["combinedScore"]),
            "timeLimit": sim_entry["timeLimit"],
            "scenarioCount": sim_entry["scenarioCount"],
            "parameterBreakdown": sim_entry["parameterBreakdown"],
        }

    high_details = [_detail(s) for s in high]
    low_details = [_detail(s) for s in low]

    # parameter usage significance
    colors = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#06b6d4",
        "#84cc16",
        "#f97316",
        "#ec4899",
        "#6366f1",
        "#14b8a6",
        "#f43f5e",
    ]

    usage: Dict[str, Dict[str, Any]] = {}

    def _get_attr(parameter_id: Any, parameter_item_id: Any, parameter_name: str, parameter_value: str, is_numerical: bool) -> Dict[str, Any]:
        key = f"{parameter_id}-{parameter_item_id}"
        if key not in usage:
            color = colors[len(usage) % len(colors)]
            usage[key] = {
                "id": key,
                "name": f"{parameter_name}: {parameter_value}",
                "icon": "📊" if is_numerical else "🏷️",
                "color": color,
                "highPerforming": 0,
                "lowPerforming": 0,
                "description": f"{parameter_name} with value {parameter_value}",
                "difference": 0,
                "significance": "none",
                "parameterId": str(parameter_id),
                "parameterItemId": str(parameter_item_id),
                "value": parameter_value,
                "isNumerical": is_numerical,
            }
        return usage[key]

    def _tally(sims: List[Dict[str, Any]], target: str) -> None:
        for s in sims:
            for param in s["parameterBreakdown"]:
                pitem = next((pi for pi in parameter_items if pi.value == param["parameterValue"]), None)
                if pitem:
                    attr = _get_attr(pitem.parameter_id, pitem.id, param["parameterName"], param["parameterValue"], param["isNumerical"])
                    usage_key = "highPerforming" if target == "high" else "lowPerforming"
                    usage[attr["id"]][usage_key] += 1

    _tally(high_details, "high")
    _tally(low_details, "low")

    for attr in usage.values():
        attr["difference"] = attr["highPerforming"] - attr["lowPerforming"]
        total_high = len(high_details)
        total_low = len(low_details)
        if total_high > 0 and total_low > 0:
            high_rate = attr["highPerforming"] / total_high
            low_rate = attr["lowPerforming"] / total_low
            rate_diff = abs(high_rate - low_rate)
            if rate_diff > 0.2:
                attr["significance"] = "high"
            elif rate_diff > 0.1:
                attr["significance"] = "medium"
            elif rate_diff > 0.02:
                attr["significance"] = "low"
            else:
                attr["significance"] = "none"

    def _project(attrs: List[Dict[str, Any]], which: str) -> List[Dict[str, Any]]:
        filtered_attrs = [a for a in attrs if a[which] > 0]
        def sig_order(s: str) -> int:
            return {"high": 3, "medium": 2, "low": 1, "none": 0}.get(s, 0)
        filtered_attrs.sort(key=lambda a: (sig_order(a["significance"]), a[which]), reverse=True)
        top = filtered_attrs[:5]
        return [
            {
                "name": a["name"],
                "value": a[which],
                "icon": a["icon"],
                "color": a["color"],
                "description": a["description"],
                "significance": a["significance"],
            }
            for a in top
        ]

    high_attrs = _project(list(usage.values()), "highPerforming")
    low_attrs = _project(list(usage.values()), "lowPerforming")

    return {
        "highPerforming": high_attrs,
        "lowPerforming": low_attrs,
        "highPerformingCount": len(high_details),
        "lowPerformingCount": len(low_details),
        "highPerformingDetails": high_details,
        "lowPerformingDetails": low_details,
    }


def calculate_scenario_performance_within_simulation(
    filtered: FilteredData,
    rubrics: List[Rubrics],
    selected_simulation: Optional[Simulations],
    thresholds: Dict[str, int],
) -> List[Dict[str, Any]]:
    if not selected_simulation:
        return []

    rubric = next((r for r in rubrics if str(r.id) == str(selected_simulation.rubric_id)), None)
    rubric_points = rubric.points if rubric else 100

    # filter grades for this simulation
    def _is_in_sim(chat: SimulationChats) -> bool:
        attempt = next((a for a in filtered.attempts if str(a.id) == str(chat.attempt_id)), None)
        return bool(attempt and str(attempt.simulation_id) == str(selected_simulation.id))

    result: List[Dict[str, Any]] = []
    for scenario in filtered.scenarios:
        scenario_chats = [c for c in filtered.chats if str(c.scenario_id) == str(scenario.id) and _is_in_sim(c)]
        scenario_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in scenario_chats)]
        graded_chat_ids = {str(g.simulation_chat_id) for g in scenario_grades}
        completed_chats = [c for c in scenario_chats if getattr(c, "completed", False) or str(c.id) in graded_chat_ids]
        success_rate = round((len(completed_chats) / max(1, len(scenario_chats))) * 100)
        if scenario_grades:
            avg_score = round((sum(g.score for g in scenario_grades) / len(scenario_grades) / (rubric_points if rubric_points else 100)) * 100)
        else:
            avg_score = 0
        color = "#10b981" if avg_score >= thresholds.get("success", 80) else ("#f59e0b" if avg_score >= thresholds.get("warning", 60) else "#ef4444")
        result.append(
            {
                "scenarioId": str(scenario.id),
                "scenarioName": scenario.name,
                "avgScore": avg_score,
                "successRate": success_rate,
                "performanceChange": 0,
                "totalAttempts": len(scenario_chats),
                "completedAttempts": len(completed_chats),
                "color": color,
            }
        )

    return sorted([r for r in result if r["totalAttempts"] >= 1], key=lambda x: x["avgScore"], reverse=True)


def calculate_simulation_performance(filtered: FilteredData, rubrics: List[Rubrics]) -> Dict[str, Any]:
    if len(filtered.grades) == 0:
        return {"currentValue": 0, "trendData": [], "hasData": False}

    total_score = 0
    total_points = 0
    for g in filtered.grades:
        chat = next((c for c in filtered.chats if str(c.id) == str(g.simulation_chat_id)), None)
        attempt = next((a for a in filtered.attempts if chat and str(a.id) == str(chat.attempt_id)), None)
        simulation = next((s for s in filtered.simulations if attempt and str(s.id) == str(attempt.simulation_id)), None)
        rubric = next((r for r in rubrics if simulation and str(r.id) == str(simulation.rubric_id)), None)
        points = rubric.points if rubric else 100
        total_score += g.score
        total_points += points
    current_value = round((total_score / total_points) * 100) if total_points else 0

    trend_map: Dict[str, Dict[str, Any]] = {}
    for g in filtered.grades:
        chat = next((c for c in filtered.chats if str(c.id) == str(g.simulation_chat_id)), None)
        attempt = next((a for a in filtered.attempts if chat and str(a.id) == str(chat.attempt_id)), None)
        simulation = next((s for s in filtered.simulations if attempt and str(s.id) == str(attempt.simulation_id)), None)
        rubric = next((r for r in rubrics if simulation and str(r.id) == str(simulation.rubric_id)), None)
        points = rubric.points if rubric else 100
        dt = _safe_dt(g.created_at)
        if not dt:
            continue
        key = dt.strftime("%b %d")
        if key not in trend_map:
            trend_map[key] = {"totalScore": 0, "totalPoints": 0, "count": 0}
        trend_map[key]["totalScore"] += g.score
        trend_map[key]["totalPoints"] += points
        trend_map[key]["count"] += 1

    trend_data = [
        {"date": k, "value": round((v["totalScore"] / v["totalPoints"]) * 100) if v["totalPoints"] else 0, "count": v["count"]}
        for k, v in trend_map.items()
    ]
    # naive sort by parsing month-day; acceptable for short spans
    def _parse_md(s: str) -> datetime:
        return datetime.strptime(s, "%b %d")

    trend_data.sort(key=lambda d: _parse_md(d["date"]))
    return {"currentValue": current_value, "trendData": trend_data, "hasData": True}


# --------------------------------------------------------------------------------------
# Primary analytics (ported from client/utils/analytics/primary.ts)
# --------------------------------------------------------------------------------------


def calculate_attempt_improvement(
    filtered: FilteredData, rubrics: List[Rubrics], selected_simulation_ids: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    selected_simulation_ids = selected_simulation_ids or []
    if len(filtered.grades) == 0:
        return []

    filtered_sims = (
        [s for s in filtered.simulations if str(s.id) in set(selected_simulation_ids)]
        if selected_simulation_ids
        else list(filtered.simulations)
    )
    filtered_sim_ids = {str(s.id) for s in filtered_sims}

    # map key (simulationId-profileId) -> attempts list with metrics
    sim_attempts: Dict[str, Dict[str, Any]] = {}
    # We iterate attempts and look up one representative chat + grade
    for attempt in filtered.attempts:
        if str(attempt.simulation_id) not in filtered_sim_ids:
            continue
        chat = next((c for c in filtered.chats if str(c.attempt_id) == str(attempt.id)), None)
        grade = next((g for g in filtered.grades if chat and str(g.simulation_chat_id) == str(chat.id)), None)
        if not chat or not grade:
            continue
        simulation = next((s for s in filtered_sims if str(s.id) == str(attempt.simulation_id)), None)
        if not simulation:
            continue
        key = f"{attempt.simulation_id}-{attempt.profile_id or 'unknown'}"
        if key not in sim_attempts:
            sim_attempts[key] = {
                "simulationId": str(attempt.simulation_id),
                "profileId": str(attempt.profile_id or "unknown"),
                "attempts": [],
            }
        rubric = next((r for r in rubrics if str(r.id) == str(simulation.rubric_id)), None)
        total = rubric.points if rubric else 100
        score_pct = round((grade.score / (total if total else 100)) * 100)
        sim_attempts[key]["attempts"].append(
            {
                "attemptId": str(attempt.id),
                "attemptNumber": len(sim_attempts[key]["attempts"]) + 1,
                "score": score_pct,
                "timeTaken": getattr(grade, "time_taken", 0),
                "passed": getattr(grade, "passed", False),
                "createdAt": _safe_dt(grade.created_at) or datetime.min,
            }
        )

    all_sims = [v for v in sim_attempts.values() if len(v["attempts"]) > 0]
    if not all_sims:
        return []

    max_attempts = min(max(len(v["attempts"]) for v in all_sims), 5)
    metrics: Dict[int, Dict[str, Any]] = {i: {"scores": [], "times": [], "passRates": [], "count": 0} for i in range(1, max_attempts + 1)}
    for v in all_sims:
        for att in v["attempts"][:max_attempts]:
            m = metrics[att["attemptNumber"]]
            m["scores"].append(att["score"])
            m["times"].append(att["timeTaken"] / 60)
            m["passRates"].append(100 if att["passed"] else 0)
            m["count"] += 1

    chart = []
    for i in range(1, max_attempts + 1):
        m = metrics[i]
        if m["count"] == 0:
            continue
        avg_score = round(sum(m["scores"]) / len(m["scores"]))
        avg_time = round(sum(m["times"]) / len(m["times"]))
        avg_pass = round(sum(m["passRates"]) / len(m["passRates"]))
        chart.append({"attempt": f"Attempt {i}", "Average Score": avg_score, "Average Time": avg_time, "Pass Rate": avg_pass})
    return chart


def calculate_platform_growth(filtered: FilteredData, rubrics: List[Rubrics]) -> List[Dict[str, Any]]:
    if len(filtered.grades) == 0:
        return []

    daily: Dict[str, Dict[str, Any]] = {}
    for g in filtered.grades:
        dt = _safe_dt(g.created_at)
        if not dt:
            continue
        date_key = dt.strftime("%Y-%m-%d")
        chat = next((c for c in filtered.chats if str(c.id) == str(g.simulation_chat_id)), None)
        attempt = next((a for a in filtered.attempts if chat and str(a.id) == str(chat.attempt_id)), None)
        simulation = next((s for s in filtered.simulations if attempt and str(s.id) == str(attempt.simulation_id)), None)
        rubric = next((r for r in rubrics if simulation and str(r.id) == str(simulation.rubric_id)), None)
        total = rubric.points if rubric else 100
        score_pct = round((g.score / (total if total else 100)) * 100)

        if date_key not in daily:
            daily[date_key] = {
                "date": dt.strftime("%b %d"),
                "scores": [],
                "passed": 0,
                "total": 0,
                "completed": 0,
                "timeTaken": [],
                "messages": [],
                "responseTimes": [],
                "attempts": [],
                "firstAttempts": [],
            }
        day = daily[date_key]
        day["scores"].append(score_pct)
        day["total"] += 1
        day["timeTaken"].append(getattr(g, "time_taken", 0))
        if getattr(g, "passed", False):
            day["passed"] += 1
        if chat and getattr(chat, "completed", False):
            day["completed"] += 1
        # placeholders per TS
        day["messages"].append(0)
        day["responseTimes"].append(0)
        day["attempts"].append(1)

        # first attempt detection
        is_first = not any(
            str(a.profile_id) == str(attempt.profile_id)
            and str(a.simulation_id) == str(attempt.simulation_id)
            and (_safe_dt(a.created_at) or datetime.max) < (_safe_dt(attempt.created_at) or datetime.max)
            for a in filtered.attempts
        ) if attempt else False
        if is_first and attempt:
            day["firstAttempts"].append({
                "profileId": str(attempt.profile_id or ""),
                "simulationId": str(attempt.simulation_id or ""),
                "attemptId": str(attempt.id or ""),
                "createdAt": _safe_dt(attempt.created_at) or dt,
                "passed": getattr(g, "passed", False),
            })

    growth = []
    for date_key, day in daily.items():
        scores = day["scores"]
        avg_score = round(sum(scores) / len(scores)) if scores else 0
        completion_rate = round((day["completed"] / day["total"]) * 100) if day["total"] else 0
        first_attempts: List[Dict[str, Any]] = day["firstAttempts"]
        first_pass_rate = round((len([a for a in first_attempts if a["passed"]]) / len(first_attempts)) * 100) if first_attempts else 0
        highest_score = max(scores) if scores else 0
        messages_per_session = round(sum(cast(List[int], day["messages"])) / len(day["messages"])) if day["messages"] else 0
        persona_response_times = round(sum(cast(List[int], day["responseTimes"])) / len(day["responseTimes"])) if day["responseTimes"] else 0
        avg_time_minutes = (sum(cast(List[float], day["timeTaken"])) / len(day["timeTaken"]) / 60) if day["timeTaken"] else 1
        session_efficiency = round((avg_score / avg_time_minutes) * 10) if avg_time_minutes > 0 else 0
        # simplified variance to stagnation rate
        variance: float = 0.0
        if len(scores) > 1:
            mean = sum(scores) / len(scores)
            variance = sqrt(sum((s - mean) ** 2 for s in scores) / (len(scores) - 1))
        stagnation_rate = round(min((variance / 10), 100))
        time_spent = round(avg_time_minutes)
        total_attempts = int(sum(cast(List[int], day["attempts"])) if day["attempts"] else 0)
        growth.append(
            {
                "date": day["date"],
                "averageScore": avg_score,
                "passRate": first_pass_rate,
                "completionRate": completion_rate,
                "firstAttemptPassRate": first_pass_rate,
                "messagesPerSession": messages_per_session,
                "personaResponseTimes": persona_response_times,
                "sessionEfficiency": session_efficiency,
                "stagnationRate": stagnation_rate,
                "timeSpent": time_spent,
                "totalAttempts": total_attempts,
                # legacy
                "avgScore": avg_score,
                "completionPercentage": completion_rate,
                "highestScore": highest_score,
            }
        )

    # normalize efficiency 0-100
    if growth:
        max_eff = max(metric["sessionEfficiency"] for metric in growth)
        min_eff = min(metric["sessionEfficiency"] for metric in growth)
        rng = max_eff - min_eff
        if rng > 0:
            for metric in growth:
                metric["sessionEfficiency"] = round(((metric["sessionEfficiency"] - min_eff) / rng) * 100)

    growth.sort(key=lambda metric: _parse_month_day(cast(str, metric["date"])))
    return growth


def calculate_persona_performance(
    filtered: FilteredData,
    rubrics: List[Rubrics],
    personas: List[Personas],
    scenarios: List[Scenarios],
    selected_simulation_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    if not personas or not scenarios or len(filtered.grades) == 0:
        return []
    selected_simulation_ids = selected_simulation_ids or []
    filtered_sim_ids = set(selected_simulation_ids) if selected_simulation_ids else {str(s.id) for s in filtered.simulations}

    data: List[Dict[str, Any]] = []
    for persona in personas:
        persona_scens = [s for s in scenarios if str(s.persona_id) == str(persona.id)]
        persona_chats = [c for c in filtered.chats if any(str(s.id) == str(c.scenario_id) for s in persona_scens)]
        # Filter chats by selected simulations
        if selected_simulation_ids:
            persona_chats = [
                c
                for c in persona_chats
                if any(
                    str(a.id) == str(c.attempt_id) and str(a.simulation_id) in filtered_sim_ids
                    for a in filtered.attempts
                )
            ]
        persona_grades = [g for g in filtered.grades if any(str(g.simulation_chat_id) == str(c.id) for c in persona_chats)]

        avg_score = 0
        if persona_grades:
            percent_sum = sum(
                _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts)
                for g in persona_grades
            )
            avg_score = round(percent_sum / len(persona_grades))

        trend: List[Dict[str, Any]] = [
            {
                "date": (_safe_dt(g.created_at) or datetime.min).strftime("%b %d"),
                "score": _grade_percent(g, rubrics, filtered.simulations, filtered.chats, filtered.attempts),
                "timestamp": int(((_safe_dt(g.created_at) or datetime.min).timestamp()) * 1000),
            }
            for g in persona_grades
        ]
        trend.sort(key=lambda x: cast(int, x["timestamp"]))

        if len(persona_grades) > 0:
            data.append(
                {
                    "name": persona.name,
                    "score": avg_score,
                    "sessions": len(persona_grades),
                    "color": getattr(persona, "color", "#999999"),
                    "trendData": trend,
                }
            )

    data.sort(key=lambda x: x["score"], reverse=True)
    return data


# --------------------------------------------------------------------------------------
# Secondary analytics (ported from client/utils/analytics/secondary.ts)
# --------------------------------------------------------------------------------------


def calculate_cohort_performance(
    filtered: FilteredData,
    rubrics: List[Rubrics],
    thresholds: Dict[str, int],
    selected_simulation_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    selected_simulation_ids = selected_simulation_ids or []
    filtered_cohorts = [c for c in filtered.cohorts if getattr(c, "active", False)]
    if not filtered_cohorts:
        return {"cohortData": [], "dailyData": [], "insights": None, "hasData": False}

    stats: Dict[str, Dict[str, Any]] = {}
    for cohort in filtered_cohorts:
        available_sim_ids = (
            [sid for sid in (cohort.simulation_ids or []) if str(sid) in set(selected_simulation_ids)]
            if selected_simulation_ids
            else (cohort.simulation_ids or [])
        )
        cohort_rubric_points = 0
        cohort_rubric_pass = 0
        first_sim = next((s for s in filtered.simulations if str(s.id) in {str(x) for x in available_sim_ids}), None)
        if first_sim:
            rub = next((r for r in rubrics if str(r.id) == str(first_sim.rubric_id)), None)
            if rub:
                cohort_rubric_points = getattr(rub, "points", 0)
                cohort_rubric_pass = getattr(rub, "pass_points", 0)
        total_students = set()
        for pid in (cohort.profile_ids or []):
            if any(str(p.id) == str(pid) for p in filtered.profiles):
                total_students.add(str(pid))
        stats[str(cohort.id)] = {
            "totalAttempts": 0,
            "passedAttempts": 0,
            "totalStudents": total_students,
            "passedStudents": set(),
            "totalScores": [],
            "rubricPoints": cohort_rubric_points,
            "rubricPassPoints": cohort_rubric_pass,
            "studentSimulationPasses": {},
            "availableSimulations": set(str(sid) for sid in available_sim_ids),
        }

    for grade in filtered.grades:
        chat = next((c for c in filtered.chats if str(c.id) == str(grade.simulation_chat_id)), None)
        attempt = next((a for a in filtered.attempts if chat and str(a.id) == str(chat.attempt_id)), None)
        profile = next((p for p in filtered.profiles if attempt and str(p.id) == str(attempt.profile_id)), None)
        rubric = next((r for r in rubrics if str(r.id) == str(grade.rubric_id)), None)
        simulation = next((s for s in filtered.simulations if attempt and str(s.id) == str(attempt.simulation_id)), None)
        if not (profile and rubric and simulation):
            continue
        cohort_match: Optional[Cohorts] = next((c for c in filtered_cohorts if str(profile.id) in {str(pid) for pid in (c.profile_ids or [])}), None)
        if not cohort_match:
            continue
        cohort = cohort_match
        if str(simulation.id) not in {str(sid) for sid in (cohort.simulation_ids or [])}:
            continue
        cdata = stats[str(cohort.id)]
        cdata["totalAttempts"] += 1
        normalized = round((grade.score / (rubric.points if rubric.points else 100)) * 100)
        cdata["totalScores"].append(normalized)
        if cdata["rubricPoints"] == 0 or cdata["rubricPoints"] != rubric.points:
            cdata["rubricPoints"] = rubric.points
            cdata["rubricPassPoints"] = rubric.pass_points
        passed = grade.score >= rubric.pass_points
        if passed:
            cdata["passedAttempts"] += 1
            sim_passes = cdata["studentSimulationPasses"].setdefault(str(profile.id), set())
            sim_passes.add(str(simulation.id))

    # determine passedStudents for all simulations relevant
    for cohort in filtered_cohorts:
        cdata = stats[str(cohort.id)]
        if selected_simulation_ids:
            to_check = set(selected_simulation_ids)
        else:
            to_check = set(str(sid) for sid in (cohort.simulation_ids or []))
        for pid in (cohort.profile_ids or []):
            sid_set = cdata["studentSimulationPasses"].get(str(pid), set())
            if to_check and to_check.issubset(sid_set):
                cdata["passedStudents"].add(str(pid))

    cohort_data: List[Dict[str, Any]] = []
    for cohort in filtered_cohorts:
        cdata = stats[str(cohort.id)]
        pass_rate = round((len(cdata["passedStudents"]) / len(cdata["totalStudents"])) * 100) if cdata["totalStudents"] else 0
        avg_percent = round(sum(cdata["totalScores"]) / len(cdata["totalScores"])) if cdata["totalScores"] else 0
        if pass_rate >= thresholds.get("success", 80):
            color = "#10b981"
        elif pass_rate >= thresholds.get("warning", 60):
            color = "#f59e0b"
        else:
            color = "#ef4444"
        cohort_data.append(
            {
                "id": str(cohort.id),
                "name": getattr(cohort, "title", "Unknown Cohort"),
                "passRate": pass_rate,
                "avgPercentageScore": avg_percent,
                "totalStudents": len(cdata["totalStudents"]),
                "passedStudents": len(cdata["passedStudents"]),
                "totalAttempts": cdata["totalAttempts"],
                "passedAttempts": cdata["passedAttempts"],
                "rubricPoints": cdata["rubricPoints"],
                "rubricPassPoints": cdata["rubricPassPoints"],
                "availableSimulations": len(cdata["availableSimulations"]),
                "color": color,
            }
        )
    if selected_simulation_ids:
        cohort_data = [c for c in cohort_data if c["availableSimulations"] > 0]
    cohort_data.sort(key=lambda x: x["passRate"], reverse=True)

    insights: Optional[str] = None
    if cohort_data:
        avg_pass_rate = sum(c["passRate"] for c in cohort_data) / len(cohort_data)
        if avg_pass_rate < thresholds.get("warning", 60):
            insights = f"Overall cohort performance is below expectations ({avg_pass_rate:.2f}% average pass rate). Consider additional training sessions or one-on-one support."
        elif avg_pass_rate >= thresholds.get("success", 80):
            insights = f"Overall cohort performance is excellent ({avg_pass_rate:.2f}% average pass rate). Consider advancing to more challenging scenarios."
        else:
            insights = f"Overall cohort performance is adequate ({avg_pass_rate:.2f}% average pass rate). Monitor progress and provide targeted feedback."

    return {
        "cohortData": cohort_data,
        "dailyData": [],
        "insights": insights,
        "hasData": bool(cohort_data and any(c["totalStudents"] > 0 for c in cohort_data)),
    }


def calculate_skill_performance(
    filtered: FilteredData,
    standards: List[Standards],
    standard_groups: List[StandardGroups],
    rubrics: List[Rubrics],
    selected_rubric_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    selected_rubric_ids = selected_rubric_ids or []
    filtered_rubrics = (
        rubrics if not selected_rubric_ids else [r for r in rubrics if str(r.id) in set(selected_rubric_ids)]
    )
    if not filtered_rubrics:
        return {"radarData": [], "hasData": False}

    # Filter feedbacks to grades in filtered set
    filtered_feedbacks = [f for f in filtered.feedbacks if any(str(g.id) == str(f.simulation_chat_grade_id) for g in filtered.grades)]

    # aggregate per group
    group_perf: Dict[str, Dict[str, Any]] = {}
    for group in standard_groups:
        group_standards = [s for s in standards if str(s.standard_group_id) == str(group.id)]
        group_feedbacks = [
            f for f in filtered_feedbacks if any(str(s.id) == str(f.standard_id) for s in group_standards)
        ]
        if group_feedbacks:
            # group by grade id
            by_grade: Dict[str, List[SimulationChatFeedbacks]] = {}
            for f in group_feedbacks:
                by_grade.setdefault(str(f.simulation_chat_grade_id), []).append(f)
            user_perfs: List[float] = []
            for grade_id, fbs in by_grade.items():
                user_total = sum(getattr(f, "total", 0) for f in fbs)
                user_percentage = (user_total / (group.points if group.points else 1)) * 100 if group.points else 0
                user_perfs.append(user_percentage)
            avg_perf = round(sum(user_perfs) / len(user_perfs)) if user_perfs else 0
            avg_score = ((avg_perf / 100) * group.points) if group.points else 0
            group_perf[group.short_name or group.name] = {
                "percentage": avg_perf,
                "score": avg_score,
                "points": group.points,
            }
        else:
            group_perf[group.short_name or group.name] = {"percentage": 0, "score": 0, "points": group.points}

    radar_data = [
        {
            "metric": (g.short_name or g.name),
            "value": (group_perf[g.short_name or g.name]["score"] / group_perf[g.short_name or g.name]["points"]) if group_perf[g.short_name or g.name]["points"] else 0,
            "fullMark": 1,
            "score": group_perf[g.short_name or g.name]["score"],
            "points": group_perf[g.short_name or g.name]["points"],
        }
        for g in standard_groups
        if (g.short_name or g.name) in group_perf
    ]

    return {"radarData": radar_data, "hasData": bool(radar_data and any(s["value"] > 0 for s in radar_data))}


def calculate_rubric_heatmap(
    filtered: FilteredData,
    standards: List[Standards],
    standard_groups: List[StandardGroups],
    rubrics: List[Rubrics],
    selected_rubric_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    selected_rubric_ids = selected_rubric_ids or []
    filtered_rubrics = (
        rubrics if not selected_rubric_ids else [r for r in rubrics if str(r.id) in set(selected_rubric_ids)]
    )
    if not filtered_rubrics:
        return {"matrix": [], "insights": None, "standardGroups": [], "hasData": False}

    filtered_feedbacks = [f for f in filtered.feedbacks if any(str(g.id) == str(f.simulation_chat_grade_id) for g in filtered.grades)]

    std_groups_to_show = standard_groups if len(standard_groups) >= 2 else []
    if len(std_groups_to_show) < 2:
        return {"matrix": [], "insights": None, "standardGroups": [], "hasData": False}

    # prepare matrix with defaults
    matrix: List[List[Dict[str, Any]]] = []
    for i in range(len(std_groups_to_show)):
        row: List[Dict[str, Any]] = []
        for j in range(len(std_groups_to_show)):
            row.append({"correlation": 0, "pValue": 1, "color": "#e5e7eb", "strength": "No Data", "dataPoints": 0})
        matrix.append(row)

    for i, g1 in enumerate(std_groups_to_show):
        for j, g2 in enumerate(std_groups_to_show):
            # collect grades that have feedback for both groups
            grades_with_both = []
            for grade in filtered.grades:
                grade_feedbacks = [f for f in filtered_feedbacks if str(f.simulation_chat_grade_id) == str(grade.id)]
                has_g1 = any((s for s in standards if str(s.id) in {str(f.standard_id) for f in grade_feedbacks} and str(s.standard_group_id) == str(g1.id)))
                has_g2 = any((s for s in standards if str(s.id) in {str(f.standard_id) for f in grade_feedbacks} and str(s.standard_group_id) == str(g2.id)))
                if has_g1 and has_g2:
                    grades_with_both.append(grade)
            if len(grades_with_both) < 3:
                continue
            scores1: List[float] = []
            scores2: List[float] = []
            for grade in grades_with_both:
                fb1 = [f for f in filtered_feedbacks if str(f.simulation_chat_grade_id) == str(grade.id) and any(str(s.id) == str(f.standard_id) and str(s.standard_group_id) == str(g1.id) for s in standards)]
                fb2 = [f for f in filtered_feedbacks if str(f.simulation_chat_grade_id) == str(grade.id) and any(str(s.id) == str(f.standard_id) and str(s.standard_group_id) == str(g2.id) for s in standards)]
                if fb1 and fb2:
                    rubric = next((r for r in filtered_rubrics if str(r.id) == str(grade.rubric_id)), None)
                    total_points = rubric.points if rubric else 100
                    avg1 = (sum(getattr(f, "total", 0) for f in fb1) / len(fb1))
                    avg2 = (sum(getattr(f, "total", 0) for f in fb2) / len(fb2))
                    scores1.append((avg1 / total_points) * 100)
                    scores2.append((avg2 / total_points) * 100)
            if len(scores1) >= 3:
                corr = _pearson(scores1, scores2)
                pv = _p_value(corr, len(scores1))
                abs_corr = abs(corr)
                color = "#e5e7eb"
                strength = "Weak"
                if abs_corr >= 0.7:
                    color = "#10b981" if corr > 0 else "#ef4444"
                    strength = "Strong"
                elif abs_corr >= 0.5:
                    color = "#34d399" if corr > 0 else "#f87171"
                    strength = "Moderate"
                elif abs_corr >= 0.3:
                    color = "#6ee7b7" if corr > 0 else "#fca5a5"
                    strength = "Weak"
                matrix[i][j] = {"correlation": round(corr, 2), "pValue": pv, "color": color, "strength": strength, "dataPoints": len(scores1)}

    # insights
    insights: Optional[str] = None
    strongest_pos = {"correlation": 0, "i": -1, "j": -1}
    strongest_neg = {"correlation": 0, "i": -1, "j": -1}
    for i in range(len(std_groups_to_show)):
        for j in range(i + 1, len(std_groups_to_show)):
            cell = matrix[i][j]
            if cell["correlation"] > strongest_pos["correlation"]:
                strongest_pos = {"correlation": cell["correlation"], "i": i, "j": j}
            if cell["correlation"] < strongest_neg["correlation"]:
                strongest_neg = {"correlation": cell["correlation"], "i": i, "j": j}
    if strongest_pos["i"] != -1 and strongest_pos["correlation"] > 0.5:
        g1 = std_groups_to_show[strongest_pos["i"]]
        g2 = std_groups_to_show[strongest_pos["j"]]
        insights = f"Strong positive correlation ({strongest_pos['correlation']}) between \"{g1.short_name}\" and \"{g2.short_name}\". Students who excel in one skill area tend to excel in the other."
    elif strongest_neg["i"] != -1 and strongest_neg["correlation"] < -0.5:
        g1 = std_groups_to_show[strongest_neg["i"]]
        g2 = std_groups_to_show[strongest_neg["j"]]
        insights = f"Strong negative correlation ({strongest_neg['correlation']}) between \"{g1.short_name}\" and \"{g2.short_name}\". Consider if these skill areas are competing for attention."
    else:
        insights = "Most skill area correlations are moderate. Skill areas appear to be relatively independent."

    return {"matrix": matrix, "insights": insights, "standardGroups": [
        {"id": str(g.id), "name": g.name, "shortName": g.short_name, "points": g.points} for g in std_groups_to_show
    ], "hasData": bool(matrix and std_groups_to_show)}


# --------------------------------------------------------------------------------------
# Internal math helpers
# --------------------------------------------------------------------------------------


def _is_float(value: Any) -> bool:
    try:
        float(value)
        return True
    except Exception:
        return False


def _pearson(x: List[float], y: List[float]) -> float:
    if len(x) != len(y) or len(x) == 0:
        return 0.0
    n = len(x)
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_x2 = sum(xi * xi for xi in x)
    sum_y2 = sum(yi * yi for yi in y)
    numerator = n * sum_xy - sum_x * sum_y
    denom = sqrt(max((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y), 0))
    return (numerator / denom) if denom != 0 else 0.0


def _p_value(correlation: float, n: int) -> float:
    if n < 3:
        return 1.0
    # Approximate two-tailed p-value using t-stat heuristic (consistent with TS placeholder)
    t_stat = correlation * sqrt((n - 2) / max(1 - correlation * correlation, 1e-12))
    # Heuristic mapping as in TS: 2 * (1 - |t| / sqrt(t^2 + n - 2))
    denom = sqrt(t_stat * t_stat + n - 2)
    return max(0.0, min(1.0, 2 * (1 - abs(t_stat) / denom)))


def _parse_month_day(s: str) -> datetime:
    try:
        return datetime.strptime(s, "%b %d")
    except Exception:
        return datetime.min


