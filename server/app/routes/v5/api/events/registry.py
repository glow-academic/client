"""Central registry for artifact event declarations."""

from __future__ import annotations

from app.events.types import ArtifactEventsConfig
from app.routes.v5.api.main.agent.events import AGENT_EVENTS
from app.routes.v5.api.main.activity.events import ACTIVITY_EVENTS
from app.routes.v5.api.main.attempt.events import ATTEMPT_EVENTS
from app.routes.v5.api.main.auth.events import AUTH_EVENTS
from app.routes.v5.api.main.benchmark.events import BENCHMARK_EVENTS
from app.routes.v5.api.main.chat.events import CHAT_EVENTS
from app.routes.v5.api.main.cohort.events import COHORT_EVENTS
from app.routes.v5.api.main.dashboard.events import DASHBOARD_EVENTS
from app.routes.v5.api.main.department.events import DEPARTMENT_EVENTS
from app.routes.v5.api.main.document.events import DOCUMENT_EVENTS
from app.routes.v5.api.main.eval.events import EVAL_EVENTS
from app.routes.v5.api.main.field.events import FIELD_EVENTS
from app.routes.v5.api.main.group.events import GROUP_EVENTS
from app.routes.v5.api.main.health.events import HEALTH_EVENTS
from app.routes.v5.api.main.home.events import HOME_EVENTS
from app.routes.v5.api.main.invocation.events import INVOCATION_EVENTS
from app.routes.v5.api.main.leaderboard.events import LEADERBOARD_EVENTS
from app.routes.v5.api.main.model.events import MODEL_EVENTS
from app.routes.v5.api.main.parameter.events import PARAMETER_EVENTS
from app.routes.v5.api.main.persona.events import PERSONA_EVENTS
from app.routes.v5.api.main.pricing.events import PRICING_EVENTS
from app.routes.v5.api.main.practice.events import PRACTICE_EVENTS
from app.routes.v5.api.main.profile.events import PROFILE_EVENTS
from app.routes.v5.api.main.provider.events import PROVIDER_EVENTS
from app.routes.v5.api.main.record.events import RECORD_EVENTS
from app.routes.v5.api.main.reports.events import REPORTS_EVENTS
from app.routes.v5.api.main.rubric.events import RUBRIC_EVENTS
from app.routes.v5.api.main.scenario.events import SCENARIO_EVENTS
from app.routes.v5.api.main.session.events import SESSION_EVENTS
from app.routes.v5.api.main.setting.events import SETTING_EVENTS
from app.routes.v5.api.main.simulation.events import SIMULATION_EVENTS
from app.routes.v5.api.main.test.events import TEST_EVENTS
from app.routes.v5.api.main.tool.events import TOOL_EVENTS

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
