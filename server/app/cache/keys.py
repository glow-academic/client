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

