"""Central registry for artifact event declarations."""

from __future__ import annotations

from app.events.types import ArtifactEventsConfig
from app.routes.v5.api.main.agent.events import AGENT_EVENTS
from app.routes.v5.api.main.attempt.events import ATTEMPT_EVENTS
from app.routes.v5.api.main.group.events import GROUP_EVENTS
from app.routes.v5.api.main.persona.events import PERSONA_EVENTS
from app.routes.v5.api.main.scenario.events import SCENARIO_EVENTS
from app.routes.v5.api.main.test.events import TEST_EVENTS

EVENT_REGISTRY: dict[str, ArtifactEventsConfig] = {
    "agent": AGENT_EVENTS,
    "attempt": ATTEMPT_EVENTS,
    "group": GROUP_EVENTS,
    "persona": PERSONA_EVENTS,
    "scenario": SCENARIO_EVENTS,
    "test": TEST_EVENTS,
}


def get_artifact_events_config(artifact: str) -> ArtifactEventsConfig | None:
    """Resolve the event declaration bundle for an artifact."""
    return EVENT_REGISTRY.get(artifact)
