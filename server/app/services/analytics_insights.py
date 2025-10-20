"""
Actionable insights computation service for analytics.

Ported from client/lib/analytics.ts to compute insights on the server.
"""

from app.schemas.analytics import (
    AttemptImprovementData,
    CohortData,
    GrowthWindowAverages,
    NumericAttemptFact,
    PersonaTrendData,
    RubricMatrixPackage,
    ScenarioAttributeAttemptFact,
    ScenarioFact,
    SimulationFact,
    SkillRadarData,
)


def compute_growth_actionable_insight(
    window_averages: GrowthWindowAverages,
) -> str | None:
    """
    Compute actionable insight for growth data.

    Args:
        window_averages: Window averages from growth data

    Returns:
        Actionable insight string or None
    """
    current = window_averages.averageScore.last
    previous = window_averages.averageScore.prev

    # treat 0 as valid; only None means missing
    if current is None:
        return None

    # If we have both current and previous, analyze trends
    if previous is not None:
        improvement = current - previous

        if improvement < -5:
            return f"Performance declined {abs(improvement):.1f}% - review challenging areas."

        if improvement > 5:
            return f"Scores improved {improvement:.1f}% - consider advanced challenges."

        if improvement > 2:
            return (
                f"Steady improvement of {improvement:.1f}% - continue current approach."
            )

        if improvement < -2:
            return f"Slight decline of {abs(improvement):.1f}% - adjust study strategy."

    return None


def compute_persona_multiple_actionable_insights(
    trend_data: list[PersonaTrendData],
    persona_name: str,
    current_score: float,
) -> dict[str, str | None]:
    """
    Compute multiple actionable insights for a persona.

    Args:
        trend_data: Persona trend data points
        persona_name: Name of the persona
        current_score: Current performance score

    Returns:
        Dictionary with "insight" key containing the most relevant insight
    """
    insights: dict[str, str | None] = {}

    if len(trend_data) < 2:
        return insights

    recent_scores = trend_data[-3:]
    earlier_scores = trend_data[:3]

    if len(recent_scores) == 0 or len(earlier_scores) == 0:
        return insights

    recent_avg = sum(item.score or 0 for item in recent_scores) / len(recent_scores)
    earlier_avg = sum(item.score or 0 for item in earlier_scores) / len(earlier_scores)
    improvement = recent_avg - earlier_avg

    # Return the most impactful single insight
    if improvement > 5:
        insights["insight"] = (
            f"Performance improved {round(improvement)}% recently - "
            "consider advancing to more challenging scenarios."
        )
    elif improvement < -5:
        insights["insight"] = (
            f"Performance declined {round(abs(improvement))}% recently - "
            "review training approach."
        )
    elif current_score >= 90:
        insights["insight"] = (
            f"Excellent performance at {round(current_score)}% - "
            "maintain high standards."
        )
    elif current_score < 60:
        insights["insight"] = (
            f"Performance at {round(current_score)}% needs attention - "
            "review fundamentals."
        )

    return insights


def compute_rubric_heatmap_actionable_insight(
    matrices: list[RubricMatrixPackage],
) -> str | None:
    """
    Compute actionable insight from rubric heatmap data.

    Args:
        matrices: List of rubric matrix packages

    Returns:
        Actionable insight string or None
    """
    if len(matrices) == 0:
        return None

    # Use the first matrix for insight calculation
    matrix = matrices[0]
    if not matrix or not matrix.hasData:
        return None

    # Find the strongest positive and negative correlations
    strongest_positive_corr = 0.0
    strongest_positive_pair = ""
    strongest_negative_corr = 0.0
    strongest_negative_pair = ""

    for i, row in enumerate(matrix.matrix):
        for j, cell in enumerate(row):
            if i != j and cell and cell.dataPoints > 0:
                correlation = cell.correlation
                row_group = (
                    matrix.standardGroups[i] if i < len(matrix.standardGroups) else None
                )
                col_group = (
                    matrix.standardGroups[j] if j < len(matrix.standardGroups) else None
                )

                if row_group and col_group:
                    pair = f"{row_group.shortName} ↔ {col_group.shortName}"

                    if correlation > strongest_positive_corr:
                        strongest_positive_corr = correlation
                        strongest_positive_pair = pair
                    if correlation < strongest_negative_corr:
                        strongest_negative_corr = correlation
                        strongest_negative_pair = pair

    # Generate insight based on strongest correlation
    if strongest_positive_corr > 0.7:
        return f"Strong positive correlation: {strongest_positive_pair} ({strongest_positive_corr:.2f}). Skills develop together."
    elif strongest_negative_corr < -0.5:
        return f"Negative correlation: {strongest_negative_pair} ({strongest_negative_corr:.2f}). May indicate trade-offs."

    return None


