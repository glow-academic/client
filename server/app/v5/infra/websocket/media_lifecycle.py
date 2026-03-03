"""Shared media generation lifecycle — adapter singleton.

Mirrors audio_lifecycle.py pattern for image/video generation.
"""

import logging

from app.v5.infra.websocket.adapters.media.litellm import LitellmMediaAdapter

logger = logging.getLogger(__name__)

_media_adapter: LitellmMediaAdapter | None = None


def get_media_adapter() -> LitellmMediaAdapter:
    """Get or create the media adapter singleton."""
    global _media_adapter
    if _media_adapter is None:
        from app.v5.api.socket.internal.media_events import get_media_emitter

        _media_adapter = LitellmMediaAdapter(emitter=get_media_emitter())
    return _media_adapter
