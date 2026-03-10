"""Central registry for artifact event declarations."""

from __future__ import annotations

from app.events.types import ArtifactEventsConfig
from app.routes.v5.api.main.agent.events import AGENT_EVENTS
from app.routes.v5.api.main.attempt.events import ATTEMPT_EVENTS
from app.routes.v5.api.main.cohort.events import COHORT_EVENTS
from app.routes.v5.api.main.document.events import DOCUMENT_EVENTS
from app.routes.v5.api.main.eval.events import EVAL_EVENTS
from app.routes.v5.api.main.field.events import FIELD_EVENTS
from app.routes.v5.api.main.group.events import GROUP_EVENTS
from app.routes.v5.api.main.model.events import MODEL_EVENTS
from app.routes.v5.api.main.parameter.events import PARAMETER_EVENTS
from app.routes.v5.api.main.persona.events import PERSONA_EVENTS
from app.routes.v5.api.main.scenario.events import SCENARIO_EVENTS
from app.routes.v5.api.main.test.events import TEST_EVENTS

EVENT_REGISTRY: dict[str, ArtifactEventsConfig] = {
    "agent": AGENT_EVENTS,
    "attempt": ATTEMPT_EVENTS,
    "cohort": COHORT_EVENTS,
    "document": DOCUMENT_EVENTS,
    "eval": EVAL_EVENTS,
    "field": FIELD_EVENTS,
    "group": GROUP_EVENTS,
    "model": MODEL_EVENTS,
    "parameter": PARAMETER_EVENTS,
    "persona": PERSONA_EVENTS,
    "scenario": SCENARIO_EVENTS,
    "test": TEST_EVENTS,
}


def get_artifact_events_config(artifact: str) -> ArtifactEventsConfig | None:
    """Resolve the event declaration bundle for an artifact."""
    return EVENT_REGISTRY.get(artifact)
