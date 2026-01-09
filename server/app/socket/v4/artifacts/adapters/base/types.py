"""Common types for artifact generation adapters."""

import uuid
from typing import Any, Literal

from pydantic import BaseModel


class ModelConfig(BaseModel):
    """Model configuration from database."""

    provider: str
    model_name: str
    api_key: str
    base_url: str | None = None
    custom_model: str | None = None


class AgentConfig(BaseModel):
    """Agent configuration from SQL result."""

    agent_id: str
    agent_name: str | None = None
    system_prompt: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    model_id: str | None = None
    model_name: str | None = None
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    custom_model: str | None = None
    provider_id: str | None = None
    provider_name: str | None = None


class ImageGenerationResult(BaseModel):
    """Unified image generation result."""

    image_bytes: bytes
    mime_type: str  # "image/png", "image/jpeg", etc.
    file_size: int


class VideoGenerationResult(BaseModel):
    """Unified video generation result."""

    video_bytes: bytes
    mime_type: str  # "video/mp4", etc.
    file_size: int
    upload_id: uuid.UUID


class AudioSessionConfig(BaseModel):
    """Unified audio session configuration returned to frontend."""

    type: Literal["webrtc", "websocket"]
    run_id: str
    # WebRTC-specific fields (OpenAI)
    ephemeral_key: str | None = None
    expires_in: int | None = None
    model: str | None = None
    tools: list[dict[str, Any]] | None = None  # Provider-formatted tools
    instructions: str | None = None
    history: list[dict[str, Any]] | None = None  # Provider-formatted history
    voice: str | None = None
    transcription_model: str | None = None
    transcription_prompt: str | None = None
    # WebSocket-specific fields (future Gemini)
    websocket_url: str | None = None
    auth_token: str | None = None


class ToolCallResult(BaseModel):
    """Unified tool call result - matches database schema."""

    tool_call_id: uuid.UUID
    call_id: str
    tool_name: str
    tool_type: str
    arguments_json: dict[str, Any]  # Matches tool_call_arguments.arguments_json
    arguments_raw: str  # Matches tool_call_arguments.arguments_raw
    result_content: str  # Matches tool_call_results.result_content
    result_json: dict[str, Any] | None = None  # Matches tool_call_results.result_json


class DocumentGenerationResult(BaseModel):
    """Unified document generation result."""

    document_id: uuid.UUID
    html_content: str
    file_path: str | None = None
