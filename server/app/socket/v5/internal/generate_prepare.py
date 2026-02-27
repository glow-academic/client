"""Generation preparation — owns the unified generation pipeline.

Handles: @internal_sio.on("generate_prepare") — dispatched from generate.py
(rate limit gate) after the rate limit check passes.

The pipeline: validate → fetch resources → build LLM config → prepare SQL →
render instructions → build messages → emit generate_artifact to token factory.

Run-level steps (shared across agents):
  - Validate, fetch data, prepare run/group, init tracker
Per-agent steps (scoped per agent_group):
  - Resolve agent config chain, scope resource/entry types, render instructions,
    build messages, filter tools, dispatch generate_artifact
"""

import asyncio
import copy
import uuid
from typing import Any

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
from app.socket.v5.client.registry import REGISTRY, ArtifactGenerateConfig
from app.socket.v5.client.types import GeneratePayload
from app.socket.v5.internal.generate_artifact import GenerateArtifactPayload
from app.socket.v5.internal.generation_types import GenerationStartedData
from app.socket.v5.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

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
    """Build Jinja context with three top-level keys: resources, entries, artifacts."""
    context: dict[str, Any] = {
        "resources": {},
        "entries": {},
        "artifacts": {},
    }
    resources = getattr(result, "resources", None)
    if resources:
        context["resources"] = resources.model_dump(mode="json")  # type: ignore[union-attr]
    entries = getattr(result, "entries", None)
    if entries:
        context["entries"] = entries.model_dump(mode="json")  # type: ignore[union-attr]
    # Build artifacts dict from flat config-chain fields on result
    artifacts_dict: dict[str, Any] = {}
    for key in (
        "agents",
        "models",
        "providers",
        "tools",
        "args",
        "args_outputs",
        "profile",
        "params",
    ):
        val = getattr(result, key, None)
        if val is not None:
            if hasattr(val, "model_dump"):
                artifacts_dict[key] = val.model_dump(mode="json")  # type: ignore[union-attr]
            elif isinstance(val, list):
                artifacts_dict[key] = [
                    item.model_dump(mode="json")
                    if hasattr(item, "model_dump")
                    else item
                    for item in val
                ]
            else:
                artifacts_dict[key] = val
    if artifacts_dict:
        context["artifacts"] = artifacts_dict
    return context


def _enrich_tools_with_args(
    tool_dicts: list[dict[str, Any]],
    result: object,
) -> list[dict[str, Any]]:
    """Build arguments/argument_descriptions/argument_defaults on tool dicts.

    QGetToolsV4Item only carries args_ids (UUID refs). This function resolves
    them against the pre-fetched QGetArgsV4Item list in config.args to produce
    the JSONB structures that convert_tools_to_openai_format expects.
    """
    if not tool_dicts:
        return tool_dicts

    resource_tools = getattr(result, "tools", None) or []
    config_args = getattr(result, "args", None) or []

    if not resource_tools or not config_args:
        return tool_dicts

    # Index args by id
    arg_by_id: dict[Any, Any] = {}
    for arg in config_args:
        arg_id = getattr(arg, "id", None)
        if arg_id:
            arg_by_id[arg_id] = arg

    if not arg_by_id:
        return tool_dicts

    # Map tool name → args_ids from the resource tools
    tool_arg_ids_by_name: dict[str, list[Any]] = {}
    for rt in resource_tools:
        name = getattr(rt, "name", None)
        a_ids = getattr(rt, "args_ids", None)
        if name and a_ids:
            tool_arg_ids_by_name[name] = a_ids

    if not tool_arg_ids_by_name:
        return tool_dicts

    for td in tool_dicts:
        t_name = td.get("name")
        if not t_name or t_name not in tool_arg_ids_by_name:
            continue

        arguments: dict[str, Any] = {}
        argument_descriptions: dict[str, str] = {}
        argument_defaults: dict[str, Any] = {}

        for arg_id in tool_arg_ids_by_name[t_name]:
            arg = arg_by_id.get(arg_id)
            if not arg:
                continue
            arg_name = getattr(arg, "name", None)
            if not arg_name:
                continue

            field_type = getattr(arg, "field_type", "string") or "string"
            required = bool(getattr(arg, "required", False))

            arguments[arg_name] = {"type": field_type, "required": required}
            desc = getattr(arg, "description", None)
            if desc:
                argument_descriptions[arg_name] = desc
            default_value = getattr(arg, "default_value", None)
            if default_value is not None and default_value != "":
                argument_defaults[arg_name] = default_value

        td["arguments"] = arguments
        td["argument_descriptions"] = argument_descriptions
        td["argument_defaults"] = argument_defaults

    return tool_dicts