def compute_attempt_improvement_actionable_insight(
    chart_data: list[AttemptImprovementData],
) -> str | None:
    """
    Compute actionable insight from attempt improvement data.

    Args:
        chart_data: List of attempt improvement data points

    Returns:
        Actionable insight string or None
    """
    if len(chart_data) < 2:
        return None

    first_attempt = chart_data[0]
    last_attempt = chart_data[-1]

    if not first_attempt or not last_attempt:
        return None

    first_score = first_attempt.average_score
    last_score = last_attempt.average_score

    score_improvement = last_score - first_score

    if score_improvement > 5:
        return f"Users improve by {score_improvement}% on average between attempts. Consider advancing to more challenging scenarios."
    elif score_improvement < -5:
        return f"Performance declined by {abs(score_improvement)}% between attempts. Review training approach."

    return None


def compute_cohort_multiple_actionable_insights(
    cohort_data: list[CohortData],
) -> dict[str, dict[str, str | None]]:
    """
    Compute multiple actionable insights for cohorts.

    Args:
        cohort_data: List of cohort data

    Returns:
        Dictionary mapping cohort_id to insights dict with "insight" key
    """
    insights: dict[str, dict[str, str | None]] = {}

    if len(cohort_data) == 0:
        return insights

    # Sort cohorts by performance
    sorted_cohorts = sorted(cohort_data, key=lambda c: c.passRate, reverse=True)
    avg_pass_rate = sum(cohort.passRate for cohort in cohort_data) / len(cohort_data)

    # Check if all cohorts are high performers
    high_performers = [c for c in cohort_data if c.passRate >= 90]
    all_high_performers = len(high_performers) == len(cohort_data)

    # Generate single focused insight for each cohort
    for cohort in cohort_data:
        cohort_insights: dict[str, str | None] = {}
        rank = next(
            (i + 1 for i, c in enumerate(sorted_cohorts) if c.id == cohort.id), 0
        )
        pass_rate_diff = cohort.passRate - avg_pass_rate

        # Return the most impactful single insight
        if cohort.passRate >= 95:
            if all_high_performers:
                cohort_insights["insight"] = (
                    f"Outstanding performance at {round(cohort.passRate)}% - "
                    "maintain excellence and mentor others."
                )
            else:
                cohort_insights["insight"] = (
                    f"Leading performance at {round(cohort.passRate)}% (rank {rank}) - "
                    "share successful strategies with other cohorts."
                )
        elif cohort.passRate >= 80:
            if pass_rate_diff > 5:
                cohort_insights["insight"] = (
                    f"Strong performance at {round(cohort.passRate)}% - "
                    f"{abs(round(pass_rate_diff))}% above average."
                )
            elif pass_rate_diff < -5:
                cohort_insights["insight"] = (
                    f"Good performance at {round(cohort.passRate)}% but "
                    f"{abs(round(pass_rate_diff))}% below average - opportunities for improvement."
                )
        elif cohort.passRate >= 60:
            cohort_insights["insight"] = (
                f"Moderate performance at {round(cohort.passRate)}% - "
                "focus on fundamentals to improve outcomes."
            )
        elif cohort.passRate < 60:
            cohort_insights["insight"] = (
                f"Performance at {round(cohort.passRate)}% needs attention - "
                "review training materials and provide additional support."
            )

        insights[cohort.id] = cohort_insights

    return insights


