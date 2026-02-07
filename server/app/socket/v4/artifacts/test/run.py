"""Test run handler.

Handles the test_run WebSocket event to run ONE auto-regressive replay.
Gets context, validates prerequisites, prepares run, builds messages with
truncation (removes last assistant tool_calls), and routes to generate_artifact.

Entry types: ['replays'] - Replay response tools
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.test.permissions import (
    TestRunContext,
    format_generation_error,
    validate_test_run_access,
)
from app.socket.v4.artifacts.test.types import (
    TestErrorEvent,
    TestRunPayload,
    TestRunStartEvent,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_CONTEXT = "app/sql/v4/queries/generate/test/get_test_run_context_complete.sql"
SQL_PATH_PREPARE = "app/sql/v4/queries/generate/test/prepare_test_run_complete.sql"


def _build_messages_from_conversation(
    system_prompt: str | None,
    developer_instructions: list[str],
    original_conversation: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build messages array from original conversation.

    Auto-regressive replay pattern:
    1. Add system prompt
    2. Add developer instructions
    3. Add all messages EXCEPT remove tool_calls from last assistant message

    Args:
        system_prompt: System prompt from group config
        developer_instructions: Rendered developer instructions
        original_conversation: Original conversation from previous run

    Returns:
        Messages array ready for LLM completion
    """
    messages: list[dict[str, Any]] = []

    # Add system prompt
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Add developer instructions
    for instruction in developer_instructions:
        messages.append({"role": "developer", "content": instruction})

    # Add original conversation with truncation
    if original_conversation:
        for i, msg in enumerate(original_conversation):
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # For last assistant message, remove tool_calls to force regeneration
            is_last = i == len(original_conversation) - 1
            if is_last and role == "assistant":
                # Only include the content, not the tool_calls
                messages.append({"role": role, "content": content})
            else:
                # Include everything as-is
                message_dict: dict[str, Any] = {"role": role, "content": content}
                if "tool_calls" in msg:
                    message_dict["tool_calls"] = msg["tool_calls"]
                if "tool_call_id" in msg:
                    message_dict["tool_call_id"] = msg["tool_call_id"]
                messages.append(message_dict)

    return messages


