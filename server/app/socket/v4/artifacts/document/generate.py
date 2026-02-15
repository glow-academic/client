"""Document generation router - unified handler for all document resource types.

This module handles all business logic for document generation:
- Rate limit validation (fail fast)
- Group/run creation
- Agent/model context from pre-fetched resources (denormalized chain)
- Jinja template rendering for developer instructions
- Message insertion with deduplication
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.document.get import get_document_websocket
from app.api.v4.artifacts.document.types import GetDocumentWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.api.v4.views.config.get import get_config_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    init_generation,
    init_resource_progress,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.document.types import GenerateDocumentPayload
from app.socket.v4.artifacts.types import (
    DocumentGenerationStartedEvent,
    GenerateErrorApiRequest,
)
from app.sql.types import (
    GetAgentToolsSqlParams,
    GetAgentToolsSqlRow,
    GetDocumentGenerationContextSqlParams,
    GetDocumentGenerationContextSqlRow,
    PrepareDocumentGenerationSqlParams,
    PrepareDocumentGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/document/get_document_generation_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/document/prepare_document_generation_complete.sql"
)
SQL_PATH_AGENT_TOOLS = (
    "app/sql/v4/queries/generate/persona/get_agent_tools_complete.sql"
)
SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)

# Document resource types
DOCUMENT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "fields",
    "uploads",
    "images",
    "texts",
]


def _build_document_jinja_context(
    response: GetDocumentWebsocketResponse,
) -> dict[str, Any]:
    """Build Jinja context with resources as top-level variables.

    Resources are the current selections (from get_document_internal's ID resolution).
    Views (e.g. config) are injected separately after prepare.
    """
    if response.resources:
        return response.resources.model_dump()
    return {}


async def _emit_generation_error(
    sid: str,
    *,
    message: str,
    group_id: uuid.UUID | None = None,
) -> None:
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type="document",
            group_id=str(group_id) if group_id else None,
            resource_type="document",
        ),
        sid=sid,
    )


async def _generate_document_impl(
    sid: str, data: GenerateDocumentPayload, profile_id: uuid.UUID
) -> None:
    """Handle document generation with all business logic.

    This function:
    1. Validates resource_types and resolves agent_id from domain mappings
    2. Fetches document data via internal function (includes pre-fetched config resources)
    3. Extracts LLM config from pre-fetched agents/models/providers resources
    4. Validates prerequisites (rate limit from SQL, agent/model/provider from resources)
    5. Calls simplified prepare SQL (mutations only: group/run/config creation)
    6. Fetches prompts + instructions by ID from resources
    7. Renders developer instructions with Jinja
    8. Inserts pre-rendered messages
    9. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate resource_types
        if not data.resource_types:
            await _emit_generation_error(sid, message="resource_types must be provided")
            return

        resource_types = data.resource_types

        invalid_types = [
            rt for rt in resource_types if rt not in DOCUMENT_RESOURCE_TYPES
        ]
        if invalid_types:
            await _emit_generation_error(
                sid,
                message=f"Invalid resource types: {', '.join(invalid_types)}",
            )
            return

        # Step 1: Fetch document data (includes pre-fetched config resources)
        result = await get_document_websocket(
            profile_id=profile_id,
            document_id=data.document_id,
            draft_id=data.draft_id,
        )

        # Group resource_types by agent_id for multi-agent dispatch
        resource_agent_ids = result.resource_agent_ids or {}

        # Build agent_groups: {agent_id: [resource_types]}
        agent_groups: dict[uuid.UUID, list[str]] = {}
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_groups.setdefault(aid, []).append(rt)

        # Fallback: if no agent found for any resource type, pick first available
        if not agent_groups:
            for _rt, aid in resource_agent_ids.items():
                if aid is not None:
                    agent_groups[aid] = resource_types
                    break

        # Use first agent_id for validation (all share same config chain)
        agent_id: uuid.UUID | None = next(iter(agent_groups)) if agent_groups else None

        if not agent_id:
            await _emit_generation_error(
                sid,
                message="No agent found for the requested resource types",
                group_id=result.group_id,
            )
            return

        # Step 2: Extract LLM config from pre-fetched resources
        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        # Validate: agent resource must exist
        if not agent_resource:
            await _emit_generation_error(
                sid,
                message="No agent configuration found. Check department settings.",
                group_id=result.group_id,
            )
            return

        # Validate: model resource must exist
        if not model_resource:
            await _emit_generation_error(
                sid,
                message=f"Agent '{agent_resource.name}' has no model configured",
                group_id=result.group_id,
            )
            return

        # Validate: provider resource must exist
        if not provider_resource:
            await _emit_generation_error(
                sid,
                message=f"Model '{model_resource.name}' has no provider configured",
                group_id=result.group_id,
            )
            return

        # Extract LLM config fields from resources
        model_name = (
            model_resource.value
            if hasattr(model_resource, "value")
            else model_resource.name
        )
        base_url = (
            model_resource.endpoint if hasattr(model_resource, "endpoint") else ""
        )
        api_key = model_resource.key if hasattr(model_resource, "key") else ""
        temperature = (
            agent_resource.temperature
            if hasattr(agent_resource, "temperature")
            else 0.0
        )
        reasoning = (
            agent_resource.reasoning if hasattr(agent_resource, "reasoning") else None
        )
        voice = agent_resource.voice if hasattr(agent_resource, "voice") else None
        quality = agent_resource.quality if hasattr(agent_resource, "quality") else None
        provider_name = provider_resource.value or provider_resource.name or ""

        # Validate: API key must exist
        if not api_key:
            await _emit_generation_error(
                sid,
                message=f"No API key configured for provider '{provider_name}'",
                group_id=result.group_id,
            )
            return

        document_jinja_context = _build_document_jinja_context(result)

        # Step 3: Check rate limit (the only thing still in SQL)
        async with get_db_connection() as conn:
            context_params = GetDocumentGenerationContextSqlParams(
                p_profile_id=profile_id,
            )
            context_row = cast(
                GetDocumentGenerationContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            # Rate limit validation
            requests_per_day = context_row.requests_per_day
            runs_today = context_row.runs_today or 0

            if requests_per_day is not None and runs_today >= requests_per_day:
                error_msg = f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
                logger.error(
                    f"Document generation rate limit exceeded - "
                    f"profile_id={profile_id}, agent_id={agent_id}, "
                    f"reason: {error_msg}"
                )
                await _emit_generation_error(
                    sid,
                    message=f"Failed to prepare document generation: {error_msg}",
                    group_id=result.group_id,
                )
                return

        existing_group_id = result.group_id

        async with get_db_connection() as conn:
            # Step 4: Fetch tools, prompts, and instructions in parallel
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            async def fetch_tools():
                async with pool.acquire() as c:
                    tools_params = GetAgentToolsSqlParams(
                        p_agent_id=agent_id,
                        p_resource_types=resource_types,
                    )
                    tools_row = cast(
                        GetAgentToolsSqlRow,
                        await execute_sql_typed(
                            c, SQL_PATH_AGENT_TOOLS, params=tools_params
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

            # Step 5: Prepare generation (mutations only: group/run/config creation)
            prepare_params = PrepareDocumentGenerationSqlParams(
                p_profile_id=profile_id,
                p_group_id=existing_group_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )
            prepare_row = cast(
                PrepareDocumentGenerationSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row.run_id:
                logger.error(
                    f"Document generation preparation failed unexpectedly - "
                    f"profile_id={profile_id}, agent_id={agent_id}"
                )
                await _emit_generation_error(
                    sid,
                    message="Failed to prepare document generation: Unknown error",
                    group_id=existing_group_id,
                )
                return

            run_id = prepare_row.run_id
            group_id = prepare_row.group_id
            _trace_id = prepare_row.trace_id
            config_id = prepare_row.config_id

            jinja_context = document_jinja_context

            # Inject config view into Jinja context for template access
            if config_id:
                async with pool.acquire() as config_conn:
                    config_view_items = await get_config_internal(
                        conn=config_conn,
                        config_id=config_id,
                        bypass_cache=True,
                    )
                config_view = (
                    config_view_items[0].model_dump(mode="json")
                    if config_view_items
                    else {}
                )
            else:
                config_view = {}
            draft_document_view = (
                result.views.draft_document.model_dump(mode="json")
                if result.views and result.views.draft_document
                else {}
            )
            jinja_context["views"] = {
                "config": config_view,
                "draft_document": draft_document_view,
            }

            # Step 6: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 7: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            # Insert system prompt
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                await conn.fetchval(
                    create_message_sql,
                    run_id,
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
                    run_id,
                    "developer",
                    m,
                    True,
                    False,
                )

            # Insert user instructions
            if data.user_instructions:
                for instruction in data.user_instructions:
                    messages.append({"role": "user", "content": instruction})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "user",
                        instruction,
                        True,
                        False,
                    )

            # Step 8: Initialize generation tracker for multi-agent support
            num_agents = len(agent_groups)
            await init_generation(str(run_id), num_agents)
            await init_resource_progress(str(run_id), len(resource_types))

            # Emit document_generation_started to client
            await sio.emit(
                "document_generation_started",
                {
                    "artifact_type": "document",
                    "group_id": str(group_id) if group_id else "",
                    "run_id": str(run_id),
                    "resource_types": resource_types,
                },
                room=sid,
            )

            # Step 9: Dispatch to generate_artifact handler(s)
            for _agent_group_id, agent_resource_types in agent_groups.items():
                await internal_sio.emit(
                    "generate_artifact",
                    {
                        "sid": sid,
                        "artifact_type": "document",
                        "resource_type": agent_resource_types[0]
                        if agent_resource_types
                        else "document",
                        "run_id": str(run_id),
                        "group_id": str(group_id) if group_id else None,
                        "message_id": None,
                        "messages": messages,
                        "llm_config": {
                            "model": model_name,
                            "api_key": api_key,
                            "base_url": base_url,
                            "temperature": temperature,
                            "reasoning": reasoning,
                            "provider": provider_name,
                            "voice": voice,
                            "quality": quality,
                            "length_seconds": None,
                            "tool_choice": "required",
                        },
                        "tools": convert_tools_to_dict(tools),
                        "save": data.save,
                    },
                )

    except Exception as error:
        logger.exception(f"Failed to generate document resources: {str(error)}")
        await _emit_generation_error(
            sid,
            message=f"Failed to generate document resources: {str(error)}",
        )


@sio.event  # type: ignore
async def document_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle document_generate event (client-to-server)."""
    try:
        payload = GenerateDocumentPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_generation_error(
                sid, message="Profile not found. Please reconnect."
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _generate_document_impl(sid, payload, profile_id)
    except Exception as error:
        await _emit_generation_error(sid, message=f"Invalid request: {str(error)}")


@internal_sio.on("document_generate")  # type: ignore
async def document_generate_internal(data: dict[str, Any]) -> None:
    """Handle document_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await _emit_generation_error(
                sid, message="Profile not found. Please reconnect."
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateDocumentPayload(**data)
        await _generate_document_impl(sid, payload, profile_id)
    except Exception as error:
        await _emit_generation_error(sid, message=f"Invalid request: {str(error)}")


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/document_generation_started")
async def document_generation_started_api(
    request: DocumentGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Document generation started.

    Emitted when document generation begins, listing resource types being generated.
    """
    return {"success": True}
