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


def test_registry_returns_none_for_unknown_artifact() -> None:
    assert get_artifact_events_config("unknown") is None
