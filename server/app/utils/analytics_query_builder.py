"""Analytics query builder utilities for v3 API."""

from datetime import datetime
from typing import Any


def build_base_filter(
    start_date: str,
    end_date: str,
    cohort_ids: list[str] | None = None,
    roles: list[str] | None = None,
    sim_filters: list[str] | None = None,
    profile_id: str | None = None,
    department_ids: list[str] | None = None,
) -> tuple[str, list[Any]]:
    """
    Build base WHERE clause for analytics queries.

    Returns:
        Tuple of (where_clause, params_list)
    """
    conditions = []
    params: list[Any] = []
    param_counter = 1

    # Date filters - convert ISO strings to datetime objects
    conditions.append(f"a.attempt_created_at >= ${param_counter}")
    params.append(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
    param_counter += 1

    conditions.append(f"a.attempt_created_at < ${param_counter}")
    params.append(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
    param_counter += 1

    # Simulation type filters
    sim_filters = sim_filters or ["general"]
    sim_conditions = []

    if "general" in sim_filters:
        sim_conditions.append("a.is_general = TRUE")
    if "practice" in sim_filters:
        sim_conditions.append("a.is_practice = TRUE")
    if "archived" in sim_filters:
        if "general" not in sim_filters and "practice" not in sim_filters:
            sim_conditions.append("a.is_archived = TRUE")
        else:
            sim_conditions.append(
                "(a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE))"
            )

    if sim_conditions:
        conditions.append(f"({' OR '.join(sim_conditions)})")

    # Profile filter
    if profile_id:
        conditions.append(f"a.profile_id = ${param_counter}")
        params.append(profile_id)
        param_counter += 1

    # Role filter (only if no profile_id)
    if not profile_id and roles:
        conditions.append(f"a.profile_role = ANY(${param_counter})")
        params.append(roles)
        param_counter += 1

    # Cohort filter
    if cohort_ids:
        conditions.append(
            f"(a.cohort_ids && ${param_counter} OR a.profile_cohort_ids && ${param_counter})"
        )
        params.append(cohort_ids)
        param_counter += 1

    # Department filter
    if department_ids:
        conditions.append(f"a.department_id = ANY(${param_counter})")
        params.append(department_ids)
        param_counter += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    return where_clause, params


# Removed get_profile_role_query - use load_sql("sql/v3/profile/get_profile_role.sql") directly
# The query takes $1=profile_id parameter
