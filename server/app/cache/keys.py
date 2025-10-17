"""Centralized cache key system with namespaces and tag generation."""

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

# Global cache version - bump to invalidate all caches after schema changes
GLOBAL_CACHE_VERSION = 1

# Namespaces
NS_ANALYTICS = "analytics"
NS_PROFILE = "profile"
NS_SIMULATION = "simulation"
NS_ATTEMPT = "attempt"
NS_AGENT = "agent"
NS_DEPARTMENT = "department"
NS_COHORT = "cohort"
NS_DOCUMENT = "document"
NS_ASSISTANT = "assistant"
NS_MODEL_RUN = "model_run"


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


def analytics_session_efficiency(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
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


def analytics_cohort_performance(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
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


def analytics_leaderboard_bundle(
    filters: Any, *, v: int = GLOBAL_CACHE_VERSION
) -> Key:
    """Key for leaderboard bundle data."""
    return Key(
        ns=NS_ANALYTICS,
        name="leaderboard_bundle",
        params={"category": "bundle", "filters": _serialize_filters(filters)},
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
    return Key(
        ns=NS_PROFILE, name="by_id", params={"profile_id": profile_id}, v=v
    )


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
# ASSISTANT KEY FACTORIES
# ============================================================================


def assistant_run_context(chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
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


def cohort_by_id(cohort_id: str, profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
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


def cohort_with_profiles(cohort_id: str, department_ids: list[str], profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for cohort with profiles query."""
    return Key(
        ns=NS_COHORT,
        name="with_profiles",
        params={"cohort_id": cohort_id, "department_ids": sorted(department_ids), "profile_id": profile_id},
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
        v=v
    )


def department_by_id(department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for department detail query."""
    return Key(
        ns=NS_DEPARTMENT,
        name="by_id",
        params={"department_id": department_id},
        v=v
    )


def department_default(profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for department creation defaults query."""
    return Key(
        ns=NS_DEPARTMENT,
        name="default",
        params={"profile_id": profile_id},
        v=v
    )


# ============================================================================
# DOCUMENT KEY FACTORIES
# ============================================================================


def document_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for documents list query."""
    return Key(
        ns=NS_DOCUMENT,
        name="list",
        params={"filters": _serialize_document_filters(filters)},
        v=v
    )


def document_by_id(document_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for document detail by ID."""
    return Key(
        ns=NS_DOCUMENT,
        name="by_id",
        params={"document_id": document_id},
        v=v
    )


def document_bulk_detail(document_ids: list[str], profile_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for bulk document detail."""
    return Key(
        ns=NS_DOCUMENT,
        name="bulk_detail",
        params={"document_ids": sorted(document_ids), "profile_id": profile_id},
        v=v
    )


def document_file_info(document_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for document file metadata."""
    return Key(
        ns=NS_DOCUMENT,
        name="file_info",
        params={"document_id": document_id},
        v=v
    )


def document_csv_file(token: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for CSV file metadata."""
    return Key(
        ns=NS_DOCUMENT,
        name="csv_file",
        params={"token": token},
        v=v
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


def agent_classification_context(document_ids: list[str], department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for classification agent run context."""
    doc_ids_str = ",".join(sorted(str(d) for d in document_ids))
    return Key(ns=NS_AGENT, name="classification_context", 
               params={"document_ids": doc_ids_str, "department_id": department_id}, v=v)


def agent_scenario_context(department_id: str, persona_id: str | None, 
                          document_ids: list[str] | None, parameter_item_ids: list[str] | None,
                          *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for scenario agent run context."""
    params = {"department_id": department_id}
    if persona_id:
        params["persona_id"] = persona_id
    if document_ids:
        params["document_ids"] = ",".join(sorted(str(d) for d in document_ids))
    if parameter_item_ids:
        params["parameter_item_ids"] = ",".join(sorted(str(p) for p in parameter_item_ids))
    return Key(ns=NS_AGENT, name="scenario_context", params=params, v=v)


def agent_simulation_context(chat_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation agent run context."""
    return Key(ns=NS_AGENT, name="simulation_context", params={"chat_id": chat_id}, v=v)


def agent_grading_context(simulation_chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for grading agent run context."""
    return Key(ns=NS_AGENT, name="grading_context",
               params={"simulation_chat_id": simulation_chat_id, "department_id": department_id}, v=v)


def agent_simulation_messages(simulation_chat_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for simulation messages query."""
    return Key(ns=NS_AGENT, name="simulation_messages", params={"simulation_chat_id": simulation_chat_id}, v=v)


def agent_hint_context(message_id: str, chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for hint agent run context."""
    return Key(ns=NS_AGENT, name="hint_context",
               params={"message_id": message_id, "chat_id": chat_id, "department_id": department_id}, v=v)


def agent_guardrail_context(chat_id: str, department_id: str, guardrail_type: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for guardrail agent run context."""
    return Key(ns=NS_AGENT, name="guardrail_context",
               params={"chat_id": chat_id, "department_id": department_id, "guardrail_type": guardrail_type}, v=v)


def agent_title_context(chat_id: str, department_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for title agent run context."""
    return Key(ns=NS_AGENT, name="title_context",
               params={"chat_id": chat_id, "department_id": department_id}, v=v)


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


def tag_model_run_all() -> str:
    """Coarse tag to invalidate all model run caches."""
    return f"{NS_MODEL_RUN}:*"


def tag_model_run_by_id(model_run_id: str) -> str:
    """Fine tag to invalidate specific model run caches."""
    return f"{NS_MODEL_RUN}:{model_run_id}"

