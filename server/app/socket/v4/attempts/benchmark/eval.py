"""Benchmark eval handler - routes eval_start events to generate_artifact with eval_mode=True."""

import uuid
from typing import Any

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

TEXT_RUN_CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"
)

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
        message_ids = data.get("message_ids")
        
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
        
        if not run_id:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Missing run_id for eval start",
                    "sid": sid,
                },
            )
            return

        async with get_db_connection() as conn:
            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                uuid.UUID(agent_id),
                message_ids,
                uuid.UUID(group_id) if group_id else None,
                None,
            )

            if not run_context_row:
                await internal_sio.emit(
                    "benchmark_error",
                    {
                        "attempt_id": attempt_id,
                        "eval_id": eval_id,
                        "test_id": test_id,
                        "run_id": run_id,
                        "group_id": group_id,
                        "error_message": "Failed to load eval run context",
                        "sid": sid,
                    },
                )
                return

            system_prompt = run_context_row.get("system_prompt")
            developer_templates = run_context_row.get("developer_instruction_templates")
            context = run_context_row.get("context")
            rendered_developer_messages = render_developer_instructions(
                templates=developer_templates,
                jinja_context=context,
            )

            payload_messages = data.get("messages")
            if payload_messages and isinstance(payload_messages, list):
                messages = payload_messages
            else:
                messages: list[dict[str, Any]] = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                for dev_msg in rendered_developer_messages:
                    messages.append({"role": "developer", "content": dev_msg})
                for user_msg in data.get("user_instructions") or []:
                    messages.append({"role": "user", "content": user_msg})

            tools = convert_tools_to_dict(run_context_row.get("tools"))

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "eval",
                    "resource_type": "eval",
                    "run_id": str(run_id),
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": run_context_row.get("model_name"),
                        "api_key": run_context_row.get("api_key"),
                        "base_url": run_context_row.get("base_url"),
                        "temperature": run_context_row.get("temperature"),
                        "reasoning": run_context_row.get("reasoning"),
                        "provider": run_context_row.get("provider"),
                    },
                    "tools": tools,
                    "metadata": {"trace_id": run_context_row.get("trace_id")},
                    "eval_mode": True,
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
        messages = data.get("messages")
        model_config = data.get("model_config")
        
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
        
        if not messages or not model_config:
            await internal_sio.emit(
                "benchmark_error",
                {
                    "attempt_id": attempt_id,
                    "eval_id": eval_id,
                    "test_id": test_id,
                    "run_id": run_id,
                    "group_id": group_id,
                    "error_message": "Tool eval missing messages/model_config",
                    "sid": sid,
                },
            )
            return

        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "eval",
                "resource_type": "eval",
                "run_id": str(run_id) if run_id else str(uuid.uuid4()),
                "group_id": str(group_id) if group_id else None,
                "message_id": None,
                "messages": messages,
                "llm_config": model_config,
                "tools": data.get("tools"),
                "metadata": {"trace_id": data.get("trace_id")},
                "eval_mode": True,
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
