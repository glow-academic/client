"""Tests for persona event declarations."""

from app.routes.v5.api.main.persona.events import (
    CALL_LIFECYCLE_EVENTS,
    PERSONA_EVENT_CONFIGS,
    PERSONA_EVENT_TYPES,
    get_persona_event_config,
)


def test_get_persona_event_config_maps_domain_event_and_entity_scope() -> None:
    config = get_persona_event_config("get")

    assert config is not None
    assert config.domain_events == ("persona.viewed",)
    assert config.scope == "entity"
    assert config.entity_key == "persona_id"
    assert config.include_call_lifecycle is True


def test_drafts_event_config_is_collection_scoped() -> None:
    config = PERSONA_EVENT_CONFIGS["drafts"]

    assert config.domain_events == ("persona.drafts.viewed",)
    assert config.scope == "collection"
    assert config.entity_key is None
    assert config.include_call_lifecycle is False


def test_persona_event_types_include_domain_and_lifecycle_events() -> None:
    assert "persona.created" in PERSONA_EVENT_TYPES
    assert "persona.updated" in PERSONA_EVENT_TYPES
    assert "persona.drafts.viewed" in PERSONA_EVENT_TYPES
    for event_type in CALL_LIFECYCLE_EVENTS:
        assert event_type in PERSONA_EVENT_TYPES
