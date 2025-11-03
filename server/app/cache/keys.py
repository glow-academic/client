"""Centralized cache key system with namespaces and tag generation."""

import hashlib
import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

# Global cache version - bump to invalidate all caches after schema changes
GLOBAL_CACHE_VERSION = (
    50  # Bumped: Fixed persona_ids to derive from database instead of cached query result to avoid stale data
)

# Namespaces
NS_ANALYTICS = "analytics"
NS_PROFILE = "profile"
NS_SIMULATION = "simulation"
NS_SCENARIO = "scenario"
NS_ATTEMPT = "attempt"
NS_AGENT = "agent"
NS_DEPARTMENT = "department"
NS_COHORT = "cohort"
NS_DOCUMENT = "document"
NS_ASSISTANT = "assistant"
NS_LOG = "log"
NS_MODEL_RUN = "model_run"
NS_PARAMETER = "parameter"
NS_STAFF = "staff"
NS_PROVIDER = "provider"
NS_RUBRIC = "rubric"
NS_PERSONA = "persona"


def _stable_json(obj: Any) -> str:
    """Stable JSON serialization for params in keys."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


@dataclass(frozen=True)
class Key:
    """
    Canonical cache key with namespace, name, params, and version.

    Produces:
    - material(): Human-readable stable string for hashing/logging
    - hash_key(): 64-char hex used in Redis/local cache
    - redis_key(): Namespaced Redis key like qc:data:{hash}
    - tags(): Computed invalidation tags for this key
    """

    ns: str  # Namespace (e.g., "analytics", "profile")
    name: str  # Query name (e.g., "average_score", "by_id")
    params: Mapping[str, Any] | None = None
    v: int = field(default=GLOBAL_CACHE_VERSION)

    def material(self) -> str:
        """Human-readable, stable material used for hashing/logging."""
        if self.params is None:
            p = "null"
        else:
            p = _stable_json(self.params)
        return f"{self.ns}|{self.name}|v{self.v}|{p}"

    def hash_key(self) -> str:
        """64-hex hash for cache storage."""
        return hashlib.sha256(self.material().encode("utf-8")).hexdigest()

    def redis_key(self) -> str:
        """Redis key with namespace prefix."""
        return f"qc:data:{self.hash_key()}"

    def tags(self) -> Iterable[str]:
        """
        Generate invalidation tags for this key.

        Tag hierarchy:
        - Coarse: {ns}:* (invalidate entire namespace)
        - Medium: {ns}:{category}:{name}
        - Fine: {ns}:{entity_id} (specific entity, if identifiable)
        """
        # Coarse tag - invalidate entire namespace
        yield f"{self.ns}:*"

        # Medium tag - query-specific
        # Extract category from name (e.g., "header:average_score")
        if self.params and "category" in self.params:
            category = self.params["category"]
            yield f"{self.ns}:{category}:{self.name}"
        else:
            yield f"{self.ns}:{self.name}"

        # Fine tag - entity-specific (if we can extract an ID)
        entity_id = _extract_primary_id(self.ns, self.name, self.params)
        if entity_id is not None:
            yield f"{self.ns}:{entity_id}"


def _extract_primary_id(ns: str, name: str, params: Any) -> Any | None:
    """
    Extract primary entity ID from params for fine-grained tagging.

    This allows invalidating specific entities without nuking entire namespaces.
    """
    if not isinstance(params, Mapping):
        return None

    # Profile namespace
    if ns == NS_PROFILE:
        if name in ("by_id", "permissions"):
            return params.get("profile_id")

    # Simulation namespace
    if ns == NS_SIMULATION:
        if name == "by_id":
            return params.get("simulation_id")

    # Attempt namespace
    if ns == NS_ATTEMPT:
        if name == "by_id":
            return params.get("attempt_id")

    # Document namespace
    if ns == NS_DOCUMENT:
        if name in ("by_id", "file_info"):
            return params.get("document_id")

    # Cohort namespace
    if ns == NS_COHORT:
        if name in ("by_id", "with_profiles", "overview", "pass_matrix"):
            return params.get("cohort_id")

    # Department namespace
    if ns == NS_DEPARTMENT:
        if name == "by_id":
            return params.get("department_id")

    # Assistant namespace
    if ns == NS_ASSISTANT:
        if name == "run_context":
            return params.get("chat_id")

    # Parameter namespace
    if ns == NS_PARAMETER:
        if name in ("by_id", "detail"):
            return params.get("parameter_id")

    # Scenario namespace
    if ns == NS_SCENARIO:
        if name in ("by_id", "overview"):
            return params.get("scenario_id")

    # Provider namespace
    if ns == NS_PROVIDER:
        if name == "by_id":
            return params.get("provider_id")
        if name == "model_by_id":
            return f"model:{params.get('model_id')}"

    # Staff namespace
    if ns == NS_STAFF:
        if name == "detail":
            return params.get("profile_id")

    # Persona namespace
    if ns == NS_PERSONA:
        if name in ("by_id", "overview", "response_times"):
            return params.get("persona_id")

    # Rubric namespace
    if ns == NS_RUBRIC:
        if name in ("by_id", "detail"):
            return params.get("rubric_id")

    return None


# ============================================================================
# ANALYTICS KEY FACTORIES
# ============================================================================


def analytics_average_score(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for average score metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="average_score",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_completion_percentage(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for completion percentage metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="completion_percentage",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_first_attempt_pass_rate(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for first attempt pass rate metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="first_attempt_pass_rate",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_highest_score(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for highest score metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="highest_score",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_messages_per_session(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for messages per session metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="messages_per_session",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_persona_response_times(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for persona response times metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="persona_response_times",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_session_efficiency(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for session efficiency metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="session_efficiency",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_stagnation_rate(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for stagnation rate metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="stagnation_rate",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_time_spent(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for time spent metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="time_spent",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_total_attempts(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for total attempts metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="total_attempts",
        params={"category": "header", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_rubric_heatmap(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for rubric heatmap data."""
    return Key(
        ns=NS_ANALYTICS,
        name="rubric_heatmap",
        params={"category": "primary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_growth_data(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for growth data."""
    return Key(
        ns=NS_ANALYTICS,
        name="growth_data",
        params={"category": "primary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_persona_performance(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for persona performance data."""
    return Key(
        ns=NS_ANALYTICS,
        name="persona_performance",
        params={"category": "primary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_attempt_improvement(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for attempt improvement data."""
    return Key(
        ns=NS_ANALYTICS,
        name="attempt_improvement",
        params={"category": "secondary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_scenario_performance(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for scenario performance data."""
    return Key(
        ns=NS_ANALYTICS,
        name="scenario_performance",
        params={"category": "secondary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_skill_performance(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for skill performance data."""
    return Key(
        ns=NS_ANALYTICS,
        name="skill_performance",
        params={"category": "secondary", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_simulation_composition(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for simulation composition data."""
    return Key(
        ns=NS_ANALYTICS,
        name="simulation_composition",
        params={"category": "footer", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_simulation_performance(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for simulation performance data."""
    return Key(
        ns=NS_ANALYTICS,
        name="simulation_performance",
        params={"category": "footer", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_scenario_stats(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenario stats data."""
    return Key(
        ns=NS_ANALYTICS,
        name="scenario_stats",
        params={"category": "footer", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_home_overview(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for home overview data."""
    return Key(
        ns=NS_ANALYTICS,
        name="home_overview",
        params={"category": "page", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_practice_overview(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for practice overview data."""
    return Key(
        ns=NS_ANALYTICS,
        name="practice_overview",
        params={"category": "page", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_cohort_performance(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohort performance data."""
    return Key(
        ns=NS_ANALYTICS,
        name="cohort_performance",
        params={"category": "page", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_attempt_history(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for attempt history data."""
    return Key(
        ns=NS_ANALYTICS,
        name="attempt_history",
        params={"category": "page", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_dashboard_bundle(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for dashboard bundle data."""
    return Key(
        ns=NS_ANALYTICS,
        name="dashboard_bundle",
        params={"category": "bundle", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_leaderboard_bundle(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for leaderboard bundle data."""
    return Key(
        ns=NS_ANALYTICS,
        name="leaderboard_bundle",
        params={"category": "bundle", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_improvement_per_day(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for improvement per day metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="improvement_per_day",
        params={"category": "leaderboard", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_perfect_scores(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for perfect scores metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="perfect_scores",
        params={"category": "leaderboard", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_quickest_pass(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for quickest pass metric."""
    return Key(
        ns=NS_ANALYTICS,
        name="quickest_pass",
        params={"category": "leaderboard", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_reports_bundle(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for reports bundle data."""
    return Key(
        ns=NS_ANALYTICS,
        name="reports_bundle",
        params={"category": "bundle", "filters": _serialize_filters(filters)},
        v=v,
    )


def analytics_pricing_analytics(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for pricing analytics data."""
    return Key(
        ns=NS_ANALYTICS,
        name="pricing_analytics",
        params={"category": "pricing", "filters": _serialize_filters(filters)},
        v=v,
    )


def _serialize_filters(filters: Any) -> dict[str, Any]:
    """Serialize analytics filters to a stable dict format."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# PROFILE KEY FACTORIES
# ============================================================================


def profile_by_id(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for profile by ID query."""
    return Key(ns=NS_PROFILE, name="by_id", params={"profile_id": profile_id}, v=v)


def profile_all(*, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for all profiles query."""
    return Key(ns=NS_PROFILE, name="all", params=None, v=v)


def profile_permissions(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for user permissions query."""
    return Key(
        ns=NS_PROFILE, name="permissions", params={"profile_id": profile_id}, v=v
    )


def profile_by_email(email: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for profile by email query."""
    return Key(ns=NS_PROFILE, name="by_email", params={"email": email}, v=v)


# ============================================================================
# STAFF KEY FACTORIES
# ============================================================================


def staff_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for staff list query."""
    return Key(
        ns=NS_STAFF, name="list", params={"filters": _serialize_filters(filters)}, v=v
    )


def staff_detail(
    profile_id: str, current_profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for staff detail query."""
    return Key(
        ns=NS_STAFF,
        name="detail",
        params={"profile_id": profile_id, "current_profile_id": current_profile_id},
        v=v,
    )


def staff_detail_bulk(
    profile_ids: list[str], current_profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for bulk staff detail query."""
    return Key(
        ns=NS_STAFF,
        name="detail_bulk",
        params={
            "profile_ids": sorted(profile_ids),
            "current_profile_id": current_profile_id,
        },
        v=v,
    )


# ============================================================================
# PROVIDER KEY FACTORIES
# ============================================================================


def provider_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for providers list query."""
    return Key(
        ns=NS_PROVIDER,
        name="list",
        params={"filters": _serialize_filters(filters)},
        v=v,
    )


def provider_by_id(provider_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for provider by ID query."""
    return Key(ns=NS_PROVIDER, name="by_id", params={"provider_id": provider_id}, v=v)


def model_by_id(model_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for model by ID query."""
    return Key(ns=NS_PROVIDER, name="model_by_id", params={"model_id": model_id}, v=v)


# ============================================================================
# ASSISTANT KEY FACTORIES
# ============================================================================


def assistant_run_context(
    chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for assistant run context query."""
    return Key(
        ns=NS_ASSISTANT,
        name="run_context",
        params={"chat_id": chat_id, "department_id": department_id},
        v=v,
    )


def assistant_usage_stats(days: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for assistant usage statistics query."""
    return Key(
        ns=NS_ASSISTANT,
        name="usage_stats",
        params={"days": days},
        v=v,
    )


# ============================================================================
# COHORT KEY FACTORIES
# ============================================================================


def cohort_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohorts list query."""
    return Key(
        ns=NS_COHORT,
        name="list",
        params={"filters": _serialize_cohort_filters(filters)},
        v=v,
    )


def cohort_by_id(
    cohort_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for cohort detail query."""
    return Key(
        ns=NS_COHORT,
        name="by_id",
        params={"cohort_id": cohort_id, "profile_id": profile_id},
        v=v,
    )


def cohort_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default cohort query."""
    return Key(
        ns=NS_COHORT,
        name="default",
        params={"profile_id": profile_id},
        v=v,
    )


def cohort_with_profiles(
    cohort_id: str,
    department_ids: list[str],
    profile_id: str,
    *,
    v: int = GLOBAL_CACHE_VERSION,
) -> Key:
    """Key for cohort with profiles query."""
    return Key(
        ns=NS_COHORT,
        name="with_profiles",
        params={
            "cohort_id": cohort_id,
            "department_ids": sorted(department_ids),
            "profile_id": profile_id,
        },
        v=v,
    )


def cohort_search(query: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohort search query."""
    return Key(
        ns=NS_COHORT,
        name="search",
        params={"query": query, "limit": limit},
        v=v,
    )


def cohort_overview(cohort_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohort overview query."""
    return Key(
        ns=NS_COHORT,
        name="overview",
        params={"cohort_id": cohort_id},
        v=v,
    )


def cohort_pass_matrix(cohort_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohort pass matrix query."""
    return Key(
        ns=NS_COHORT,
        name="pass_matrix",
        params={"cohort_id": cohort_id},
        v=v,
    )


def _serialize_cohort_filters(filters: Any) -> dict[str, Any]:
    """Serialize cohort filters to stable dict."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# DEPARTMENT KEY FACTORIES
# ============================================================================


def department_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for departments list query."""
    return Key(
        ns=NS_DEPARTMENT,
        name="list",
        params={"filters": _serialize_filters(filters)},
        v=v,
    )


def department_by_id(department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for department detail query."""
    return Key(
        ns=NS_DEPARTMENT, name="by_id", params={"department_id": department_id}, v=v
    )


def department_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for department creation defaults query."""
    return Key(ns=NS_DEPARTMENT, name="default", params={"profile_id": profile_id}, v=v)


# ============================================================================
# DOCUMENT KEY FACTORIES
# ============================================================================


def document_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for documents list query."""
    return Key(
        ns=NS_DOCUMENT,
        name="list",
        params={"filters": _serialize_document_filters(filters)},
        v=v,
    )


def document_by_id(document_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for document detail by ID."""
    return Key(ns=NS_DOCUMENT, name="by_id", params={"document_id": document_id}, v=v)


def document_bulk_detail(
    document_ids: list[str], profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for bulk document detail."""
    return Key(
        ns=NS_DOCUMENT,
        name="bulk_detail",
        params={"document_ids": sorted(document_ids), "profile_id": profile_id},
        v=v,
    )


def document_file_info(document_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for document file metadata."""
    return Key(
        ns=NS_DOCUMENT, name="file_info", params={"document_id": document_id}, v=v
    )


def _serialize_document_filters(filters: Any) -> dict[str, Any]:
    """Serialize document filters to stable dict format."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# AGENT KEY FACTORIES
# ============================================================================


def agent_list(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for agents list query."""
    return Key(ns=NS_AGENT, name="list", params={"profile_id": profile_id}, v=v)


def agent_by_id(agent_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for agent detail query."""
    return Key(ns=NS_AGENT, name="by_id", params={"agent_id": agent_id}, v=v)


def agent_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default agent detail query."""
    return Key(
        ns=NS_AGENT,
        name="default",
        params={"profile_id": profile_id},
        v=v,
    )


def agent_classification_context(
    document_ids: list[str], department_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for classification agent run context."""
    doc_ids_str = ",".join(sorted(str(d) for d in document_ids))
    return Key(
        ns=NS_AGENT,
        name="classification_context",
        params={"document_ids": doc_ids_str, "department_id": department_id},
        v=v,
    )


def agent_scenario_context(
    department_id: str,
    persona_id: str | None,
    document_ids: list[str] | None,
    parameter_item_ids: list[str] | None,
    *,
    v: int = GLOBAL_CACHE_VERSION,
) -> Key:
    """Key for scenario agent run context."""
    params = {"department_id": department_id}
    if persona_id:
        params["persona_id"] = persona_id
    if document_ids:
        params["document_ids"] = ",".join(sorted(str(d) for d in document_ids))
    if parameter_item_ids:
        params["parameter_item_ids"] = ",".join(
            sorted(str(p) for p in parameter_item_ids)
        )
    return Key(ns=NS_AGENT, name="scenario_context", params=params, v=v)


def agent_simulation_context(chat_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation agent run context."""
    return Key(ns=NS_AGENT, name="simulation_context", params={"chat_id": chat_id}, v=v)


def agent_grading_context(
    simulation_chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for grading agent run context."""
    return Key(
        ns=NS_AGENT,
        name="grading_context",
        params={
            "simulation_chat_id": simulation_chat_id,
            "department_id": department_id,
        },
        v=v,
    )


def agent_simulation_messages(
    simulation_chat_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for simulation messages query."""
    return Key(
        ns=NS_AGENT,
        name="simulation_messages",
        params={"simulation_chat_id": simulation_chat_id},
        v=v,
    )


def agent_hint_context(
    message_id: str, chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for hint agent run context."""
    return Key(
        ns=NS_AGENT,
        name="hint_context",
        params={
            "message_id": message_id,
            "chat_id": chat_id,
            "department_id": department_id,
        },
        v=v,
    )


def agent_guardrail_context(
    chat_id: str,
    department_id: str,
    guardrail_type: str,
    *,
    v: int = GLOBAL_CACHE_VERSION,
) -> Key:
    """Key for guardrail agent run context."""
    return Key(
        ns=NS_AGENT,
        name="guardrail_context",
        params={
            "chat_id": chat_id,
            "department_id": department_id,
            "guardrail_type": guardrail_type,
        },
        v=v,
    )


def agent_title_context(
    chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for title agent run context."""
    return Key(
        ns=NS_AGENT,
        name="title_context",
        params={"chat_id": chat_id, "department_id": department_id},
        v=v,
    )


# ============================================================================
# PARAMETER KEY FACTORIES
# ============================================================================


def parameter_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for parameters list query."""
    return Key(
        ns=NS_PARAMETER,
        name="list",
        params={"filters": _serialize_filters(filters)},
        v=v,
    )


def parameter_by_id(
    parameter_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for parameter detail by ID query."""
    return Key(
        ns=NS_PARAMETER,
        name="by_id",
        params={"parameter_id": parameter_id, "profile_id": profile_id},
        v=v,
    )


def parameter_detail_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default parameter detail query."""
    return Key(
        ns=NS_PARAMETER,
        name="detail_default",
        params={"profile_id": profile_id},
        v=v,
    )


# ============================================================================
# SCENARIO KEY FACTORIES
# ============================================================================


def scenario_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenarios list query."""
    return Key(
        ns=NS_SCENARIO,
        name="list",
        params={"filters": _serialize_filters(filters)},
        v=v,
    )


def scenario_by_id(
    scenario_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for scenario detail by ID query."""
    return Key(
        ns=NS_SCENARIO,
        name="by_id",
        params={"scenario_id": scenario_id, "profile_id": profile_id},
        v=v,
    )


def scenario_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default scenario query."""
    return Key(
        ns=NS_SCENARIO,
        name="default",
        params={"profile_id": profile_id},
        v=v,
    )


def scenario_mapping(scenario_ids: list[str], *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenario mapping query."""
    return Key(
        ns=NS_SCENARIO,
        name="mapping",
        params={"scenario_ids": sorted(scenario_ids)},
        v=v,
    )


def scenario_search(query: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenario search query."""
    return Key(
        ns=NS_SCENARIO,
        name="search",
        params={"query": query, "limit": limit},
        v=v,
    )


def scenario_overview(scenario_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenario overview query."""
    return Key(
        ns=NS_SCENARIO,
        name="overview",
        params={"scenario_id": scenario_id},
        v=v,
    )


# ============================================================================
# PERSONA KEY FACTORIES
# ============================================================================


def persona_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for personas list query."""
    return Key(
        ns=NS_PERSONA,
        name="list",
        params={"filters": _serialize_persona_filters(filters)},
        v=v,
    )


def persona_by_id(
    persona_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for persona detail query."""
    return Key(
        ns=NS_PERSONA,
        name="by_id",
        params={"persona_id": persona_id, "profile_id": profile_id},
        v=v,
    )


def persona_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default persona detail query."""
    return Key(
        ns=NS_PERSONA,
        name="default",
        params={"profile_id": profile_id},
        v=v,
    )


def persona_overview(persona_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for persona overview query."""
    return Key(
        ns=NS_PERSONA,
        name="overview",
        params={"persona_id": persona_id},
        v=v,
    )


def persona_response_times(
    persona_id: str, window_days: int, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for persona response times analysis."""
    return Key(
        ns=NS_PERSONA,
        name="response_times",
        params={"persona_id": persona_id, "window_days": window_days},
        v=v,
    )


def persona_search(query: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for persona search query."""
    return Key(
        ns=NS_PERSONA,
        name="search",
        params={"query": query, "limit": limit},
        v=v,
    )


def _serialize_persona_filters(filters: Any) -> dict[str, Any]:
    """Serialize persona filters to stable dict."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# RUBRIC KEY FACTORIES
# ============================================================================


def rubric_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for rubrics list query."""
    return Key(
        ns=NS_RUBRIC,
        name="list",
        params={"filters": _serialize_rubric_filters(filters)},
        v=v,
    )


def rubric_by_id(
    rubric_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for rubric detail query."""
    return Key(
        ns=NS_RUBRIC,
        name="by_id",
        params={"rubric_id": rubric_id, "profile_id": profile_id},
        v=v,
    )


def rubric_detail_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for default rubric query."""
    return Key(
        ns=NS_RUBRIC,
        name="detail_default",
        params={"profile_id": profile_id},
        v=v,
    )


def _serialize_rubric_filters(filters: Any) -> dict[str, Any]:
    """Serialize rubric filters to stable dict format."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# SIMULATION KEY FACTORIES
# ============================================================================


def simulation_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulations list query."""
    return Key(
        ns=NS_SIMULATION,
        name="list",
        params={"filters": _serialize_simulation_filters(filters)},
        v=v,
    )


def simulation_by_id(
    simulation_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for simulation detail by ID query."""
    return Key(
        ns=NS_SIMULATION,
        name="by_id",
        params={"simulation_id": simulation_id, "profile_id": profile_id},
        v=v,
    )


def simulation_overview(simulation_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation overview query."""
    return Key(
        ns=NS_SIMULATION,
        name="overview",
        params={"simulation_id": simulation_id},
        v=v,
    )


def simulation_attempts_list(
    simulation_id: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for simulation attempts list query."""
    return Key(
        ns=NS_SIMULATION,
        name="attempts_list",
        params={"simulation_id": simulation_id, "limit": limit},
        v=v,
    )


def simulation_search(query: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation search query."""
    return Key(
        ns=NS_SIMULATION,
        name="search",
        params={"query": query, "limit": limit},
        v=v,
    )


def simulation_for_chat(chat_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation metadata from chat."""
    return Key(
        ns=NS_SIMULATION,
        name="for_chat",
        params={"chat_id": chat_id},
        v=v,
    )


def _serialize_simulation_filters(filters: Any) -> dict[str, Any]:
    """Serialize simulation filters to stable dict format."""
    if hasattr(filters, "model_dump"):
        return filters.model_dump()  # type: ignore
    elif hasattr(filters, "dict"):
        return filters.dict()  # type: ignore
    elif isinstance(filters, dict):
        return filters  # type: ignore
    else:
        return {"raw": str(filters)}


# ============================================================================
# TAG HELPERS
# ============================================================================


def tag_analytics_all() -> str:
    """Coarse tag to invalidate all analytics caches."""
    return f"{NS_ANALYTICS}:*"


def tag_profile_all() -> str:
    """Coarse tag to invalidate all profile caches."""
    return f"{NS_PROFILE}:*"


def tag_profile_by_id(profile_id: str) -> str:
    """Fine tag to invalidate specific profile caches."""
    return f"{NS_PROFILE}:{profile_id}"


def tag_simulation_all() -> str:
    """Coarse tag to invalidate all simulation caches."""
    return f"{NS_SIMULATION}:*"


def tag_simulation_by_id(simulation_id: str) -> str:
    """Fine tag to invalidate specific simulation caches."""
    return f"{NS_SIMULATION}:{simulation_id}"


def tag_cohort_all() -> str:
    """Coarse tag to invalidate all cohort caches."""
    return f"{NS_COHORT}:*"


def tag_cohort_by_id(cohort_id: str) -> str:
    """Fine tag to invalidate specific cohort caches."""
    return f"{NS_COHORT}:{cohort_id}"


def tag_department_all() -> str:
    """Coarse tag to invalidate all department caches."""
    return f"{NS_DEPARTMENT}:*"


def tag_department_by_id(department_id: str) -> str:
    """Fine tag to invalidate specific department caches."""
    return f"{NS_DEPARTMENT}:{department_id}"


def tag_document_all() -> str:
    """Coarse tag to invalidate all document caches."""
    return f"{NS_DOCUMENT}:*"


def tag_document_by_id(document_id: str) -> str:
    """Fine tag to invalidate specific document caches."""
    return f"{NS_DOCUMENT}:{document_id}"


def tag_agent_all() -> str:
    """Coarse tag to invalidate all agent caches."""
    return f"{NS_AGENT}:*"


def tag_agent_by_id(agent_id: str) -> str:
    """Fine tag to invalidate specific agent caches."""
    return f"{NS_AGENT}:{agent_id}"


def tag_assistant_all() -> str:
    """Coarse tag to invalidate all assistant caches."""
    return f"{NS_ASSISTANT}:*"


def tag_assistant_by_chat_id(chat_id: str) -> str:
    """Fine tag to invalidate specific assistant chat caches."""
    return f"{NS_ASSISTANT}:{chat_id}"


def tag_parameter_all() -> str:
    """Coarse tag to invalidate all parameter caches."""
    return f"{NS_PARAMETER}:*"


def tag_parameter_by_id(parameter_id: str) -> str:
    """Fine tag to invalidate specific parameter caches."""
    return f"{NS_PARAMETER}:{parameter_id}"


def tag_scenario_all() -> str:
    """Coarse tag to invalidate all scenario caches."""
    return f"{NS_SCENARIO}:*"


def tag_scenario_by_id(scenario_id: str) -> str:
    """Fine tag to invalidate specific scenario caches."""
    return f"{NS_SCENARIO}:{scenario_id}"


def tag_provider_all() -> str:
    """Coarse tag to invalidate all provider caches."""
    return f"{NS_PROVIDER}:*"


def tag_provider_by_id(provider_id: str) -> str:
    """Fine tag to invalidate specific provider caches."""
    return f"{NS_PROVIDER}:{provider_id}"


def tag_model_by_id(model_id: str) -> str:
    """Fine tag to invalidate specific model caches."""
    return f"{NS_PROVIDER}:model:{model_id}"


def tag_staff_all() -> str:
    """Coarse tag to invalidate all staff caches."""
    return f"{NS_STAFF}:*"


def tag_staff_by_id(profile_id: str) -> str:
    """Fine tag to invalidate specific staff caches."""
    return f"{NS_STAFF}:{profile_id}"


def tag_persona_all() -> str:
    """Coarse tag to invalidate all persona caches."""
    return f"{NS_PERSONA}:*"


def tag_persona_by_id(persona_id: str) -> str:
    """Fine tag to invalidate specific persona caches."""
    return f"{NS_PERSONA}:{persona_id}"


def tag_rubric_all() -> str:
    """Coarse tag to invalidate all rubric caches."""
    return f"{NS_RUBRIC}:*"


def tag_rubric_by_id(rubric_id: str) -> str:
    """Fine tag to invalidate specific rubric caches."""
    return f"{NS_RUBRIC}:{rubric_id}"


def tag_attempt_all() -> str:
    """Coarse tag to invalidate all attempt caches."""
    return f"{NS_ATTEMPT}:*"


def tag_attempt_by_id(attempt_id: str) -> str:
    """Fine tag to invalidate specific attempt caches."""
    return f"{NS_ATTEMPT}:{attempt_id}"


# ============================================================================
# LOG KEY FACTORIES
# ============================================================================


def log_list(*, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for logs list query."""
    return Key(ns=NS_LOG, name="list", params=None, v=v)


def log_recent(level: str, limit: int, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for recent logs query."""
    return Key(ns=NS_LOG, name="recent", params={"level": level, "limit": limit}, v=v)


def tag_log_all() -> str:
    """Coarse tag to invalidate all log caches."""
    return f"{NS_LOG}:*"


def tag_model_run_all() -> str:
    """Coarse tag to invalidate all model run caches."""
    return f"{NS_MODEL_RUN}:*"


def tag_model_run_by_id(model_run_id: str) -> str:
    """Fine tag to invalidate specific model run caches."""
    return f"{NS_MODEL_RUN}:{model_run_id}"


# ============================================================================
# CONVENIENCE WRAPPERS
# ============================================================================


def practice_overview(filters: Any) -> str:
    """Generate cache key for practice overview (convenience wrapper)."""
    return analytics_practice_overview(filters).hash_key()


def tag_practice_all() -> str:
    """Tag for all practice analytics."""
    return f"{NS_ANALYTICS}:practice:*"
