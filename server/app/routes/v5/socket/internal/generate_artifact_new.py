"""Generate artifact overrides (new) — tool execution via registry + create_tool_call.

Replaces the inline SQL tool execution in generate_artifact.py with the
registry-based tool_executor_new, which delegates to create_tool_call.

This is NOT a copy of generate_artifact.py (1300+ lines). Instead it provides
the replacement pieces so the swap is a minimal diff:

  1. GenerateArtifactPayloadNew — same as GenerateArtifactPayload but without save:bool
  2. execute_resource_entry_tool() — drop-in replacement for the tool execution block

To activate: in generate_artifact.py, change:
  - from app.infra.tools.tool_executor import execute_tool_call
  + from app.routes.v5.socket.internal.generate_artifact_new import execute_resource_entry_tool
  - Remove save:bool from GenerateArtifactPayload (or import GenerateArtifactPayloadNew)
  - Replace the resource/entry tool block (lines ~1067-1094) with:
      tool_result_str = await execute_resource_entry_tool(data, tool_name, arguments_dict, ...)
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from pydantic import BaseModel

from app.infra.globals import UPLOAD_FOLDER
from app.infra.tools.tool_executor_new import execute_tool_call as execute_tool_call_new
from app.infra.websocket.get_db_connection import get_db_connection


class GenerateArtifactPayloadNew(BaseModel):
    """GenerateArtifactPayload without save:bool — all results are dormant until promoted."""

    sid: str | None = None
    run_id: str
    group_id: str | None = None
    modality: str = "text"
    artifact_type: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    messages: list[dict[str, Any]]
    llm_config: Any  # ModelConfig from generate_artifact
    tools: list[dict[str, Any]] | None = None
    tool_timeout_seconds: float = 60.0
    file_path: str | None = None
    # save: bool removed — all results are soft-created, promoted later
    mime_type: str | None = None
    file_size: int | None = None
    upload_id: str | None = None
    chat_id: str | None = None
    metadata: dict[str, Any] | None = None
    profile_id: str | None = None
    profiles_id: str | None = None
    session_id: str | None = None
    artifact_id: str | None = None
    draft_id: str | None = None
    developer_instruction_templates: list[str] | None = None
    agent_id: str | None = None


async def execute_resource_entry_tool(
    *,
    data: Any,
    tool_name: str,
    arguments_dict: dict[str, Any],
    resolved_tool_id: uuid.UUID | None,
    tool_call_id: str | None = None,
    resource_type: str | None = None,
    entry_type: str | None = None,
    is_creatable: bool | None = None,
    soft: bool = True,
) -> str:
    """Execute a resource/entry tool via registry + create_tool_call.

    Drop-in replacement for the tool execution block in generate_artifact.py.
    Uses tool_executor_new which resolves the black-box function from the
    registry and delegates to create_tool_call.

    Args:
        data: The GenerateArtifactPayload (needs run_id, group_id, session_id,
              profile_id fields)
        tool_name: Tool name from the model
        arguments_dict: Parsed tool arguments
        resolved_tool_id: Pre-resolved tool UUID
        tool_call_id: External call ID for tracking
        resource_type: Pre-resolved resource type
        entry_type: Pre-resolved entry type
        is_creatable: Pre-resolved from tools_resource.operation == 'create'
        soft: If True, create dormant records (default during generation)

    Returns:
        JSON string for model consumption.
    """
    if not resolved_tool_id:
        return json.dumps({
            "success": False,
            "message": f"Tool not found: {tool_name}",
            "error_stage": "tool_resolve",
        })

    # Resolve pipeline context from data
    group_id = uuid.UUID(data.group_id) if data.group_id else uuid.UUID(int=0)
    session_id = uuid.UUID(data.session_id) if data.session_id else uuid.UUID(int=0)
    profile_id = uuid.UUID(data.profile_id) if data.profile_id else uuid.UUID(int=0)

    async with get_db_connection() as conn:
        return await execute_tool_call_new(
            conn=conn,
            tool_name=tool_name,
            arguments=arguments_dict,
            tool_id=resolved_tool_id,
            group_id=group_id,
            session_id=session_id,
            profile_id=profile_id,
            upload_folder=UPLOAD_FOLDER,
            run_id=uuid.UUID(data.run_id) if data.run_id else None,
            resource_type=resource_type,
            entry_type=entry_type,
            is_creatable=is_creatable,
            soft=soft,
            mcp=False,
        )
