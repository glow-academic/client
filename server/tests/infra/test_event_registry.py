"""Tests for the centralized event registry contract."""

from app.routes.v5.api.events.registry import get_artifact_events_config


def test_registry_resolves_persona_config() -> None:
    config = get_artifact_events_config("persona")

    assert config is not None
    assert config.artifact == "persona"
    assert "get" in config.operations
    assert "persona.viewed" in config.event_types


def test_registry_resolves_activity_config() -> None:
    config = get_artifact_events_config("activity")

    assert config is not None
    assert config.artifact == "activity"
    assert "get" in config.operations
    assert "activity.viewed" in config.event_types


def test_registry_resolves_attempt_config() -> None:
    config = get_artifact_events_config("attempt")

    assert config is not None
    assert config.artifact == "attempt"
    assert "message" in config.operations
    assert "attempt.assistant.progress" in config.event_types


def test_registry_resolves_auth_config() -> None:
    config = get_artifact_events_config("auth")

    assert config is not None
    assert config.artifact == "auth"
    assert "get" in config.operations
    assert "auth.viewed" in config.event_types


def test_registry_resolves_benchmark_config() -> None:
    config = get_artifact_events_config("benchmark")

    assert config is not None
    assert config.artifact == "benchmark"
    assert "get" in config.operations
    assert "benchmark.viewed" in config.event_types


def test_registry_resolves_chat_config() -> None:
    config = get_artifact_events_config("chat")

    assert config is not None
    assert config.artifact == "chat"
    assert "get" in config.operations
    assert "chat.viewed" in config.event_types


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


def test_registry_resolves_dashboard_config() -> None:
    config = get_artifact_events_config("dashboard")

    assert config is not None
    assert config.artifact == "dashboard"
    assert "get" in config.operations
    assert "dashboard.viewed" in config.event_types


def test_registry_resolves_department_config() -> None:
    config = get_artifact_events_config("department")

    assert config is not None
    assert config.artifact == "department"
    assert "get" in config.operations
    assert "department.viewed" in config.event_types


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


def test_registry_resolves_health_config() -> None:
    config = get_artifact_events_config("health")

    assert config is not None
    assert config.artifact == "health"
    assert "get" in config.operations
    assert "health.viewed" in config.event_types


def test_registry_resolves_invocation_config() -> None:
    config = get_artifact_events_config("invocation")

    assert config is not None
    assert config.artifact == "invocation"
    assert "get" in config.operations
    assert "invocation.viewed" in config.event_types


def test_registry_resolves_leaderboard_config() -> None:
    config = get_artifact_events_config("leaderboard")

    assert config is not None
    assert config.artifact == "leaderboard"
    assert "get" in config.operations
    assert "leaderboard.viewed" in config.event_types


def test_registry_resolves_profile_config() -> None:
    config = get_artifact_events_config("profile")

    assert config is not None
    assert config.artifact == "profile"
    assert "get" in config.operations
    assert "profile.viewed" in config.event_types


def test_registry_resolves_provider_config() -> None:
    config = get_artifact_events_config("provider")

    assert config is not None
    assert config.artifact == "provider"
    assert "get" in config.operations
    assert "provider.viewed" in config.event_types


def test_registry_resolves_pricing_config() -> None:
    config = get_artifact_events_config("pricing")

    assert config is not None
    assert config.artifact == "pricing"
    assert "get" in config.operations
    assert "pricing.viewed" in config.event_types


def test_registry_resolves_rubric_config() -> None:
    config = get_artifact_events_config("rubric")

    assert config is not None
    assert config.artifact == "rubric"
    assert "get" in config.operations
    assert "rubric.viewed" in config.event_types


def test_registry_returns_none_for_unknown_artifact() -> None:
    assert get_artifact_events_config("unknown") is None


def test_registry_resolves_session_config() -> None:
    config = get_artifact_events_config("session")

    assert config is not None
    assert config.artifact == "session"
    assert "get" in config.operations
    assert "session.viewed" in config.event_types


def test_registry_resolves_setting_config() -> None:
    config = get_artifact_events_config("setting")

    assert config is not None
    assert config.artifact == "setting"
    assert "get" in config.operations
    assert "setting.viewed" in config.event_types


def test_registry_resolves_simulation_config() -> None:
    config = get_artifact_events_config("simulation")

    assert config is not None
    assert config.artifact == "simulation"
    assert "get" in config.operations
    assert "simulation.viewed" in config.event_types


def test_registry_resolves_tool_config() -> None:
    config = get_artifact_events_config("tool")

    assert config is not None
    assert config.artifact == "tool"
    assert "get" in config.operations
    assert "tool.viewed" in config.event_types
