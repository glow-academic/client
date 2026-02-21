"""Test grade handler.

Handles the test_grade WebSocket event to trigger grading after a run completes.
Grading is fire-and-forget — runs asynchronously so subsequent runs proceed.

Follows the attempt/grade.py pattern:
1. get_test_websocket() resolves config chain (agent/model/provider)
2. Python validates prerequisites and extracts LLM config
3. Parallel fetch for tools/prompts/instructions
4. Slim SQL handles mutations only (run/config/grade creation)
5. Jinja rendering in Python
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.test.get import get_test_websocket
from app.api.v4.artifacts.test.types import GetTestWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.test.types import (
    TEST_GRADE_ENTRY_TYPES,
    TestGradedEvent,
    TestGradePayload,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
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

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
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
    """Build Jinja context with resources as top-level variables.

    Resources are the current selections (from get_test_websocket's config chain).
    Templates access resources directly: {{ rubrics }}, {{ agents[0].temperature }}
    Views (e.g. test_invocation) are injected separately after prepare.
    """
    if result.resources:
        return result.resources.model_dump(mode="json")
    return {}


async def _test_grade_impl(
    sid: str, data: TestGradePayload, profile_id: uuid.UUID
) -> None:
    """Handle test grade with all business logic.

    This function:
    1. Fetches test data via get_test_websocket() (cached, includes config chain)
    2. Extracts LLM config from pre-fetched resources (agent/model/provider)
    3. Validates prerequisites (agent, model, provider, API key)
    4. Finds invocation by invocation_id, resolves group_id
    5. Parallel fetches tools, prompts, and instructions
    6. Calls slim prepare SQL (mutations only: run/config/grade creation)
    7. Builds jinja context in Python from views + resources
    8. Renders developer instructions and persists messages
    9. Emits to generate_artifact handler with grading tools
    """
    try:
        # Step 1: Fetch test data (includes pre-fetched config resources)
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async with pool.acquire() as conn:
            result = await get_test_websocket(
                conn=conn,
                test_id=data.test_id,
                bypass_cache=True,
                profile_id=profile_id,
            )

        if not result.resources:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Failed to fetch test data",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Get agent_id from resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = resource_agent_ids.get("primary")

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for this test",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Step 2: Extract LLM config from pre-fetched resources
        config_agents = result.resources.config_agents or []
        config_models = result.resources.config_models or []
        config_providers = result.resources.config_providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        # Validate: agent resource must exist
        if not agent_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configuration found. Check test settings.",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Validate: model resource must exist
        if not model_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Agent '{agent_resource.name}' has no model configured",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Validate: provider resource must exist
        if not provider_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Model '{model_resource.name}' has no provider configured",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Extract LLM config fields from resources
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

        # Validate: API key must exist
        if not api_key:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"No API key configured for provider '{provider_name}'",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Step 3: Find invocation by invocation_id
        if not result.views or not result.views.test_invocation:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No invocations found for this test",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        invocation_id_str = str(data.invocation_id)
        invocation = next(
            (
                inv
                for inv in result.views.test_invocation
                if str(inv.invocation_id) == invocation_id_str
            ),
            None,
        )

        if not invocation:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Invocation not found for this test",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        group_id = invocation.group_id
        if not group_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No group found for this invocation",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        # Step 4: Parallel fetch tools, prompts, and instructions
        async def fetch_tools():
            async with pool.acquire() as c:
                tools_params = GetAgentEntryToolsSqlParams(
                    p_agent_id=agent_id,
                    p_entry_types=TEST_GRADE_ENTRY_TYPES,
                )
                tools_row = cast(
                    GetAgentEntryToolsSqlRow,
                    await execute_sql_typed(
                        c, SQL_PATH_AGENT_ENTRY_TOOLS, params=tools_params
                    ),
                )
                return tools_row.tools if tools_row else []

        async def fetch_system_prompt():
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

        async def fetch_developer_instructions():
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

        # Step 5: Prepare grade (mutations only: run/config/grade)
        async with get_db_connection() as conn:
            prepare_params = PrepareTestGradeSqlParams(
                p_profile_id=profile_id,
                p_group_id=group_id,
                p_invocation_id=data.invocation_id,
                p_run_id=data.run_id,
                p_rubric_id=invocation.rubric_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )
            prepare_row = cast(
                PrepareTestGradeSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row or not prepare_row.grade_run_id:
                logger.error(
                    f"Test grade preparation failed - "
                    f"profile_id={profile_id}, "
                    f"test_id={data.test_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to prepare grading",
                        artifact_type="test",
                        group_id=str(group_id),
                        resource_type="grade",
                    ),
                    sid=sid,
                )
                return

            grade_run_id = prepare_row.grade_run_id
            grade_id = prepare_row.grade_id

            # Step 6: Build jinja context from resources + views
            jinja_context = _build_test_jinja_context(result)

            # Inject views into jinja context for template access
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

            # Inject grade data (created by prepare SQL, not in websocket response)
            jinja_context["grade"] = {
                "id": str(grade_id) if grade_id else None,
            }

            # Step 7: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 8: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            # Insert system prompt
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

            # Insert developer instructions
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

            # Step 9: Emit to generate_artifact handler with grading tools
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
        logger.exception(f"Invalid UUID format in test_grade: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid UUID format: {str(e)}",
                artifact_type="test",
                group_id=None,
                resource_type="grade",
            ),
            sid=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to grade test: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to grade test: {str(e)}",
                artifact_type="test",
                group_id=None,
                resource_type="grade",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def test_grade(sid: str, data: dict[str, Any]) -> None:
    """Handle test_grade event (client-to-server).

    Grades a test run.
    Emits test_graded on completion, test_error on failure.
    """
    try:
        payload = TestGradePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _test_grade_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in test_grade: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="test",
                group_id=None,
                resource_type="grade",
            ),
            sid=sid,
        )


@internal_sio.on("test_grade")  # type: ignore
async def test_grade_internal(data: dict[str, Any]) -> None:
    """Handle test_grade event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = TestGradePayload(**data)
        await _test_grade_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in test_grade_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid request: {str(e)}",
                    artifact_type="test",
                    group_id=None,
                    resource_type="grade",
                ),
                sid=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/test/grade", response_model=dict[str, bool])
async def test_grade_api(request: TestGradePayload) -> dict[str, bool]:
    """Client-to-server event: Grade test run."""
    return {"success": True}


@server_router.post("/test/graded", response_model=dict[str, bool])
async def test_graded_api(request: TestGradedEvent) -> dict[str, bool]:
    """Server-to-client event: Test grading completed."""
    return {"success": True}