def compute_skill_performance_actionable_insight(
    radar_data: list[SkillRadarData],
) -> str | None:
    """
    Compute actionable insight from skill performance radar data.

    Args:
        radar_data: List of skill radar data points

    Returns:
        Actionable insight string or None
    """
    if len(radar_data) == 0:
        return None

    # Calculate skill statistics
    values = [skill.value for skill in radar_data]
    avg_proficiency = sum(values) / len(values)
    min_proficiency = min(values)
    max_proficiency = max(values)
    skill_gap = max_proficiency - min_proficiency

    # Find skills by performance level
    weak_skills = [skill for skill in radar_data if skill.value < 0.5]
    strong_skills = [skill for skill in radar_data if skill.value >= 0.8]

    # Significant skill gaps
    if skill_gap > 0.4:
        weakest_skill = min(radar_data, key=lambda s: s.value)
        return f"Large skill gap - focus on {weakest_skill.metric} ({round(weakest_skill.value * 100)}%)."

    # Multiple weak skills
    if len(weak_skills) > 1:
        return "Multiple weak areas - focus on fundamentals."

    # Single weak skill
    if len(weak_skills) == 1:
        return f"Focus on improving {weak_skills[0].metric} to balance skillset."

    # All skills strong
    if len(strong_skills) == len(radar_data):
        return f"Excellent proficiency across all skills (avg {round(avg_proficiency * 100)}%)."

    return None


def compute_scenario_performance_actionable_insight(
    attribute_attempt_facts: list[ScenarioAttributeAttemptFact],
) -> str | None:
    """
    Compute actionable insight from scenario performance data.

    Args:
        attribute_attempt_facts: List of scenario attribute attempt facts

    Returns:
        Actionable insight string or None
    """
    if len(attribute_attempt_facts) == 0:
        return None

    # Find the parameter item with the highest average score
    by_parameter_item: dict[str, dict[str, float]] = {}

    for fact in attribute_attempt_facts:
        key = fact.parameterItemId
        if key not in by_parameter_item:
            by_parameter_item[key] = {"totalScore": 0.0, "totalAttempts": 0.0}

        by_parameter_item[key]["totalScore"] += fact.avgScore * fact.attempts
        by_parameter_item[key]["totalAttempts"] += fact.attempts

    # Calculate average scores
    avg_scores = {
        key: data["totalScore"] / data["totalAttempts"]
        if data["totalAttempts"] > 0
        else 0
        for key, data in by_parameter_item.items()
    }

    if len(avg_scores) == 0:
        return None

    best_param_item = max(avg_scores.items(), key=lambda x: x[1])
    worst_param_item = min(avg_scores.items(), key=lambda x: x[1])

    # Check for significant performance gaps
    if best_param_item[1] - worst_param_item[1] > 20:
        return f"Performance varies significantly by scenario attributes ({best_param_item[1] - worst_param_item[1]:.0f}% gap). Review challenging scenarios."

    return None


