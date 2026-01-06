"""Base types and interfaces for artifact generation adapters."""

import uuid
from abc import ABC, abstractmethod
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


class BaseTextAdapter(ABC):
    """Base interface for text generation adapters."""

    @abstractmethod
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> None:
        """Generate text using provider-specific logic.

        Args:
            sid: Socket ID
            data: Request data containing run_id, agent_id, resource_id, etc.
            profile_id: Profile ID
            conn: Database connection
        """
        pass


class BaseImageAdapter(ABC):
    """Base interface for image generation adapters."""

    @abstractmethod
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> ImageGenerationResult:
        """Generate image - returns unified result type.

        Args:
            sid: Socket ID
            data: Request data containing image_id, prompt, etc.
            profile_id: Profile ID (optional)
            conn: Database connection

        Returns:
            ImageGenerationResult with image_bytes, mime_type, file_size
        """
        pass


class BaseVideoAdapter(ABC):
    """Base interface for video generation adapters."""

    @abstractmethod
    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID | None,
        conn: Any,
    ) -> VideoGenerationResult:
        """Generate video - returns unified result type.

        Args:
            sid: Socket ID
            data: Request data containing videoId, prompt, etc.
            profile_id: Profile ID (optional)
            conn: Database connection

        Returns:
            VideoGenerationResult with video_bytes, mime_type, file_size, upload_id
        """
        pass


class BaseAudioAdapter(ABC):
    """Base interface for audio generation adapters."""

    @abstractmethod
    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """Returns whether this adapter uses WebRTC or WebSocket."""
        pass

    @abstractmethod
    async def initialize_session(
        self,
        conn: Any,
        agent_config: AgentConfig,
        resource_id: uuid.UUID,
        resource_type: str,
        run_id: uuid.UUID,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize audio session - adapter fetches what it needs from DB.

        Args:
            conn: Database connection
            agent_config: Agent configuration from SQL
            resource_id: Resource ID (chat_id for voice, upload_id for audio)
            resource_type: Resource type ("voice" | "audio")
            run_id: Run ID (already created)
            **kwargs: Additional parameters

        Returns:
            AudioSessionConfig with provider-specific details abstracted
        """
        pass

    @abstractmethod
    async def handle_webrtc_event(
        self,
        conn: Any,
        event_type: str,
        event_data: dict[str, Any],
        run_id: uuid.UUID,
    ) -> None:
        """Handle WebRTC forwarding events from frontend.

        Args:
            conn: Database connection
            event_type: Event type (audio_user_start, audio_assistant_progress, etc.)
            event_data: Event payload data
            run_id: Run ID
        """
        pass


class BaseToolCallAdapter(ABC):
    """Base interface for tool call streaming adapters."""

    @abstractmethod
    async def stream_tool_calls(
        self,
        runner: Any,
        sid: str,
        resource_id: str | None,
        resource_type: str,
        run_id: uuid.UUID,
        group_id: uuid.UUID | None,
        tool_name_to_type: dict[str, str],
        required_tool_names: set[str],
    ) -> set[str]:
        """Stream tool calls - returns unified result types.

        Args:
            runner: Runner instance from Runner.run_streamed()
            sid: Socket ID
            resource_id: Resource ID (optional)
            resource_type: Resource type
            run_id: Model run ID
            group_id: Group ID (optional)
            tool_name_to_type: Mapping from tool name to tool type
            required_tool_names: Set of required tool names to verify completion

        Returns:
            Set of completed tool names
        """
        pass
