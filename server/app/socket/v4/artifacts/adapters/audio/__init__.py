"""Audio adapters for voice mode."""

from app.socket.v4.artifacts.adapters.audio.base import BaseAudioAdapter
from app.socket.v4.artifacts.adapters.audio.openai import OpenAIRealtimeAdapter

__all__ = ["BaseAudioAdapter", "OpenAIRealtimeAdapter"]
