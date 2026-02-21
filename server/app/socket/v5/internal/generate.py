"""Internal generate handler — owns the unified 16-step generation pipeline.

Handles: @internal_sio.on("generate") — dispatched from client/generate.py or
other internal handlers that compose with generation.

The pipeline: validate → fetch resources → build LLM config → prepare SQL →
render instructions → build messages → emit generate_artifact to token factory.
"""

import asyncio
import uuid
from typing import Any, cast

from app.api.v4.entries.config.get import get_config_entry_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    init_generation,
    init_resource_progress,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.socket.v5.client.registry import REGISTRY, ArtifactGenerateConfig
from app.socket.v5.client.types import GeneratePayload
from app.sql.types import (
    PrepareAgentGenerationSqlParams,
    PrepareAgentGenerationSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
    *,
    group_id: str | None = None,
) -> None:
    """Emit a generation error via the internal bus."""
    await emit_to_internal(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            group_id=group_id,
            resource_type=artifact_type,
        ),
        sid=sid,
    )


def _build_jinja_context(result: object) -> dict[str, Any]:
    """Build Jinja context from pre-fetched resources (common across all artifacts)."""
    resources = getattr(result, "resources", None)
    if resources:
        return resources.model_dump(mode="json")  # type: ignore[no-any-return, union-attr]
    return {}


def _enrich_tools_with_args_outputs(
    tool_dicts: list[dict[str, Any]],
    result: object,
    config: ArtifactGenerateConfig,
) -> list[dict[str, Any]]:
    """Attach _args_outputs to tools for output schema resolution."""
    resources = getattr(result, "resources", None)
    if not tool_dicts or not resources:
        return tool_dicts

    resource_tools = getattr(resources, config.config_tools_attr, None) or []
    config_args_outputs = (
        getattr(resources, config.config_args_outputs_attr, None) or []
    )

    if not resource_tools or not config_args_outputs:
        return tool_dicts

    tool_output_ids_by_name: dict[str, list[Any]] = {}
    for rt in resource_tools:
        name = getattr(rt, "name", None)
        ao_ids = getattr(rt, "args_output_ids", None)
        if name and ao_ids:
            tool_output_ids_by_name[name] = ao_ids

    if not tool_output_ids_by_name:
        return tool_dicts

    ao_by_id = {}
    for ao in config_args_outputs:
        ao_id = getattr(ao, "id", None)
        if ao_id:
            ao_by_id[ao_id] = ao

    for td in tool_dicts:
        t_name = td.get("name")
        if t_name and t_name in tool_output_ids_by_name:
            ao_list = []
            for ao_id in tool_output_ids_by_name[t_name]:
                ao = ao_by_id.get(ao_id)
                if ao:
                    ao_list.append(
                        {
                            "name": getattr(ao, "name", ""),
                            "template": getattr(ao, "template", ""),
                        }
                    )
            if ao_list:
                td["_args_outputs"] = ao_list

    return tool_dicts


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------


