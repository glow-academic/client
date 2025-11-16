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


def build_profile_and_analytics_filters(
    start_date: str,
    end_date: str,
    cohort_ids: list[str] | None = None,
    roles: list[str] | None = None,
    sim_filters: list[str] | None = None,
    profile_id: str | None = None,
    department_ids: list[str] | None = None,
) -> tuple[str, str, list[Any]]:
    """
    Build separate WHERE clauses for profiles and analytics queries.
    This allows including all matching profiles even if they have no attempts.

    Returns:
        Tuple of (profile_where_clause, analytics_where_clause, params_list)
    """
    profile_conditions = []
    analytics_conditions = []
    params: list[Any] = []
    param_counter = 1

    # Date filters - only for analytics
    analytics_conditions.append(f"a.attempt_created_at >= ${param_counter}")
    params.append(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
    param_counter += 1

    analytics_conditions.append(f"a.attempt_created_at < ${param_counter}")
    params.append(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
    param_counter += 1

    # Simulation type filters - only for analytics
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
        analytics_conditions.append(f"({' OR '.join(sim_conditions)})")

    # Profile filter - applies to both
    if profile_id:
        profile_conditions.append(f"p.id = ${param_counter}")
        analytics_conditions.append(f"a.profile_id = ${param_counter}")
        params.append(profile_id)
        param_counter += 1

    # Role filter - only for profiles (only if no profile_id)
    if not profile_id and roles:
        profile_conditions.append(f"p.role = ANY(${param_counter}::profile_role[])")
        params.append(roles)
        param_counter += 1

    # Cohort filter - for profiles via cohort_profiles join
    if cohort_ids:
        # For profiles: use EXISTS with cohort_profiles
        profile_conditions.append(
            f"EXISTS (SELECT 1 FROM cohort_profiles cp WHERE cp.profile_id = p.id AND cp.cohort_id = ANY(${param_counter}::uuid[]) AND cp.active = true)"
        )
        # For analytics: keep original logic
        analytics_conditions.append(
            f"(a.cohort_ids && ${param_counter} OR a.profile_cohort_ids && ${param_counter})"
        )
        params.append(cohort_ids)
        param_counter += 1

    # Department filter - for profiles via profile_departments join
    if department_ids:
        # For profiles: use EXISTS with profile_departments
        profile_conditions.append(
            f"EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.profile_id = p.id AND pd.department_id = ANY(${param_counter}::uuid[]) AND pd.active = true)"
        )
        # For analytics: keep original logic
        analytics_conditions.append(f"a.department_id = ANY(${param_counter})")
        params.append(department_ids)
        param_counter += 1

    profile_where = " AND ".join(profile_conditions) if profile_conditions else "TRUE"
    analytics_where = " AND ".join(analytics_conditions) if analytics_conditions else "TRUE"
    
    return profile_where, analytics_where, params


# Removed get_profile_role_query - use load_sql("sql/v3/profile/get_profile_role.sql") directly
# The query takes $1=profile_id parameter