def compute_scenario_stats_actionable_insight(
    numeric_attempt_facts: list[NumericAttemptFact],
) -> str | None:
    """
    Compute actionable insight from scenario stats data.

    Args:
        numeric_attempt_facts: List of numeric attempt facts

    Returns:
        Actionable insight string or None
    """
    if len(numeric_attempt_facts) == 0:
        return None

    # Calculate correlation between level value and score
    total_correlation = 0.0
    correlation_count = 0

    # Group by parameter to calculate correlation for each
    by_parameter: dict[str, list[NumericAttemptFact]] = {}
    for fact in numeric_attempt_facts:
        if fact.parameterId not in by_parameter:
            by_parameter[fact.parameterId] = []
        by_parameter[fact.parameterId].append(fact)

    for facts in by_parameter.values():
        if len(facts) < 2:
            continue

        # Simple correlation calculation
        n = len(facts)
        sum_x = sum(f.levelValue for f in facts)
        sum_y = sum(f.score for f in facts)
        sum_xy = sum(f.levelValue * f.score for f in facts)
        sum_xx = sum(f.levelValue * f.levelValue for f in facts)
        sum_yy = sum(f.score * f.score for f in facts)

        denominator = (
            (n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)
        ) ** 0.5
        if denominator > 0:
            correlation = (n * sum_xy - sum_x * sum_y) / denominator
            total_correlation += correlation
            correlation_count += 1

    if correlation_count > 0:
        avg_correlation = total_correlation / correlation_count

        if avg_correlation > 0.5:
            return "Higher difficulty levels correlate with better performance - consider increasing challenge."
        elif avg_correlation < -0.5:
            return "Performance decreases at higher difficulty - review training progression."

    return None


def compute_simulation_performance_actionable_insight(
    scenario_facts: list[ScenarioFact],
) -> str | None:
    """
    Compute actionable insight from simulation performance data.

    Args:
        scenario_facts: List of scenario facts

    Returns:
        Actionable insight string or None
    """
    if len(scenario_facts) == 0:
        return None

    # Find the best and worst performing scenarios
    sorted_by_score = sorted(scenario_facts, key=lambda s: s.avgScore, reverse=True)
    best = sorted_by_score[0] if sorted_by_score else None
    worst = sorted_by_score[-1] if sorted_by_score else None

    if best and worst and best.avgScore > worst.avgScore:
        score_diff = best.avgScore - worst.avgScore
        if score_diff > 20:
            return f"Performance gap of {round(score_diff)}% between best ({best.scenarioName}) and worst ({worst.scenarioName}) scenarios. Consider rebalancing difficulty."

    # Check for low success rates
    low_success = [s for s in scenario_facts if s.successRate < 50]
    if len(low_success) > 0:
        return f"{len(low_success)} scenario(s) have success rates below 50%. Review these scenarios for potential improvements."

    return None


def compute_simulation_composition_actionable_insight(
    simulation_facts: list[SimulationFact],
) -> str | None:
    """
    Compute actionable insight from simulation composition data.

    Args:
        simulation_facts: List of simulation facts

    Returns:
        Actionable insight string or None
    """
    if not simulation_facts or len(simulation_facts) == 0:
        return None

    # Calculate performance statistics
    avg_score = sum(sim.avgScore for sim in simulation_facts) / len(simulation_facts)
    avg_completion = sum(sim.completionRate for sim in simulation_facts) / len(
        simulation_facts
    )

    # Find top and bottom performers
    sorted_by_score = sorted(simulation_facts, key=lambda s: s.avgScore, reverse=True)
    top_performer = sorted_by_score[0] if sorted_by_score else None
    bottom_performer = sorted_by_score[-1] if sorted_by_score else None

    # Performance gap analysis
    if top_performer and bottom_performer:
        performance_gap = top_performer.avgScore - bottom_performer.avgScore

        if performance_gap > 30:
            return (
                f"Significant performance gap ({performance_gap:.0f}%) between "
                f'top performer "{top_performer.title}" ({top_performer.avgScore}%) '
                f'and bottom performer "{bottom_performer.title}" ({bottom_performer.avgScore}%). '
                "Consider analyzing composition differences."
            )

    # Low completion rates
    if avg_completion < 60:
        return f"Average completion rate is {avg_completion:.0f}%. Consider reviewing simulation length and difficulty."

    # Low scores
    if avg_score < 60:
        return f"Average score is {avg_score:.0f}%. Review simulation difficulty and training materials."

    return None
