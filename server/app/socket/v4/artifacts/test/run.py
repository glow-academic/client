"""Test run handler.

Handles the test_run WebSocket event to run ONE auto-regressive replay.
Uses get_test_websocket() for pre-fetched data + Python orchestration.

Follows the attempt/grade.py pattern:
1. get_test_websocket() resolves config chain (agent/model/provider)
2. Python validates prerequisites and extracts LLM config
3. Parallel fetch for tools/prompts/instructions from invocation's resource IDs
4. Slim SQL handles mutations only (run/config creation)
5. Jinja rendering in Python
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.test.get import get_test_websocket
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.keys.get import get_keys_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.test.types import (
    TestErrorEvent,
    TestRunPayload,
    TestRunStartEvent,
)
from app.sql.types import (
    GetToolsByResourceIdsSqlParams,
    GetToolsByResourceIdsSqlRow,
    PrepareTestRunSqlParams,
    PrepareTestRunSqlRow,
    QGetModelsV4Item,
    QGetProvidersV4Item,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_PREPARE = "app/sql/v4/queries/generate/test/prepare_test_run_complete.sql"
SQL_PATH_TOOLS = (
    "app/sql/v4/queries/generate/test/get_tools_by_resource_ids_complete.sql"
)


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


def _determine_next_run(
    invocation_run_ids: list[uuid.UUID],
    run_ids: list[uuid.UUID],
) -> tuple[uuid.UUID | None, int, int]:
    """Determine the next pending template run to replay.

    Compares configured template runs (run_ids) against completed runs
    (invocation_run_ids) to find the next unexecuted template.

    Returns:
        (next_run_resource_id, current_run_number, total_runs)
    """
    total_runs = len(run_ids)
    completed_runs = len(invocation_run_ids)

    if completed_runs >= total_runs:
        return None, total_runs, total_runs

    next_run_resource_id = (
        run_ids[completed_runs] if completed_runs < total_runs else None
    )
    current_run = completed_runs + 1

    return next_run_resource_id, current_run, total_runs


async def _test_run_impl(sid: str, data: TestRunPayload, profile_id: uuid.UUID) -> None:
    """Handle test run with all business logic.

    This function:
    1. Fetches pre-fetched data via get_test_websocket()
    2. Picks target invocation and determines next run
    3. Validates prerequisites
    4. Fetches resources from invocation's singular IDs in parallel
    5. Fetches original conversation from template run
    6. Fetches tools from bundle department's tool_ids
    7. Calls slim prepare SQL (mutations only)
    8. Renders developer instructions and builds messages
    9. Emits to generate_artifact handler
    """
    chat_id_str = str(data.chat_id)

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # Step 1: Fetch pre-fetched data via get_test_websocket()
        async with pool.acquire() as conn:
            result = await get_test_websocket(
                conn=conn,
                test_id=data.test_id,
                bypass_cache=True,
            )

        if not result.views or not result.views.benchmark_invocations:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="Failed to fetch test data",
                    error_type="context",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 2: Pick target invocation
        invocation = next(
            (
                inv
                for inv in result.views.benchmark_invocations
                if str(inv.invocation_id) == chat_id_str
            ),
            None,
        )

        if not invocation:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="Test chat does not exist",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Determine next pending run
        next_run_resource_id, current_run, total_runs = _determine_next_run(
            invocation_run_ids=invocation.invocation_run_ids,
            run_ids=invocation.run_ids,
        )

        if not next_run_resource_id:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="No pending runs to execute",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 3: Validate prerequisites from websocket data
        if not result.resources:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="No configuration found for test",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Get config agent from websocket resources
        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="No agent configuration found",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        if not model_resource:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message=f"Agent '{agent_resource.name}' has no model configured",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        if not provider_resource:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message=f"Model '{model_resource.name}' has no provider configured",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Extract base LLM config from websocket resources
        model_name = model_resource.value or model_resource.name or ""
        base_url = provider_resource.endpoint or ""
        api_key = provider_resource.key or ""
        temperature: float = (
            agent_resource.temperature
            if hasattr(agent_resource, "temperature")
            and agent_resource.temperature is not None
            else 0.0
        )
        reasoning = (
            agent_resource.reasoning if hasattr(agent_resource, "reasoning") else None
        )
        provider_name = provider_resource.value or provider_resource.name or ""

        if not api_key:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message=f"No API key configured for provider '{provider_name}'",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        group_id = invocation.group_id
        if not group_id:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    chat_id=chat_id_str,
                    message="Test configuration (group) not found",
                    error_type="validation",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 4: Parallel fetch resources from invocation's singular IDs
        # These override the base config from the agent
        async def fetch_override_model() -> QGetModelsV4Item | None:
            if not invocation.model_id:
                return None
            async with pool.acquire() as c:
                models = await get_models_internal(c, [invocation.model_id])
                return models[0] if models else None

        async def fetch_override_provider(
            mid: uuid.UUID | None,
        ) -> QGetProvidersV4Item | None:
            """Fetch provider for the invocation's model (if overridden)."""
            if not mid:
                return None
            async with pool.acquire() as c:
                models = await get_models_internal(c, [mid])
                if models and models[0].provider_id:
                    providers = await get_providers_internal(c, [models[0].provider_id])
                    return providers[0] if providers else None
            return None

        async def fetch_prompt() -> str:
            if not invocation.prompt_id:
                # Fall back to agent's prompt
                if hasattr(agent_resource, "prompt_id") and agent_resource.prompt_id:
                    async with pool.acquire() as c:
                        prompts = await get_prompts_internal(
                            c, [agent_resource.prompt_id]
                        )
                        if prompts and prompts[0].system_prompt:
                            return prompts[0].system_prompt
                return ""
            async with pool.acquire() as c:
                prompts = await get_prompts_internal(c, [invocation.prompt_id])
                if prompts and prompts[0].system_prompt:
                    return prompts[0].system_prompt
            return ""

        async def fetch_instructions() -> list[str]:
            instruction_ids = invocation.instruction_ids
            if not instruction_ids:
                # Fall back to agent's instructions
                if (
                    hasattr(agent_resource, "instruction_ids")
                    and agent_resource.instruction_ids
                ):
                    instruction_ids = agent_resource.instruction_ids
                else:
                    return []
            async with pool.acquire() as c:
                instructions = await get_instructions_internal(c, instruction_ids)
                return [inst.template for inst in instructions if inst.template]

        async def fetch_key_override() -> str | None:
            if not invocation.key_id:
                return None
            async with pool.acquire() as c:
                keys = await get_keys_internal(c, [invocation.key_id])
                if keys and keys[0].key:
                    return keys[0].key
            return None

        async def fetch_temperature_override() -> float | None:
            if not invocation.temperature_level_id:
                return None
            async with pool.acquire() as c:
                temps = await get_temperature_levels_internal(
                    c, [invocation.temperature_level_id]
                )
                if temps and temps[0].temperature is not None:
                    return temps[0].temperature
            return None

        async def fetch_reasoning_override() -> str | None:
            if not invocation.reasoning_level_id:
                return None
            async with pool.acquire() as c:
                levels = await get_reasoning_levels_internal(
                    c, [invocation.reasoning_level_id]
                )
                if levels and levels[0].reasoning_level:
                    return levels[0].reasoning_level
            return None

        async def fetch_tools() -> list[Any]:
            if not invocation.tool_ids:
                return []
            async with pool.acquire() as c:
                tools_params = GetToolsByResourceIdsSqlParams(
                    p_tool_resource_ids=invocation.tool_ids,
                )
                tools_row = cast(
                    GetToolsByResourceIdsSqlRow,
                    await execute_sql_typed(c, SQL_PATH_TOOLS, params=tools_params),
                )
                return tools_row.tools if tools_row and tools_row.tools else []

        async def fetch_original_conversation() -> list[dict[str, Any]]:
            """Fetch original conversation from template run resource ID."""
            async with pool.acquire() as c:
                # Resolve runs_resource -> runs_entry via runs_runs_connection
                row = await c.fetchrow(
                    """
                    SELECT rrc.run_id as runs_entry_id
                    FROM runs_runs_connection rrc
                    WHERE rrc.runs_id = $1 AND rrc.active = true
                    LIMIT 1
                    """,
                    next_run_resource_id,
                )
                if not row:
                    return []

                # Fetch messages from runs_entry
                messages_rows = await c.fetch(
                    """
                    SELECT
                        m.role::text as role,
                        COALESCE(t.content, '') as content,
                        m.created_at
                    FROM messages_entry m
                    LEFT JOIN texts_entry t ON t.id = m.text_id
                    WHERE m.run_id = $1 AND m.active = true
                    ORDER BY m.created_at
                    """,
                    row["runs_entry_id"],
                )
                return [
                    {"role": r["role"], "content": r["content"]} for r in messages_rows
                ]

        # Run all fetches in parallel
        (
            override_model,
            system_prompt,
            developer_instruction_templates,
            key_override,
            temperature_override,
            reasoning_override,
            tools,
            original_conversation,
        ) = await asyncio.gather(
            fetch_override_model(),
            fetch_prompt(),
            fetch_instructions(),
            fetch_key_override(),
            fetch_temperature_override(),
            fetch_reasoning_override(),
            fetch_tools(),
            fetch_original_conversation(),
        )

        # Apply overrides from invocation's bundle department
        if override_model:
            model_name = override_model.value or override_model.name or model_name
            # Also need to fetch the provider for the overridden model
            if override_model.provider_id:
                async with pool.acquire() as c:
                    override_providers = await get_providers_internal(
                        c, [override_model.provider_id]
                    )
                    if override_providers and override_providers[0]:
                        op = override_providers[0]
                        base_url = op.endpoint or base_url
                        if op.key:
                            api_key = op.key
                        provider_name = op.value or op.name or provider_name

        if key_override:
            api_key = key_override
        if temperature_override is not None:
            temperature = temperature_override
        if reasoning_override:
            reasoning = reasoning_override

        # Step 5: Slim prepare SQL (mutations only)
        agents_resource_id = agent_resource.id if agent_resource else None
        models_resource_id = model_resource.id if model_resource else None
        providers_resource_id = provider_resource.id if provider_resource else None

        async with get_db_connection() as conn:
            prepare_params = PrepareTestRunSqlParams(
                p_profile_id=profile_id,
                p_group_id=group_id,
                p_agents_resource_id=agents_resource_id,
                p_models_resource_id=models_resource_id,
                p_providers_resource_id=providers_resource_id,
            )
            prepare_row = cast(
                PrepareTestRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row or not prepare_row.run_id:
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

        # Step 6: Render developer instructions + build messages
        developer_instructions = render_developer_instructions(
            templates=developer_instruction_templates,
            jinja_context={},
        )

        messages = _build_messages_from_conversation(
            system_prompt=system_prompt,
            developer_instructions=developer_instructions,
            original_conversation=original_conversation,
        )

        # Step 7: Build model config
        llm_config = {
            "model": model_name,
            "api_key": api_key,
            "base_url": base_url,
            "temperature": temperature,
            "reasoning": reasoning or "",
            "provider": provider_name,
        }

        # Step 8: Emit test_run_start event
        created_at_str = (
            prepare_row.created_at.isoformat() if prepare_row.created_at else ""
        )
        start_event = TestRunStartEvent(
            chat_id=chat_id_str,
            run_id=run_id,
            original_run_resource_id=str(next_run_resource_id),
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

        # Step 9: Emit to generate_artifact handler
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "test",
                "resource_type": "test",
                "modality": "text",
                "run_id": run_id,
                "group_id": str(group_id),
                "chat_id": chat_id_str,
                "test_id": str(data.test_id),
                "original_run_resource_id": str(next_run_resource_id),
                "current_run": current_run,
                "total_runs": total_runs,
                "run_all": data.run_all,
                "messages": messages,
                "llm_config": llm_config,
                "tools": convert_tools_to_dict(tools),
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