async def _test_run_impl(sid: str, data: TestRunPayload, profile_id: uuid.UUID) -> None:
    """Handle test run with all business logic.

    This function:
    1. Fetches context and validates prerequisites
    2. Creates new run entry for replay
    3. Builds messages with auto-regressive truncation
    4. Emits test_run_start event
    5. Emits to generate_artifact handler with eval_mode=True
    """
    chat_id_str = str(data.chat_id)

    try:
        async with get_db_connection() as conn:
            # Step 1: Fetch context and validate prerequisites
            context_row = await execute_sql_typed(
                conn,
                SQL_PATH_CONTEXT,
                params={
                    "p_profile_id": profile_id,
                    "p_chat_id": data.chat_id,
                },
            )

            if not context_row:
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        chat_id=chat_id_str,
                        message="Failed to fetch test context",
                        error_type="context",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Build context dataclass for validation
            ctx = TestRunContext(
                # Base GenerationContext fields
                agent_exists=getattr(context_row, "agent_exists", False) or False,
                agent_name=getattr(context_row, "agent_name", None),
                agent_is_active=getattr(context_row, "agent_is_active", False) or False,
                model_id=getattr(context_row, "model_id", None),
                model_name=getattr(context_row, "model_name", None),
                provider_id=getattr(context_row, "provider_id", None),
                provider_name=getattr(context_row, "provider_name", None),
                has_api_key=getattr(context_row, "has_api_key", False) or False,
                requests_per_day=getattr(context_row, "requests_per_day", None),
                runs_today=getattr(context_row, "runs_today", 0) or 0,
                # Test-specific fields
                chat_id=getattr(context_row, "chat_id", None),
                chat_exists=getattr(context_row, "chat_exists", False) or False,
                chat_is_active=getattr(context_row, "chat_is_active", False) or False,
                attempt_id=getattr(context_row, "attempt_id", None),
                attempt_exists=getattr(context_row, "attempt_exists", False) or False,
                group_id=getattr(context_row, "group_id", None),
                group_exists=getattr(context_row, "group_exists", False) or False,
                has_pending_runs=getattr(context_row, "has_pending_runs", False)
                or False,
                next_run_resource_id=getattr(context_row, "next_run_resource_id", None),
                total_runs=getattr(context_row, "total_runs", 0) or 0,
                completed_runs=getattr(context_row, "completed_runs", 0) or 0,
                rubric_id=getattr(context_row, "rubric_id", None),
            )

            # Validate using business logic
            is_valid, failures = validate_test_run_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Test run validation failed - "
                    f"profile_id={profile_id}, chat_id={data.chat_id}, "
                    f"reason: {error_msg}"
                )
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        chat_id=chat_id_str,
                        message=f"Cannot run test: {error_msg}",
                        error_type="validation",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Step 2: Prepare run - creates runs_entry and returns config + conversation
            prepare_row = await execute_sql_typed(
                conn,
                SQL_PATH_PREPARE,
                params={
                    "p_profile_id": profile_id,
                    "p_chat_id": data.chat_id,
                    "p_run_resource_id": ctx.next_run_resource_id,
                },
            )

            if not prepare_row or not getattr(prepare_row, "run_id", None):
                logger.error(
                    f"Test run preparation failed - "
                    f"profile_id={profile_id}, chat_id={data.chat_id}"
                )
                await sio.emit(
                    "test_error",
                    TestErrorEvent(
                        chat_id=chat_id_str,
                        message="Failed to prepare test run",
                        error_type="prepare",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            run_id = str(prepare_row.run_id)
            group_id = str(prepare_row.group_id) if prepare_row.group_id else None
            trace_id = prepare_row.trace_id
            current_run = getattr(prepare_row, "current_run", 1) or 1
            total_runs = getattr(prepare_row, "total_runs", 1) or 1

            # Step 3: Build model config
            model_config = {
                "model": prepare_row.model_name or "",
                "api_key": prepare_row.api_key or "",
                "base_url": prepare_row.base_url or "",
                "temperature": prepare_row.temperature
                if prepare_row.temperature is not None
                else 0.0,
                "reasoning": prepare_row.reasoning or "",
                "provider": prepare_row.provider_name or "",
            }

            # Step 4: Render developer instructions
            developer_instructions = render_developer_instructions(
                templates=prepare_row.developer_instruction_templates or [],
                jinja_context=prepare_row.jinja_context or {},
            )

            # Step 5: Build messages with auto-regressive truncation
            original_conversation = prepare_row.original_conversation or []
            if isinstance(original_conversation, str):
                import json

                original_conversation = json.loads(original_conversation)

            messages = _build_messages_from_conversation(
                system_prompt=prepare_row.system_prompt,
                developer_instructions=developer_instructions,
                original_conversation=original_conversation,
            )

            # Step 6: Emit test_run_start event
            created_at_str = (
                prepare_row.created_at.isoformat() if prepare_row.created_at else ""
            )
            start_event = TestRunStartEvent(
                chat_id=chat_id_str,
                run_id=run_id,
                original_run_resource_id=str(ctx.next_run_resource_id)
                if ctx.next_run_resource_id
                else None,
                current_run=current_run,
                total_runs=total_runs,
                created_at=created_at_str,
            )
            await sio.emit(
                "test_run_start",
                start_event.model_dump(mode="json"),
                room=sid,
            )
            # Also emit to test room for multi-tab sync
            await sio.emit(
                "test_run_start",
                start_event.model_dump(mode="json"),
                room=f"test_{chat_id_str}",
            )

            # Step 7: Emit to generate_artifact handler with eval_mode=True
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "test",
                    "resource_type": "test",
                    "modality": "text",
                    "run_id": run_id,
                    "group_id": group_id,
                    "messages": messages,
                    "llm_config": model_config,
                    "tools": convert_tools_to_dict(prepare_row.tools),
                    "metadata": {
                        "trace_id": trace_id,
                        "chat_id": chat_id_str,
                        "current_run": current_run,
                        "total_runs": total_runs,
                        "original_run_resource_id": str(ctx.next_run_resource_id)
                        if ctx.next_run_resource_id
                        else None,
                    },
                    "eval_mode": True,
                },
            )

            logger.info(
                f"Test run started - "
                f"profile_id={profile_id}, chat_id={data.chat_id}, "
                f"run_id={run_id}, current={current_run}/{total_runs}"
            )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in test_run: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=chat_id_str,
                message=f"Invalid UUID format: {str(e)}",
                error_type="validation",
            ).model_dump(mode="json"),
            room=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to run test: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=chat_id_str,
                message=f"Failed to run test: {str(e)}",
                error_type="internal",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def test_run(sid: str, data: dict[str, Any]) -> None:
    """Handle test_run event (client-to-server).

    Runs ONE auto-regressive replay for the next pending run.
    Emits test_run_start on success, test_error on failure.
    """
    try:
        payload = TestRunPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=str(data.get("chat_id", "")),
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _test_run_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in test_run: {str(e)}")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                chat_id=str(data.get("chat_id", "")),
                message=f"Invalid request: {str(e)}",
                error_type="validation",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("test_run")  # type: ignore
async def test_run_internal(data: dict[str, Any]) -> None:
    """Handle test_run event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=str(data.get("chat_id", "")),
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = TestRunPayload(**data)
        await _test_run_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in test_run_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=str(data.get("chat_id", "")),
                    message=f"Invalid request: {str(e)}",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/run", response_model=dict[str, bool])
async def test_run_api(request: TestRunPayload) -> dict[str, bool]:
    """Client-to-server event: Run one auto-regressive replay."""
    return {"success": True}


@server_router.post("/test/run_start", response_model=dict[str, bool])
async def test_run_start_api(request: TestRunStartEvent) -> dict[str, bool]:
    """Server-to-client event: Test run started."""
    return {"success": True}