def _enrich_tools_with_args_outputs(
    tool_dicts: list[dict[str, Any]],
    result: object,
) -> list[dict[str, Any]]:
    """Attach _args_outputs to tools for output schema resolution."""
    if not tool_dicts:
        return tool_dicts

    resource_tools = getattr(result, "tools", None) or []
    config_args_outputs = getattr(result, "args_outputs", None) or []

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


@internal_sio.on("generate_prepare")  # type: ignore
async def generate_prepare_handler(data: dict[str, Any]) -> None:
    """Handle ``generate_prepare`` — runs after rate limit gate passes."""
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

    # --- Generation pipeline ---

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

        all_valid_types = set(config.valid_resource_types) | set(config.entry_types)
        invalid_types = [rt for rt in resource_types if rt not in all_valid_types]
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

        # Step 4: Resolve artifact_id
        artifact_id = payload.artifact_id
        payload_metadata = payload.metadata or {}
        if (
            artifact_type == "profile"
            and not artifact_id
            and payload_metadata.get("staff_id")
        ):
            artifact_id = uuid.UUID(payload_metadata["staff_id"])

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

        # Step 6a: Extract config-chain lookup tables (needed for agent fallback)
        config_agents = getattr(result, "agents", None) or []
        config_models = getattr(result, "models", None) or []
        config_providers = getattr(result, "providers", None) or []

        # Build lookup dicts for multi-agent resolution
        agents_by_id = {a.id: a for a in config_agents if a.id}
        models_by_id = {m.id: m for m in config_models if m.id}
        providers_by_id = {p.id: p for p in config_providers if getattr(p, "id", None)}

        if not config_agents:
            await _emit_error(
                sid,
                "No agent configuration found. Check department settings.",
                artifact_type,
            )
            return

        # Step 6b: Build agent_groups from resource_agent_ids
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

        # Fallback: use first config_agent when no prior run config exists
        if not agent_groups:
            first_agent = config_agents[0]
            if first_agent.id:
                agent_groups[first_agent.id] = resource_types

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

        # Rate limit check moved to generate.py (rate limit gate)

        jinja_context_base = _build_jinja_context(result)

        # Step 9: Read all tools, enrich, and build createable set (shared)
        config_tools = getattr(result, "tools", None) or []
        all_tool_dicts = convert_tools_to_dict(config_tools)
        all_tool_dicts = _enrich_tools_with_args(all_tool_dicts, result)
        all_tool_dicts = _enrich_tools_with_args_outputs(all_tool_dicts, result)

        createable_resources: set[str] = set()
        for tool in config_tools:
            if getattr(tool, "operation", None) == "create":
                type_name = (
                    (getattr(tool, "resources", None) or [None])[0]
                    or (getattr(tool, "entries", None) or [None])[0]
                    or None
                )
                if type_name:
                    createable_resources.add(type_name)

        # Compute artifact types from all tools (shared across agents)
        all_artifact_types = list(
            {a for td in all_tool_dicts for a in (td.get("artifacts") or []) if a}
        )

        # Step 10: Require run_id and group_id from payload
        if not payload.run_id or not payload.group_id:
            await _emit_error(
                sid,
                "run_id and group_id are required",
                artifact_type,
            )
            return

        run_id = uuid.UUID(payload.run_id)
        group_id = uuid.UUID(payload.group_id)

        # DB operations
        async with get_db_connection() as conn:
            if not pool:
                pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            # Step 11: Create config snapshot (canonical — always done here)
            first_agent = config_agents[0]
            first_model = (
                models_by_id.get(first_agent.model_id)  # type: ignore[arg-type]
                if first_agent.model_id
                else None
            )
            first_provider = (
                providers_by_id.get(first_model.provider_id)  # type: ignore[arg-type]
                if first_model and getattr(first_model, "provider_id", None)
                else None
            )

            config_id = await conn.fetchval(
                """INSERT INTO config_entry (created_at, updated_at, generated, mcp, active, run_id)
                VALUES (NOW(), NOW(), false, false, true, $1) RETURNING id""",
                run_id,
            )

            if first_agent.id:
                await conn.execute(
                    """INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
                    VALUES ($1, $2, NOW(), true, false, false)
                    ON CONFLICT (config_id, agents_id) DO NOTHING""",
                    config_id,
                    first_agent.id,
                )
            if first_model and first_model.id:
                await conn.execute(
                    """INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
                    VALUES ($1, $2, NOW(), true, false, false)
                    ON CONFLICT (config_id, models_id) DO NOTHING""",
                    config_id,
                    first_model.id,
                )
            if first_provider and getattr(first_provider, "id", None):
                await conn.execute(
                    """INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
                    VALUES ($1, $2, NOW(), true, false, false)
                    ON CONFLICT (config_id, providers_id) DO NOTHING""",
                    config_id,
                    first_provider.id,
                )

            # Step 12: Initialize generation tracker (run-level)
            num_agents = len(agent_groups)
            await init_generation(str(run_id), num_agents)
            await init_resource_progress(str(run_id), len(resource_types))

            # Step 13: Emit generation_started (run-level)
            await internal_sio.emit(
                "generation_started",
                GenerationStartedData(
                    sid=sid,
                    artifact_type=artifact_type,
                    group_id=str(group_id) if group_id else "",
                    run_id=str(run_id),
                    resource_types=resource_types,
                ).model_dump(mode="json"),
            )

            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)

            # ===============================================================
            # Per-agent dispatch (scoped per agent_group)
            # ===============================================================

            for agent_group_id, agent_resource_types in agent_groups.items():
                # 13a: Resolve this agent's config chain
                agent_resource = agents_by_id.get(agent_group_id)
                if not agent_resource:
                    # Fallback to first agent (single-agent backward compat)
                    agent_resource = first_agent

                model_resource = (
                    models_by_id.get(agent_resource.model_id)  # type: ignore[arg-type]
                    if agent_resource.model_id
                    else None
                )
                provider_resource = (
                    providers_by_id.get(model_resource.provider_id)  # type: ignore[arg-type]
                    if model_resource and getattr(model_resource, "provider_id", None)
                    else None
                )

                if not model_resource:
                    logger.warning(
                        f"Agent '{agent_resource.name}' has no model — skipping"
                    )
                    continue
                if not provider_resource:
                    logger.warning(
                        f"Model '{model_resource.name}' has no provider — skipping"
                    )
                    continue

                api_key = (
                    provider_resource.key if hasattr(provider_resource, "key") else ""
                )
                if not api_key:
                    logger.warning(
                        f"No API key for provider "
                        f"'{getattr(provider_resource, 'name', '')}' — skipping"
                    )
                    continue

                model_name = (
                    model_resource.value
                    if hasattr(model_resource, "value")
                    else model_resource.name
                )
                base_url = (
                    provider_resource.endpoint
                    if hasattr(provider_resource, "endpoint")
                    else ""
                )
                temperature = (
                    agent_resource.temperature
                    if hasattr(agent_resource, "temperature")
                    else 0.0
                )
                reasoning = (
                    agent_resource.reasoning
                    if hasattr(agent_resource, "reasoning")
                    else None
                )
                voice = (
                    agent_resource.voice if hasattr(agent_resource, "voice") else None
                )
                quality = (
                    agent_resource.quality
                    if hasattr(agent_resource, "quality")
                    else None
                )
                provider_name = provider_resource.value or provider_resource.name or ""

                # 13b: Scope resource_types and entry_types for this agent
                scoped_resource_types = [
                    rt for rt in agent_resource_types if rt in createable_resources
                ]
                scoped_entry_types = [
                    rt for rt in agent_resource_types if rt not in createable_resources
                ]

                # 13c: Build scoped jinja context (clone base, inject per-agent)
                jinja_context = copy.deepcopy(jinja_context_base)
                jinja_context["resources"]["types"] = scoped_resource_types
                jinja_context["entries"]["types"] = scoped_entry_types
                jinja_context["artifacts"]["types"] = all_artifact_types
                # Legacy compat (remove after templates verified)
                jinja_context["artifacts"]["resource_types"] = scoped_resource_types
                jinja_context["artifacts"]["entry_types"] = scoped_entry_types

                # 13d: Fetch this agent's system prompt + developer instructions
                async def _fetch_prompt(ar: Any) -> str:
                    pid = ar.prompt_id if hasattr(ar, "prompt_id") else None
                    if not pid:
                        return ""
                    async with pool.acquire() as c:  # type: ignore[union-attr]
                        prompts = await get_prompts_internal(c, [pid])
                        if prompts and prompts[0].system_prompt:
                            return prompts[0].system_prompt
                        return ""

                async def _fetch_instructions(ar: Any) -> list[str]:
                    iids = ar.instruction_ids if hasattr(ar, "instruction_ids") else []
                    if not iids:
                        return []
                    async with pool.acquire() as c:  # type: ignore[union-attr]
                        instructions = await get_instructions_internal(c, iids)
                        return [inst.template for inst in instructions if inst.template]

                system_prompt, developer_instruction_templates = await asyncio.gather(
                    _fetch_prompt(agent_resource),
                    _fetch_instructions(agent_resource),
                )

                # 13e: Render developer instructions with scoped jinja context
                rendered_developer_messages = render_developer_instructions(
                    templates=developer_instruction_templates,
                    jinja_context=jinja_context,
                )

                # 13f: Build scoped messages
                messages: list[dict[str, str]] = []

                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "system",
                        system_prompt,
                        True,
                    )

                for m in rendered_developer_messages:
                    messages.append({"role": "developer", "content": m})
                    await conn.fetchval(
                        create_message_sql,
                        run_id,
                        "developer",
                        m,
                        True,
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
                        )

                # 13g: Filter tools to only those the agent declares via tool_ids
                agent_tool_id_set = (
                    set(str(tid) for tid in agent_resource.tool_ids)
                    if agent_resource and getattr(agent_resource, "tool_ids", None)
                    else set()
                )
                scoped_tool_dicts = [
                    td
                    for td in all_tool_dicts
                    if str(td.get("id", "")) in agent_tool_id_set
                ]

                # 13h: Build metadata (pass-through from caller + media agent IDs)
                metadata: dict[str, Any] = dict(payload_metadata)
                if payload.save is not None:
                    metadata["save"] = payload.save
                if resource_agent_ids.get("images"):
                    metadata["image_agent_id"] = str(resource_agent_ids["images"])
                if resource_agent_ids.get("videos"):
                    metadata["video_agent_id"] = str(resource_agent_ids["videos"])

                # 13i: Dispatch to generate_artifact
                await internal_sio.emit(
                    "generate_artifact",
                    GenerateArtifactPayload(
                        sid=sid,
                        artifact_type=artifact_type,
                        resource_type=agent_resource_types[0]
                        if agent_resource_types
                        else artifact_type,
                        run_id=str(run_id),
                        group_id=str(group_id) if group_id else None,
                        modality=payload.modality,
                        message_id=None,
                        messages=messages,
                        llm_config={
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
                        tools=scoped_tool_dicts,
                        save=payload.save,
                        metadata=metadata or None,
                        profile_id=str(profile_id) if profile_id else None,
                        artifact_id=str(artifact_id) if artifact_id else None,
                        draft_id=str(payload.draft_id) if payload.draft_id else None,
                        developer_instruction_templates=developer_instruction_templates
                        or None,
                    ).model_dump(mode="json"),
                )

    except Exception as e:
        logger.exception(f"Failed to generate {artifact_type} resources: {str(e)}")
        await _emit_error(
            sid,
            f"Failed to generate {artifact_type} resources: {str(e)}",
            artifact_type,
        )
