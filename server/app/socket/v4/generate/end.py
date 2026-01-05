"""Handler for generation completion events - handles log_run and dispatches to agent end handlers."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateEndApiRequest(BaseModel):
    """Payload for generation completion events."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    resource_id: str | None = None
    resource_type: str | None = None  # agent_role
    run_id: str
    group_id: str | None = None
    department_id: str | None = None
    # For tool_call_complete
    tool_call_id: str | None = None
    call_id: str | None = None
    tool_name: str | None = None
    tool_type: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None
    # For run_complete (usage data)
    input_text_tokens: int | None = None
    output_text_tokens: int | None = None
    system_prompt: str | None = None
    input_items: list[dict[str, Any]] | None = None
    assistant_output: str | None = None


# Mapping from agent_role to agent end event name
AGENT_END_MAPPING = {
    "scenario": "scenario_end",
    "document": "document_end",
    "simulation": "simulation_end",
    "grade": "grade_end",
    "hint": "hint_end",
    "classify": "classify_end",
    "member": "member_end",
    "prompt": "prompt_end",
    "rubric": "rubric_end",
    "title": "title_end",
    "audio": "audio_end",
    "image": "image_end",
    "video": "video_end",
    "voice": "voice_end",
}


async def _generate_end_impl(
    sid: str,
    data: GenerateEndApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle generation completion - emits log_run and dispatches to agent end handlers."""
    try:
        # For run_complete events, emit log_run first
        if data.type == "run_complete":
            # Extract usage data and emit log_run
            if (
                data.input_text_tokens is not None
                and data.output_text_tokens is not None
            ):
                await internal_sio.emit(
                    "log_run",
                    {
                        "run_id": data.run_id,
                        "operation_type": data.resource_type or "text",
                        "input_text_tokens": data.input_text_tokens,
                        "output_text_tokens": data.output_text_tokens,
                        "system_prompt": data.system_prompt,
                        "input_items": data.input_items,
                        "assistant_output": data.assistant_output,
                        "department_id": data.department_id,
                    },
                )
        
        # Determine agent end event name from resource_type
        agent_end_event = AGENT_END_MAPPING.get(
            data.resource_type or "text", "text_end"
        )
        
        # Dispatch to agent-specific end handler
        await internal_sio.emit(
            agent_end_event,
            {
                "sid": sid,
                "type": data.type,
                "resource_id": data.resource_id,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "department_id": data.department_id,
                "tool_call_id": data.tool_call_id,
                "call_id": data.call_id,
                "tool_name": data.tool_name,
                "tool_type": data.tool_type,
                "final_content": data.final_content,
                "arguments_raw": data.arguments_raw,
            },
        )
    except Exception as e:
        # Emit error to generate_error handler
        await emit_to_internal(
            "generate_error",
            {
                "sid": sid,
                "error_message": f"Failed to handle generation completion: {str(e)}",
                "resource_id": data.resource_id,
                "group_id": data.group_id,
                "resource_type": data.resource_type,
            },
            sid=sid,
        )


@internal_sio.on("generate_text_complete")  # type: ignore
async def generate_text_complete_internal(data: dict[str, Any]) -> None:
    """Handle generate_text_complete event - routes to generate_end."""
    # Transform to GenerateEndApiRequest format
    payload = GenerateEndApiRequest(
        sid=data.get("sid", ""),
        type=data.get("type", "run_complete"),
        resource_id=data.get("resource_id"),
        resource_type=data.get("resource_type"),
        run_id=data.get("run_id", ""),
        group_id=data.get("group_id"),
        department_id=data.get("department_id"),
        tool_call_id=data.get("tool_call_id"),
        call_id=data.get("call_id"),
        tool_name=data.get("tool_name"),
        tool_type=data.get("tool_type"),
        final_content=data.get("final_content"),
        arguments_raw=data.get("arguments_raw"),
    )
    
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket
    
    profile_id_str = await find_profile_by_socket(payload.sid)
    if not profile_id_str:
        return
    
    profile_id = uuid.UUID(profile_id_str)
    await _generate_end_impl(payload.sid, payload, profile_id)


@internal_sio.on("generate_image_complete")  # type: ignore
async def generate_image_complete_internal(data: dict[str, Any]) -> None:
    """Handle generate_image_complete event - routes to generate_end."""
    payload = GenerateEndApiRequest(
        sid=data.get("sid", ""),
        type=data.get("type", "run_complete"),
        resource_id=data.get("resource_id"),
        resource_type="image",
        run_id=data.get("run_id", ""),
        group_id=data.get("group_id"),
        department_id=data.get("department_id"),
    )
    
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket
    
    profile_id_str = await find_profile_by_socket(payload.sid)
    if not profile_id_str:
        return
    
    profile_id = uuid.UUID(profile_id_str)
    await _generate_end_impl(payload.sid, payload, profile_id)


@internal_sio.on("generate_video_complete")  # type: ignore
async def generate_video_complete_internal(data: dict[str, Any]) -> None:
    """Handle generate_video_complete event - routes to generate_end."""
    payload = GenerateEndApiRequest(
        sid=data.get("sid", ""),
        type=data.get("type", "run_complete"),
        resource_id=data.get("resource_id"),
        resource_type="video",
        run_id=data.get("run_id", ""),
        group_id=data.get("group_id"),
        department_id=data.get("department_id"),
    )
    
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket
    
    profile_id_str = await find_profile_by_socket(payload.sid)
    if not profile_id_str:
        return
    
    profile_id = uuid.UUID(profile_id_str)
    await _generate_end_impl(payload.sid, payload, profile_id)


@internal_sio.on("generate_audio_complete")  # type: ignore
async def generate_audio_complete_internal(data: dict[str, Any]) -> None:
    """Handle generate_audio_complete event - routes to generate_end."""
    payload = GenerateEndApiRequest(
        sid=data.get("sid", ""),
        type=data.get("type", "run_complete"),
        resource_id=data.get("resource_id"),
        resource_type="voice",
        run_id=data.get("run_id", ""),
        group_id=data.get("group_id"),
        department_id=data.get("department_id"),
    )
    
    from app.infra.v4.websocket.find_profile_by_socket import \
        find_profile_by_socket
    
    profile_id_str = await find_profile_by_socket(payload.sid)
    if not profile_id_str:
        return
    
    profile_id = uuid.UUID(profile_id_str)
    await _generate_end_impl(payload.sid, payload, profile_id)


register_server_endpoint(
    server_router,
    "/generate_end",
    GenerateEndApiRequest,
    "Handle generation completion events",
)

