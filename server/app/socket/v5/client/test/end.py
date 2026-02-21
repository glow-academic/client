"""Test end handler.

Handles: test_end — triggers grading flow after runs complete.
"""

import asyncio
import json
import uuid
from typing import Any, cast

from app.api.v4.artifacts.test.get import get_test_websocket
from app.api.v4.artifacts.test.types import GetTestWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, get_pool, sio
from app.registry.relations import TOOL_ENTRY_TYPES
from app.socket.v5.client.types import TestEndPayload
from app.socket.v5.types import TEST_GRADE_ENTRY_TYPES
from app.sql.types import (
    GetAgentEntryToolsSqlParams,
    GetAgentEntryToolsSqlRow,
    PrepareTestGradeSqlParams,
    PrepareTestGradeSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PREPARE = "app/sql/v4/queries/generate/test/prepare_test_grade_complete.sql"
SQL_PATH_AGENT_ENTRY_TOOLS = (
    "app/sql/v4/queries/generate/attempt/get_agent_entry_tools_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


def _build_test_jinja_context(
    result: GetTestWebsocketResponse,
) -> dict[str, Any]:
    """Build Jinja context with resources as top-level variables."""
    if result.resources:
        return result.resources.model_dump(mode="json")
    return {}


@sio.event  # type: ignore
async def test_end(sid: str, data: dict[str, Any]) -> None:
    """Handle test_end event from client — triggers grading."""
    try:
        payload = TestEndPayload(**data)
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
        await _test_end_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in test_end: {e}")
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


async def _test_end_impl(sid: str, data: TestEndPayload, profile_id: uuid.UUID) -> None:
    """Handle test grade with all business logic."""
    invocation_id_str = str(data.invocation_id)
    rooms = [sid, f"test_{invocation_id_str}"]

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # Step 1: Fetch test data
        async with pool.acquire() as conn:
            result = await get_test_websocket(
                conn=conn,
                test_id=data.test_id,
                bypass_cache=True,
                profile_id=profile_id,
            )

        if not result.resources:
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

        # Get agent_id from resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = resource_agent_ids.get("primary")

        if not agent_id:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "No agent found for this test",
                    "error_type": "validation",
                },
            )
            return

        # Step 2: Extract LLM config
        result_config = result.config
        config_agents = result_config.agents or [] if result_config else []
        config_models = result_config.models or [] if result_config else []
        config_providers = result_config.providers or [] if result_config else []

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
                    "message": "No agent configuration found. Check test settings.",
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

        model_name = (
            model_resource.value
            if hasattr(model_resource, "value")
            else model_resource.name
        )
        base_url = (
            provider_resource.endpoint if hasattr(provider_resource, "endpoint") else ""
        )
        api_key = provider_resource.key if hasattr(provider_resource, "key") else ""
        temperature = (
            agent_resource.temperature
            if hasattr(agent_resource, "temperature")
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

        # Step 3: Find invocation
        if not result.views or not result.views.test_invocation:
            await internal_sio.emit(
                "test_error",
                {
                    "sid": sid,
                    "rooms": rooms,
                    "invocation_id": invocation_id_str,
                    "message": "No invocations found for this test",
                    "error_type": "context",
                },
            )
            return

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
                    "message": "Invocation not found for this test",
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
                    "message": "No group found for this invocation",
                    "error_type": "validation",
                },
            )
            return

        # Step 4: Parallel fetch tools, prompts, instructions
        async def fetch_tools() -> list[Any]:
            async with pool.acquire() as c:
                tools_row = cast(
                    GetAgentEntryToolsSqlRow,
                    await execute_sql_typed(
                        c,
                        SQL_PATH_AGENT_ENTRY_TOOLS,
                        params=GetAgentEntryToolsSqlParams(
                            p_agent_id=agent_id,
                            p_entry_types=TEST_GRADE_ENTRY_TYPES,
                            p_tool_entry_map=json.dumps(TOOL_ENTRY_TYPES),
                        ),
                    ),
                )
                return tools_row.tools if tools_row else []

        async def fetch_system_prompt() -> str:
            prompt_id = (
                agent_resource.prompt_id
                if hasattr(agent_resource, "prompt_id")
                else None
            )
            if not prompt_id:
                return ""
            async with pool.acquire() as c:
                prompts = await get_prompts_internal(c, [prompt_id])
                if prompts and prompts[0].system_prompt:
                    return prompts[0].system_prompt
                return ""

        async def fetch_developer_instructions() -> list[str]:
            instruction_ids = (
                agent_resource.instruction_ids
                if hasattr(agent_resource, "instruction_ids")
                else []
            )
            if not instruction_ids:
                return []
            async with pool.acquire() as c:
                instructions = await get_instructions_internal(c, instruction_ids)
                return [inst.template for inst in instructions if inst.template]

        (
            tools,
            system_prompt,
            developer_instruction_templates,
        ) = await asyncio.gather(
            fetch_tools(),
            fetch_system_prompt(),
            fetch_developer_instructions(),
        )

        # Step 5: Prepare grade
        async with get_db_connection() as conn:
            prepare_row = cast(
                PrepareTestGradeSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_PREPARE,
                    params=PrepareTestGradeSqlParams(
                        p_profile_id=profile_id,
                        p_group_id=group_id,
                        p_invocation_id=data.invocation_id,
                        p_run_id=data.run_id,
                        p_rubric_id=invocation.rubric_id,
                        p_agents_resource_id=agent_resource.id,
                        p_models_resource_id=model_resource.id,
                        p_providers_resource_id=provider_resource.id,
                    ),
                ),
            )

            if not prepare_row or not prepare_row.grade_run_id:
                await internal_sio.emit(
                    "test_error",
                    {
                        "sid": sid,
                        "rooms": rooms,
                        "invocation_id": invocation_id_str,
                        "message": "Failed to prepare grading",
                        "error_type": "prepare",
                    },
                )
                return

            grade_run_id = prepare_row.grade_run_id
            grade_id = prepare_row.grade_id

            # Step 6: Build jinja context
            jinja_context = _build_test_jinja_context(result)

            views_data: dict[str, Any] = {}
            if result.views:
                if result.views.test_invocation:
                    views_data["test_invocation"] = [
                        inv.model_dump(mode="json")
                        for inv in result.views.test_invocation
                    ]
                if result.views.test:
                    views_data["test"] = [
                        t.model_dump(mode="json") for t in result.views.test
                    ]
            jinja_context["views"] = views_data
            jinja_context["grade"] = {
                "id": str(grade_id) if grade_id else None,
            }

            # Step 7: Render developer instructions
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 8: Build messages + persist
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                await conn.fetchval(
                    create_message_sql,
                    grade_run_id,
                    "system",
                    system_prompt,
                    True,
                    False,
                )

            for m in rendered_developer_messages:
                messages.append({"role": "developer", "content": m})
                await conn.fetchval(
                    create_message_sql,
                    grade_run_id,
                    "developer",
                    m,
                    True,
                    False,
                )

            # Step 9: Emit to generate_artifact
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "test",
                    "resource_type": "grade",
                    "modality": "call",
                    "run_id": str(grade_run_id),
                    "group_id": str(group_id),
                    "invocation_id": invocation_id_str,
                    "chat_id": invocation_id_str,
                    "test_id": str(data.test_id),
                    "grade_id": str(grade_id) if grade_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider_name,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                        "tool_choice": "required",
                    },
                    "tools": convert_tools_to_dict(tools),
                },
            )

            logger.info(
                f"Test grade initiated - "
                f"profile_id={profile_id}, test_id={data.test_id}, "
                f"run_id={grade_run_id}, grade_id={grade_id}"
            )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in test_end: {e}")
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
        logger.exception(f"Failed to grade test: {e}")
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": rooms,
                "invocation_id": invocation_id_str,
                "message": f"Failed to grade test: {e}",
                "error_type": "internal",
            },
        )
