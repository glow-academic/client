"""Benchmark eval handler - routes eval_start events to generate_artifact with eval_mode=True."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio

internal_sio = get_internal_sio()


# Generic handler for any agent eval_start event
# Pattern: {agent_name}_eval_start (e.g., simulation_eval_start, voice_eval_start)
@internal_sio.on("simulation_eval_start")  # type: ignore
async def simulation_eval_start_internal(data: dict[str, Any]) -> None:
    """Handle simulation_eval_start - route to generate_artifact with eval_mode=True."""
    await _handle_agent_eval_start(data)


# Generic handler for any tool eval_start event
# Pattern: {tool_name}_eval_start (e.g., classification_eval_start, hint_eval_start)
@internal_sio.on("classification_eval_start")  # type: ignore
async def classification_eval_start_internal(data: dict[str, Any]) -> None:
    """Handle classification_eval_start - route to generate_artifact with eval_mode=True."""
    await _handle_tool_eval_start(data)


async def _handle_agent_eval_start(data: dict[str, Any]) -> None:
    """Generic handler for agent eval_start events."""
    try:
        sid = data.get("sid", "internal")
        test_id = data.get("test_id")
        attempt_id = data.get("attempt_id")
        eval_id = data.get("eval_id")
        run_id = data.get("run_id")
        group_id = data.get("group_id")
        agent_id = data.get("agent_id")
        
        if not test_id or not attempt_id or not eval_id or not agent_id:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id or "unknown",
                    "eval_id": eval_id or "unknown",
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Missing required eval parameters",
                    "sid": sid,
                },
            )
            return
        
        # Get profile_id from sid
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Profile not found for socket",
                    "sid": sid,
                },
            )
            return
        
        # Call generate_artifact with eval_mode=True
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "agent_id": str(agent_id),
                "resource_types": ["text"],  # Default for evals
                "artifact_type": "eval",  # Or could be agent-specific
                "group_id": str(group_id) if group_id else None,  # CRITICAL: group_id links everything
                "message_ids": None,
                "eval_mode": True,  # CRITICAL: Enable eval mode
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.get("attempt_id", "unknown"),
                "eval_id": data.get("eval_id", "unknown"),
                "test_id": data.get("test_id"),
                "run_id": data.get("run_id"),
                "group_id": data.get("group_id"),
                "error_message": str(e),
                "sid": data.get("sid", "internal"),
            },
        )


async def _handle_tool_eval_start(data: dict[str, Any]) -> None:
    """Generic handler for tool eval_start events."""
    try:
        sid = data.get("sid", "internal")
        test_id = data.get("test_id")
        attempt_id = data.get("attempt_id")
        eval_id = data.get("eval_id")
        run_id = data.get("run_id")
        group_id = data.get("group_id")
        tool_id = data.get("tool_id")
        
        if not test_id or not attempt_id or not eval_id or not tool_id:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id or "unknown",
                    "eval_id": eval_id or "unknown",
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Missing required eval parameters",
                    "sid": sid,
                },
            )
            return
        
        # Get profile_id from sid
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Profile not found for socket",
                    "sid": sid,
                },
            )
            return
        
        # For tool evals, we need to get the agent_id associated with the tool
        # TODO: Query SQL to get agent_id from tool_id if needed
        # For now, tools might need a different approach - this is a placeholder
        # Tools might not use generate_artifact directly - they might have their own handlers
        
        # Call generate_artifact with eval_mode=True (if tool uses artifact generation)
        # Note: Some tools might not use generate_artifact - they might have custom handlers
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "agent_id": None,  # Tools might not have agent_id - need to determine from tool_id
                "resource_types": ["text"],  # Default for evals
                "artifact_type": "eval",  # Or could be tool-specific
                "group_id": str(group_id) if group_id else None,  # CRITICAL: group_id links everything
                "message_ids": None,
                "eval_mode": True,  # CRITICAL: Enable eval mode
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "benchmark_error",
            {
                "attempt_id": data.get("attempt_id", "unknown"),
                "eval_id": data.get("eval_id", "unknown"),
                "test_id": data.get("test_id"),
                "run_id": data.get("run_id"),
                "group_id": data.get("group_id"),
                "error_message": str(e),
                "sid": data.get("sid", "internal"),
            },
        )
