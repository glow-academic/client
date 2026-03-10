"""Tests for websocket media lifecycle singleton."""

import app.infra.websocket.media_lifecycle as media_lifecycle


class FakeMediaAdapter:
    def __init__(self, emitter):
        self.emitter = emitter


class TestMediaLifecycle:
    def setup_method(self):
        media_lifecycle._media_adapter = None

    def teardown_method(self):
        media_lifecycle._media_adapter = None

    def test_get_media_adapter_creates_singleton(self, monkeypatch):
        emitter = object()

        monkeypatch.setattr(media_lifecycle, "LitellmMediaAdapter", FakeMediaAdapter)
        monkeypatch.setattr(
            "app.routes.v5.socket.internal.media_events.get_media_emitter",
            lambda: emitter,
        )

        first = media_lifecycle.get_media_adapter()
        second = media_lifecycle.get_media_adapter()

        assert first is second
        assert first.emitter is emitter

