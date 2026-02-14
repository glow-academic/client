"""Audio adapters for voice mode."""

from app.infra.v4.websocket.adapters.audio.base import BaseAudioAdapter
from app.infra.v4.websocket.adapters.audio.openai import OpenAIRealtimeAdapter

__all__ = ["BaseAudioAdapter", "OpenAIRealtimeAdapter"]
