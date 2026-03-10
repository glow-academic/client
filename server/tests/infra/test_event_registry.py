"""Tests for the centralized event registry contract."""

from app.routes.v5.api.events.registry import get_artifact_events_config


def test_registry_resolves_persona_config() -> None:
    config = get_artifact_events_config("persona")

    assert config is not None
    assert config.artifact == "persona"
    assert "get" in config.operations
    assert "persona.viewed" in config.event_types


def test_registry_resolves_attempt_config() -> None:
    config = get_artifact_events_config("attempt")

    assert config is not None
    assert config.artifact == "attempt"
    assert "message" in config.operations
    assert "attempt.assistant.progress" in config.event_types


def test_registry_resolves_scenario_config() -> None:
    config = get_artifact_events_config("scenario")

    assert config is not None
    assert config.artifact == "scenario"
    assert "get" in config.operations
    assert "scenario.viewed" in config.event_types


def test_registry_resolves_agent_config() -> None:
    config = get_artifact_events_config("agent")

    assert config is not None
    assert config.artifact == "agent"
    assert "get" in config.operations
    assert "agent.viewed" in config.event_types


def test_registry_resolves_cohort_config() -> None:
    config = get_artifact_events_config("cohort")

    assert config is not None
    assert config.artifact == "cohort"
    assert "get" in config.operations
    assert "cohort.viewed" in config.event_types


def test_registry_resolves_document_config() -> None:
    config = get_artifact_events_config("document")

    assert config is not None
    assert config.artifact == "document"
    assert "get" in config.operations
    assert "document.viewed" in config.event_types


def test_registry_resolves_eval_config() -> None:
    config = get_artifact_events_config("eval")

    assert config is not None
    assert config.artifact == "eval"
    assert "get" in config.operations
    assert "eval.viewed" in config.event_types


def test_registry_resolves_field_config() -> None:
    config = get_artifact_events_config("field")

    assert config is not None
    assert config.artifact == "field"
    assert "get" in config.operations
    assert "field.viewed" in config.event_types


def test_registry_resolves_model_config() -> None:
    config = get_artifact_events_config("model")

    assert config is not None
    assert config.artifact == "model"
    assert "get" in config.operations
    assert "model.viewed" in config.event_types


def test_registry_resolves_parameter_config() -> None:
    config = get_artifact_events_config("parameter")

    assert config is not None
    assert config.artifact == "parameter"
    assert "get" in config.operations
    assert "parameter.viewed" in config.event_types


def test_registry_returns_none_for_unknown_artifact() -> None:
    assert get_artifact_events_config("unknown") is None
