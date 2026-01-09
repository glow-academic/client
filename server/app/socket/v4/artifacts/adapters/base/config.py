"""Adapter configuration models for database-free adapters."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from agents import Tool
from agents.items import TResponseInputItem
from pydantic import BaseModel


class AdapterConfig(BaseModel):
    """Raw configuration passed to adapters - no database access needed."""

    # API Configuration
    api_key: str  # Already decrypted
    model_name: str
    provider: str
    base_url: str | None = None
    custom_model: str | None = None

    # Agent Configuration
    agent_name: str
    system_prompt: str
    temperature: float
    reasoning: str | None = None

    # Tools (already built)
    tools: list[Tool] = []  # Already built from configs

    # Messages (already formatted)
    input_items: list[TResponseInputItem] = []  # Already formatted from database

    # Run Context
    run_id: uuid.UUID
    trace_id: str | None = None
    group_id: uuid.UUID | None = None
    resource_id: uuid.UUID | None = None  # For callbacks
    resource_type: str = ""  # For callbacks

    # Modality-specific
    prompt: str | None = None  # For image/video
    image_id: uuid.UUID | None = None  # For image
    video_id: uuid.UUID | None = None  # For video
    upload_id: uuid.UUID | None = None  # For audio
    file_path: str | None = None  # For audio input
    department_id: uuid.UUID | None = None  # For context
    image_reference_id: str | None = None  # For video (image reference)
    
    # Tool tracking (for text adapter)
    tool_name_to_type: dict[str, str] = {}  # Mapping from tool name to tool type
    required_tool_names: set[str] = set()  # Set of required tool names


class AdapterEventCallbacks(BaseModel):
    """Event callbacks for adapter event emission."""

    emit_progress: Callable[[str, dict[str, Any]], Awaitable[None]]
    emit_complete: Callable[[str, dict[str, Any]], Awaitable[None]]
    emit_error: Callable[[str, dict[str, Any]], Awaitable[None]]
