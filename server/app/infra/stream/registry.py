"""Central registry for artifact event declarations."""

from __future__ import annotations

from app.events.types import ArtifactEventsConfig
from app.routes.v5.activity.events import ACTIVITY_EVENTS
from app.routes.v5.agent.events import AGENT_EVENTS
from app.routes.v5.attempt.events import ATTEMPT_EVENTS
from app.routes.v5.auth.events import AUTH_EVENTS
from app.routes.v5.benchmark.events import BENCHMARK_EVENTS
from app.routes.v5.chat.events import CHAT_EVENTS
from app.routes.v5.cohort.events import COHORT_EVENTS
from app.routes.v5.dashboard.events import DASHBOARD_EVENTS
from app.routes.v5.department.events import DEPARTMENT_EVENTS
from app.routes.v5.document.events import DOCUMENT_EVENTS
from app.routes.v5.eval.events import EVAL_EVENTS
from app.routes.v5.field.events import FIELD_EVENTS
from app.routes.v5.group.events import GROUP_EVENTS
from app.routes.v5.health.events import HEALTH_EVENTS
from app.routes.v5.home.events import HOME_EVENTS
from app.routes.v5.invocation.events import INVOCATION_EVENTS
from app.routes.v5.leaderboard.events import LEADERBOARD_EVENTS
from app.routes.v5.model.events import MODEL_EVENTS
from app.routes.v5.parameter.events import PARAMETER_EVENTS
from app.routes.v5.persona.events import PERSONA_EVENTS
from app.routes.v5.practice.events import PRACTICE_EVENTS
from app.routes.v5.pricing.events import PRICING_EVENTS
from app.routes.v5.profile.events import PROFILE_EVENTS
from app.routes.v5.provider.events import PROVIDER_EVENTS
from app.routes.v5.record.events import RECORD_EVENTS
from app.routes.v5.reports.events import REPORTS_EVENTS
from app.routes.v5.rubric.events import RUBRIC_EVENTS
from app.routes.v5.scenario.events import SCENARIO_EVENTS
from app.routes.v5.session.events import SESSION_EVENTS
from app.routes.v5.setting.events import SETTING_EVENTS
from app.routes.v5.simulation.events import SIMULATION_EVENTS
from app.routes.v5.test.events import TEST_EVENTS
from app.routes.v5.tool.events import TOOL_EVENTS

EVENT_REGISTRY: dict[str, ArtifactEventsConfig] = {
    "activity": ACTIVITY_EVENTS,
    "agent": AGENT_EVENTS,
    "attempt": ATTEMPT_EVENTS,
    "auth": AUTH_EVENTS,
    "benchmark": BENCHMARK_EVENTS,
    "chat": CHAT_EVENTS,
    "cohort": COHORT_EVENTS,
    "dashboard": DASHBOARD_EVENTS,
    "department": DEPARTMENT_EVENTS,
    "document": DOCUMENT_EVENTS,
    "eval": EVAL_EVENTS,
    "field": FIELD_EVENTS,
    "group": GROUP_EVENTS,
    "health": HEALTH_EVENTS,
    "home": HOME_EVENTS,
    "invocation": INVOCATION_EVENTS,
    "leaderboard": LEADERBOARD_EVENTS,
    "model": MODEL_EVENTS,
    "parameter": PARAMETER_EVENTS,
    "persona": PERSONA_EVENTS,
    "pricing": PRICING_EVENTS,
    "practice": PRACTICE_EVENTS,
    "profile": PROFILE_EVENTS,
    "provider": PROVIDER_EVENTS,
    "record": RECORD_EVENTS,
    "reports": REPORTS_EVENTS,
    "rubric": RUBRIC_EVENTS,
    "scenario": SCENARIO_EVENTS,
    "session": SESSION_EVENTS,
    "setting": SETTING_EVENTS,
    "simulation": SIMULATION_EVENTS,
    "test": TEST_EVENTS,
    "tool": TOOL_EVENTS,
}


def get_artifact_events_config(artifact: str) -> ArtifactEventsConfig | None:
    """Resolve the event declaration bundle for an artifact."""
    return EVENT_REGISTRY.get(artifact)
