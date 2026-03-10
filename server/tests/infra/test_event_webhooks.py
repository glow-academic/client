"""Tests for webhook helper plumbing."""

from app.infra.events.webhooks import resolve_webhook_target


def test_resolve_webhook_target_returns_hardcoded_demo_mapping() -> None:
    assert resolve_webhook_target("demo-license-key") == "http://localhost:9000/events"


def test_resolve_webhook_target_returns_none_for_unknown_key() -> None:
    assert resolve_webhook_target("missing-license-key") is None