@internal_sio.on("generate")  # type: ignore
async def generate_handler(data: dict[str, Any]) -> None:
    """Handle ``generate`` from internal bus — owns the 16-step pipeline."""
    sid = data.get("sid", "")
    artifact_type = data.get("artifact_type", "unknown")

    if not sid:
        return

    # Resolve profile_id (passed from client, or fallback to socket lookup)
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePayload(**data)
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
        return

    # --- 16-step generation pipeline ---

    # Step 1: Look up config in registry
    config: ArtifactGenerateConfig | None = REGISTRY.get(artifact_type)
    if not config:
        await _emit_error(sid, f"Unknown artifact_type: {artifact_type}", artifact_type)
        return

    try:
        # Step 2: Validate resource_types
        if not payload.resource_types:
            await _emit_error(sid, "resource_types must be provided", artifact_type)
            return

        resource_types = [rt for rt in payload.resource_types if rt]
        if not resource_types:
            await _emit_error(sid, "No valid resource_types provided", artifact_type)
            return

        invalid_types = [
            rt for rt in resource_types if rt not in config.valid_resource_types
        ]
        if invalid_types:
            await _emit_error(
                sid,
                f"Invalid resource types: {', '.join(invalid_types)}",
                artifact_type,
            )
            return

        # Step 3: Validate draft_id if required
        if config.requires_draft and not payload.draft_id:
            await _emit_error(
                sid,
                f"draft_id is required for {artifact_type} generation",
                artifact_type,
            )
            return

        # Step 4: Resolve artifact_id (handle profile's staff_id special case)
        artifact_id = payload.artifact_id
        if artifact_type == "profile" and not artifact_id and payload.staff_id:
            artifact_id = uuid.UUID(payload.staff_id)

        # Step 5: Fetch pre-hydrated artifact data via registry fetcher
        pool = get_pool() if config.requires_pool else None
        if config.requires_pool and not pool:
            raise RuntimeError("Database pool not initialized")

        if not config.fetcher:
            await _emit_error(
                sid, f"No fetcher configured for {artifact_type}", artifact_type
            )
            return

        if not pool:
            pool = get_pool()

        result: Any = await config.fetcher(
            profile_id, artifact_id, payload.draft_id, pool
        )

        # Step 6: Build agent_groups from resource_agent_ids
        resource_agent_ids: dict[str, uuid.UUID] = result.resource_agent_ids or {}

        agent_groups: dict[uuid.UUID, list[str]] = {}
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_groups.setdefault(aid, []).append(rt)

        if not agent_groups:
            for _rt, aid in resource_agent_ids.items():
                if aid is not None:
                    agent_groups[aid] = resource_types
                    break

        agent_id: uuid.UUID | None = next(iter(agent_groups)) if agent_groups else None

        if not agent_id:
            await _emit_error(
                sid,
                "No agent found for the requested resource types",
                artifact_type,
                group_id=str(result.group_id)
                if hasattr(result, "group_id") and result.group_id
                else None,
            )
            return

        # Step 7: Extract LLM config from pre-fetched resources
        config_agents = getattr(result.resources, config.config_agents_attr, None) or []
        config_models = getattr(result.resources, config.config_models_attr, None) or []
        config_providers = (
            getattr(result.resources, config.config_providers_attr, None) or []
        )

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource:
            await _emit_error(
                sid,
                "No agent configuration found. Check department settings.",
                artifact_type,
            )
            return

        if not model_resource:
            await _emit_error(
                sid,
                f"Agent '{agent_resource.name}' has no model configured",
                artifact_type,
            )
            return

        if not provider_resource:
            await _emit_error(
                sid,
                f"Model '{model_resource.name}' has no provider configured",
                artifact_type,
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
        voice = agent_resource.voice if hasattr(agent_resource, "voice") else None
        quality = agent_resource.quality if hasattr(agent_resource, "quality") else None
        provider_name = provider_resource.value or provider_resource.name or ""

        if not api_key:
            await _emit_error(
                sid,
                f"No API key configured for provider '{provider_name}'",
                artifact_type,
            )
            return

        # Step 8: Rate limit check (fail fast)
        config_profile = (
            result.resources.config_profile[0]
            if result.resources.config_profile
            else None
        )
        requests_per_day = config_profile.requests_per_day if config_profile else None
        runs_today = (
            result.views.runs.total_count if result.views and result.views.runs else 0
        )

        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"{artifact_type.capitalize()} generation rate limit exceeded - "
                f"profile_id={profile_id}, agent_id={agent_id}, "
                f"reason: {error_msg}"
            )
            await _emit_error(
                sid,
                f"Failed to prepare {artifact_type} generation: {error_msg}",
                artifact_type,
                group_id=str(result.group_id)
                if hasattr(result, "group_id") and result.group_id
                else None,
            )
            return

        jinja_context = _build_jinja_context(result)
        existing_group_id = result.group_id if hasattr(result, "group_id") else None

        # Steps 9-16: DB operations
        async with get_db_connection() as conn:
            if not pool:
                pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            # Step 9: Read tools from pre-fetched config resources
            config_tools = (
                getattr(result.resources, config.config_tools_attr, None) or []
            )

            async def fetch_system_prompt() -> str:
                prompt_id = (
                    agent_resource.prompt_id
                    if hasattr(agent_resource, "prompt_id")
                    else None
                )
                if not prompt_id:
                    return ""
                async with pool.acquire() as c:  # type: ignore[union-attr]
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
                async with pool.acquire() as c:  # type: ignore[union-attr]
                    instructions = await get_instructions_internal(c, instruction_ids)
                    return [inst.template for inst in instructions if inst.template]

            (
                system_prompt,
                developer_instruction_templates,
            ) = await asyncio.gather(
                fetch_system_prompt(),
                fetch_developer_instructions(),
            )

            # Step 10: Prepare generation (create group/run/config)
            if payload.run_id:
                run_id = uuid.UUID(payload.run_id)
                group_id = (
                    uuid.UUID(payload.group_id)
                    if payload.group_id
                    else existing_group_id
                )
                config_id = None
            else:
                prepare_params = PrepareAgentGenerationSqlParams(
                    p_profile_id=profile_id,
                    p_group_id=existing_group_id,
                    p_agents_resource_id=agent_resource.id,
                    p_models_resource_id=model_resource.id,
                    p_providers_resource_id=provider_resource.id,
                )
                prepare_row = cast(
                    PrepareAgentGenerationSqlRow,
                    await execute_sql_typed(
                        conn, config.prepare_sql_path, params=prepare_params
                    ),
                )

                if not prepare_row.run_id:
                    logger.error(
                        f"{artifact_type.capitalize()} generation preparation failed - "
                        f"profile_id={profile_id}, agent_id={agent_id}"
                    )
                    await _emit_error(
                        sid,
                        f"Failed to prepare {artifact_type} generation: Unknown error",
                        artifact_type,
                        group_id=str(existing_group_id) if existing_group_id else None,
                    )
                    return

                run_id = prepare_row.run_id
                group_id = prepare_row.group_id
                config_id = prepare_row.config_id

            # Step 11: Inject config view + draft view into Jinja context
            if config_id:
                async with pool.acquire() as config_conn:
                    config_view_items = await get_config_entry_internal(
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

            draft_view: dict[str, Any] = {}
            if result.views:
                draft_attr = getattr(result.views, config.draft_view_key, None)
                if draft_attr:
                    draft_view = draft_attr.model_dump(mode="json")

            jinja_context["views"] = {
                "config": config_view,
                config.draft_view_key: draft_view,
            }

            # Step 12: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 13: Build messages for LLM AND persist to database
            messages: list[dict[str, str]] = []
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

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

            if payload.extra_messages:
                for em in payload.extra_messages:
                    messages.append(em)

            if payload.user_instructions:
                for instruction in payload.user_instructions:
                    messages.append({"role": "user", "content": instruction})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "user",
                        instruction,
                        True,
                        False,
                    )

            # Step 14: Initialize generation tracker
            num_agents = len(agent_groups)
            await init_generation(str(run_id), num_agents)
            await init_resource_progress(str(run_id), len(resource_types))

            # Step 15: Emit generation_started to server layer
            await internal_sio.emit(
                "generation_started",
                {
                    "sid": sid,
                    "artifact_type": artifact_type,
                    "group_id": str(group_id) if group_id else "",
                    "run_id": str(run_id),
                    "resource_types": resource_types,
                },
            )

            # Step 16: Convert tools and enrich with _args_outputs
            tool_dicts = convert_tools_to_dict(config_tools)
            tool_dicts = _enrich_tools_with_args_outputs(tool_dicts, result, config)

            # Step 17: Dispatch to generate_artifact handler(s)
            for _agent_group_id, agent_resource_types in agent_groups.items():
                emit_payload: dict[str, Any] = {
                    "sid": sid,
                    "artifact_type": artifact_type,
                    "resource_type": agent_resource_types[0]
                    if agent_resource_types
                    else artifact_type,
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
                    "tools": tool_dicts,
                    "save": payload.save,
                }

                # Build metadata from extra_emit_fields + attempt-specific IDs
                metadata: dict[str, Any] = {}
                for field_name in config.extra_emit_fields:
                    value = getattr(payload, field_name, None)
                    if value is not None:
                        metadata[field_name] = (
                            str(value) if isinstance(value, uuid.UUID) else value
                        )
                if payload.grade_id:
                    metadata["grade_id"] = payload.grade_id
                if payload.chat_id:
                    metadata["chat_id"] = payload.chat_id
                if payload.save is not None:
                    metadata["save"] = payload.save

                emit_payload["metadata"] = metadata or None

                await internal_sio.emit("generate_artifact", emit_payload)

    except Exception as e:
        logger.exception(f"Failed to generate {artifact_type} resources: {str(e)}")
        await _emit_error(
            sid,
            f"Failed to generate {artifact_type} resources: {str(e)}",
            artifact_type,
        )
