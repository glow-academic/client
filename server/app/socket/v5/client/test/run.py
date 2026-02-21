"""Test run handler.

Handles: test_run — run ONE auto-regressive replay.
"""

import asyncio
import uuid
from typing import Any, cast

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
from app.socket.v4.artifacts.test.run import (
    _build_messages_from_conversation,
    _determine_next_run,
)
from app.socket.v5.client.types import TestRunPayload
from app.sql.types import (
    GetToolsByResourceIdsSqlParams,
    GetToolsByResourceIdsSqlRow,
    PrepareTestRunSqlParams,
    PrepareTestRunSqlRow,
    QGetModelsV4Item,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PREPARE = "app/sql/v4/queries/generate/test/prepare_test_run_complete.sql"
SQL_PATH_TOOLS = (
    "app/sql/v4/queries/generate/test/get_tools_by_resource_ids_complete.sql"
)


@sio.event  # type: ignore
async def test_run(sid: str, data: dict[str, Any]) -> None:
    """Handle test_run event from client."""
    try:
        payload = TestRunPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            invocation_id_str = str(data.get("invocation_id", ""))
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": [sid, f"test_{invocation_id_str}"]
                    if invocation_id_str
                    else [sid],
                    "invocation_id": invocation_id_str,
                    "message": "Profile not found. Please reconnect.",
                    "error_type": "auth",
                },
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _test_run_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in test_run: {e}")
        invocation_id_str = str(data.get("invocation_id", ""))
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": [sid, f"test_{invocation_id_str}"]
                if invocation_id_str
                else [sid],
                "invocation_id": invocation_id_str,
                "message": f"Invalid request: {e}",
                "error_type": "validation",
            },
        )


async def _test_run_impl(sid: str, data: TestRunPayload, profile_id: uuid.UUID) -> None:
    """Handle test run with all business logic."""
    invocation_id_str = str(data.invocation_id)
    rooms = [sid, f"test_{invocation_id_str}"]

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

        if not result.views or not result.views.test_invocation:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "Failed to fetch test data",
                    "error_type": "context",
                },
            )
            return

        # Step 2: Pick target invocation
        invocation = next(
            (
                inv
                for inv in result.views.test_invocation
                if str(inv.invocation_id) == invocation_id_str
            ),
            None,
        )

        if not invocation:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "Test chat does not exist",
                    "error_type": "validation",
                },
            )
            return

        # Determine next pending run
        next_run_resource_id, current_run, total_runs = _determine_next_run(
            invocation_run_ids=invocation.invocation_run_ids,
            run_ids=invocation.run_ids,
        )

        if not next_run_resource_id:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "No pending runs to execute",
                    "error_type": "validation",
                },
            )
            return

        # Step 3: Validate prerequisites from websocket data
        if not result.resources:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "No configuration found for test",
                    "error_type": "validation",
                },
            )
            return

        config_agents = result.resources.config_agents or []
        config_models = result.resources.config_models or []
        config_providers = result.resources.config_providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "No agent configuration found",
                    "error_type": "validation",
                },
            )
            return

        if not model_resource:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": f"Agent '{agent_resource.name}' has no model configured",
                    "error_type": "validation",
                },
            )
            return

        if not provider_resource:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": f"Model '{model_resource.name}' has no provider configured",
                    "error_type": "validation",
                },
            )
            return

        # Extract base LLM config
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
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": f"No API key configured for provider '{provider_name}'",
                    "error_type": "validation",
                },
            )
            return

        group_id = invocation.group_id
        if not group_id:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "Test configuration (group) not found",
                    "error_type": "validation",
                },
            )
            return

        # Step 4: Parallel fetch resources
        async def fetch_override_model() -> QGetModelsV4Item | None:
            if not invocation.model_id:
                return None
            async with pool.acquire() as c:
                models = await get_models_internal(c, [invocation.model_id])
                return models[0] if models else None

        async def fetch_prompt() -> str:
            if not invocation.prompt_id:
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
            async with pool.acquire() as c:
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

        # Apply overrides
        if override_model:
            model_name = override_model.value or override_model.name or model_name
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

        # Step 5: Slim prepare SQL
        agents_resource_id = agent_resource.id if agent_resource else None
        models_resource_id = model_resource.id if model_resource else None
        providers_resource_id = provider_resource.id if provider_resource else None

        async with get_db_connection() as conn:
            prepare_row = cast(
                PrepareTestRunSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_PREPARE,
                    params=PrepareTestRunSqlParams(
                        p_profile_id=profile_id,
                        p_group_id=group_id,
                        p_agents_resource_id=agents_resource_id,
                        p_models_resource_id=models_resource_id,
                        p_providers_resource_id=providers_resource_id,
                    ),
                ),
            )

            if not prepare_row or not prepare_row.run_id:
                await internal_sio.emit(
                    "test_error",
                    {
                        "sid": sid,
                        "rooms": rooms,
                        "invocation_id": invocation_id_str,
                        "message": "Failed to prepare test run",
                        "error_type": "prepare",
                    },
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

        llm_config = {
            "model": model_name,
            "api_key": api_key,
            "base_url": base_url,
            "temperature": temperature,
            "reasoning": reasoning or "",
            "provider": provider_name,
        }

        # Step 7: Emit run_start via internal bus
        created_at_str = (
            prepare_row.created_at.isoformat() if prepare_row.created_at else ""
        )
        await internal_sio.emit(
            "test_run_start",
            {
                "sid": sid,
                "rooms": rooms,
                "invocation_id": invocation_id_str,
                "run_id": run_id,
                "original_run_resource_id": str(next_run_resource_id),
                "current_run": current_run,
                "total_runs": total_runs,
                "created_at": created_at_str,
            },
        )

        # Step 8: Emit to generate_artifact handler
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "test",
                "resource_type": "test",
                "modality": "text",
                "run_id": run_id,
                "group_id": str(group_id),
                "invocation_id": invocation_id_str,
                "chat_id": invocation_id_str,
                "test_id": str(data.test_id),
                "original_run_resource_id": str(next_run_resource_id),
                "current_run": current_run,
                "total_runs": total_runs,
                "messages": messages,
                "llm_config": llm_config,
                "tools": convert_tools_to_dict(tools),
            },
        )

        logger.info(
            f"Test run started - "
            f"profile_id={profile_id}, invocation_id={data.invocation_id}, "
            f"run_id={run_id}, current={current_run}/{total_runs}"
        )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in test_run: {e}")
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": rooms,
                "invocation_id": invocation_id_str,
                "message": f"Invalid UUID format: {e}",
                "error_type": "validation",
            },
        )
    except Exception as e:
        logger.exception(f"Failed to run test: {e}")
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": rooms,
                "invocation_id": invocation_id_str,
                "message": f"Failed to run test: {e}",
                "error_type": "internal",
            },
        )
