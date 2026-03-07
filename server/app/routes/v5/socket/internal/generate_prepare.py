"""Generation preparation handler (new) — thin I/O orchestrator.

Replaces the ~1000 line generate_prepare.py with pure functions from
prepare_pipeline.py + thin I/O.

Differences from generate_prepare.py:
  - Run creation happens here (moved from client handler)
  - session_id, profile_id, group_id always in data (resolved by client handler)
  - No create_session call — session_id propagated from client
  - Uses prepare_pipeline pure functions for all logic
  - Uses persist_run_message for message persistence
  - Uses init_run_trackers with WorkUnit state machine
  - Uses socket_event for event collection
  - Uses db_helpers for SQL wrappers

GAPs / TODOs:
  - TODO: persist_run_message only handles text. For multipart media messages
          (input modality), need a persist_multipart_message variant.
  - TODO: extra_messages and user_instructions are handled inline here.
          Consider extracting into build_agent_dispatch for full purity.
  - TODO: _fetch_artifact_types and _fetch_entry_types are I/O functions
          kept here. Could move to a data_fetchers.py module.
  - resolve_websocket_context is wired as dual-path: used when ARTIFACT_RESOLVERS
          has the artifact type, falls back to legacy fetcher otherwise.
          Add more ArtifactResolverConfigs to expand coverage.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from app.infra.generation import convert_tools_to_dict
from app.infra.generation.media_context import wrap_media_entries
from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.types import ArtifactRequest
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.init_run_trackers import init_run_trackers
from app.infra.websocket.persist_run_message import persist_run_message
from app.infra.websocket.run_tracker import WorkUnit
from app.infra.websocket.socket_event import SocketEvent, flush_events, internal_event
from app.infra.websocket.typed_emit import emit_to_internal
from app.infra.websocket_context import ARTIFACT_RESOLVERS, resolve_websocket_context
from app.routes.v5.socket.client.registry import REGISTRY
from app.routes.v5.socket.client.types import GeneratePayload
from app.routes.v5.socket.internal.generate_artifact import GenerateArtifactPayload
from app.routes.v5.socket.internal.generation_types import GenerationStartedData
from app.routes.v5.socket.internal.prepare_pipeline import (
    build_agent_dispatch,
    build_agent_groups,
    build_agent_groups_from_scores,
    build_jinja_from_ws_ctx,
    build_namespaced_context,
    build_resource_agent_ids_from_scores,
    compute_all_artifact_types,
    compute_createable_resources,
    dump_fetcher_result,
    enrich_tools_with_args,
    enrich_tools_with_args_outputs,
    resolve_agent_config,
    validate_payload,
)
from app.routes.v5.socket.types import GenerateErrorApiRequest
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.instructions.get import get_instructions
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.prompts.get import get_prompts
from app.routes.v5.tools.resources.providers.get import get_providers
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _emit_error(
    sid: str,
    message: str,
    artifact_type: str,
    *,
    group_id: str | None = None,
) -> None:
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


async def _fetch_artifact_types(
    artifact_types: list[Any],
    profile_id: uuid.UUID,
    artifact_id: uuid.UUID | None,
    draft_id: uuid.UUID | None,
    pool: Any,
) -> dict[str, dict[str, dict[str, Any]]]:
    """Fetch data for each artifact_type item. Returns {name: {operation: dumped}}."""
    results: dict[str, dict[str, dict[str, Any]]] = {}
    for item in artifact_types:
        config = REGISTRY.get(item.name)
        if not config or not config.fetcher or item.operation != "get":
            continue
        try:
            fetcher_pool = pool if config.requires_pool else None
            result = await config.fetcher(
                profile_id, artifact_id, draft_id, fetcher_pool
            )
            results.setdefault(item.name, {})[item.operation] = dump_fetcher_result(
                result
            )
        except Exception as e:
            logger.warning(
                f"Failed to fetch artifact_type '{item.name}.{item.operation}': {e}"
            )
    return results


async def _fetch_entry_types(
    entry_types: list[Any],
    conn: Any,
) -> dict[str, dict[str, Any]]:
    """Fetch data for each entry_type item. Returns {name: {operation: data}}."""
    from app.registry.operations import ENTRY_OPS, resolve_callable

    results: dict[str, dict[str, Any]] = {}
    for item in entry_types:
        if item.operation != "get":
            continue
        fn = resolve_callable(item.name, item.operation, ENTRY_OPS)
        if fn is None:
            continue
        try:
            result = await fn(conn)
            if hasattr(result, "model_dump"):
                results.setdefault(item.name, {})[item.operation] = result.model_dump(
                    mode="json"
                )
            elif isinstance(result, list):
                results.setdefault(item.name, {})[item.operation] = [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in result
                ]
            else:
                results.setdefault(item.name, {})[item.operation] = result
        except Exception as e:
            logger.warning(
                f"Failed to fetch entry_type '{item.name}.{item.operation}': {e}"
            )
    return results


@internal_sio.on("generate_prepare")  # type: ignore
async def generate_prepare_handler_new(data: dict[str, Any]) -> None:
    """Handle generate_prepare — thin orchestrator over pure functions.

    Expects session_id, profile_id, group_id already in data
    (resolved by client handler, propagated through internal/generate).
    """
    sid = data.get("sid", "")
    if not sid:
        return

    artifact_types_raw = data.get("artifact_types") or []
    artifact_type = (
        artifact_types_raw[0]["name"]
        if artifact_types_raw and isinstance(artifact_types_raw[0], dict)
        else "unknown"
    )

    # Identity context — resolved at client boundary, propagated through internal/generate
    profile_id_str = data.get("profile_id")
    profiles_id_str = data.get("profiles_id")
    session_id_str = data.get("session_id")
    group_id_str = data.get("group_id")

    if not profile_id_str:
        await _emit_error(sid, "Profile not found. Please reconnect.", artifact_type)
        return

    if not profiles_id_str:
        await _emit_error(
            sid, "Profiles resource not found. Please reconnect.", artifact_type
        )
        return

    if not session_id_str:
        await _emit_error(sid, "Session not found. Please reconnect.", artifact_type)
        return

    if not group_id_str:
        await _emit_error(sid, "group_id is required.", artifact_type)
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        profiles_id = uuid.UUID(profiles_id_str)
        session_id = uuid.UUID(session_id_str)
        group_id = uuid.UUID(group_id_str)
        payload = GeneratePayload(**data)
    except Exception as e:
        await _emit_error(sid, f"Invalid request: {str(e)}", artifact_type)
        return

    config = REGISTRY.get(artifact_type)
    if not config:
        await _emit_error(sid, f"Unknown artifact_type: {artifact_type}", artifact_type)
        return

    try:
        # --- Step 1: Validate (pure) ---
        resource_types = [rt.name for rt in payload.resource_types if rt]
        error = validate_payload(
            resource_types_raw=resource_types,
            artifact_type=artifact_type,
            valid_resource_types=config.valid_resource_types,
            entry_types=config.entry_types,
            requires_draft=config.requires_draft,
            draft_id=payload.draft_id,
        )
        if error:
            await _emit_error(sid, error, artifact_type)
            return

        # --- Step 2: Resolve artifact_id ---
        artifact_id = payload.artifact_id
        payload_metadata = payload.metadata or {}
        if (
            artifact_type == "profile"
            and not artifact_id
            and payload_metadata.get("staff_id")
        ):
            artifact_id = uuid.UUID(payload_metadata["staff_id"])

        # --- Steps 3–7: Resolve context, agent groups, Jinja, tools ---
        #
        # Dual-path: use resolve_websocket_context (composable infra) when the
        # artifact type has a resolver; fall back to legacy registry fetcher otherwise.
        redis = get_redis_client()
        bypass_cache = True

        use_ws_ctx = artifact_type in ARTIFACT_RESOLVERS

        if use_ws_ctx:
            # ── New path: resolve_websocket_context ──────────────────────
            async with get_db_connection() as ctx_conn:
                ws_ctx = await resolve_websocket_context(
                    ctx_conn,
                    redis,
                    profile_id=profile_id,
                    requests=[
                        ArtifactRequest(
                            artifact_type=artifact_type,
                            artifact_id=artifact_id,
                            group_id=group_id,
                            draft_id=payload.draft_id,
                        )
                    ],
                    bypass_cache=bypass_cache,
                )

            if ws_ctx is None:
                await _emit_error(sid, "Failed to resolve context.", artifact_type)
                return

            if not ws_ctx.agents:
                await _emit_error(
                    sid, "No system/agent configuration found.", artifact_type
                )
                return

            # Lookups from ws_ctx (already resolved + deduped)
            agents_by_id = {a.id: a for a in ws_ctx.agents}
            models_by_id = {m.id: m for m in ws_ctx.models}
            providers_by_id = {p.id: p for p in ws_ctx.providers}
            config_agents = ws_ctx.agents

            # Agent groups from tool scores
            agent_groups = build_agent_groups_from_scores(
                resource_types=resource_types,
                scores=ws_ctx.scores,
            )

            # resource_agent_ids for metadata (image_agent_id, video_agent_id)
            resource_agent_ids = build_resource_agent_ids_from_scores(ws_ctx.scores)

            # Jinja context from ws_ctx artifacts
            entry_results: dict[str, dict[str, Any]] | None = None
            if payload.entry_types:
                async with get_db_connection() as entry_conn:
                    entry_results = await _fetch_entry_types(
                        payload.entry_types, entry_conn
                    )

            jinja_context_base = build_jinja_from_ws_ctx(ws_ctx, entry_results)
            wrap_media_entries(jinja_context_base)

            # Tools from ws_ctx (already resolved)
            config_tools = ws_ctx.tools
            all_tool_dicts = convert_tools_to_dict(config_tools)
            all_tool_dicts = enrich_tools_with_args(
                all_tool_dicts, config_tools, ws_ctx.args
            )
            all_tool_dicts = enrich_tools_with_args_outputs(
                all_tool_dicts, config_tools, ws_ctx.args_outputs
            )
            createable_resources = compute_createable_resources(config_tools)
            all_artifact_types = compute_all_artifact_types(all_tool_dicts)

            # Prompts/instructions lookups (no per-agent fetch needed)
            prompts_by_id = {p.id: p for p in ws_ctx.prompts}
            instructions_by_id = {i.id: i for i in ws_ctx.instructions}

        else:
            # ── Legacy path: registry fetcher ────────────────────────────
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")

            if not config.fetcher:
                await _emit_error(
                    sid, f"No fetcher configured for {artifact_type}", artifact_type
                )
                return

            result: Any = await config.fetcher(
                profile_id, artifact_id, payload.draft_id, pool
            )

            # Resolve systems → agents → models → providers
            config_systems = getattr(result, "systems", None) or []
            config_agents = getattr(result, "agents", None) or []

            if config_systems:
                system_agent_ids = {
                    aid
                    for s in config_systems
                    for aid in (getattr(s, "agent_ids", None) or [])
                    if aid
                }
                if system_agent_ids:
                    async with pool.acquire() as c:
                        config_agents = await get_agents(
                            c, list(system_agent_ids), redis, bypass_cache
                        )

            if not config_agents:
                await _emit_error(
                    sid, "No system/agent configuration found.", artifact_type
                )
                return

            agents_by_id = {a.id: a for a in config_agents if a.id}
            config_tools_all = getattr(result, "tools", None) or []
            tools_by_id = {t.id: t for t in config_tools_all if getattr(t, "id", None)}

            model_ids = list({a.model_id for a in config_agents if a.model_id})
            config_models = []
            if model_ids:
                async with pool.acquire() as c:
                    config_models = await get_models(c, model_ids, redis, bypass_cache)
            models_by_id = {m.id: m for m in config_models if m.id}

            provider_ids = list(
                {
                    m.provider_id
                    for m in config_models
                    if getattr(m, "provider_id", None) is not None
                }
            )
            config_providers = []
            if provider_ids:
                async with pool.acquire() as c:
                    config_providers = await get_providers(
                        c, provider_ids, redis, bypass_cache=bypass_cache
                    )
            providers_by_id = {
                p.id: p for p in config_providers if getattr(p, "id", None)
            }

            # Build agent groups
            resource_system_ids: dict[str, uuid.UUID] = (
                getattr(result, "resource_system_ids", {}) or {}
            )
            resource_agent_ids: dict[str, uuid.UUID] = result.resource_agent_ids or {}
            systems_by_id = {s.id: s for s in config_systems if s.id}

            agent_groups = build_agent_groups(
                resource_types=resource_types,
                config_systems=config_systems,
                config_agents=config_agents,
                agents_by_id=agents_by_id,
                tools_by_id=tools_by_id,
                systems_by_id=systems_by_id,
                resource_system_ids=resource_system_ids,
                resource_agent_ids=resource_agent_ids,
                requested_modality=payload.modality or "call",
            )

            # Jinja context
            artifact_results = await _fetch_artifact_types(
                payload.artifact_types,
                profile_id,
                artifact_id,
                payload.draft_id,
                pool,
            )
            if artifact_type not in artifact_results:
                artifact_results[artifact_type] = {"get": dump_fetcher_result(result)}

            entry_results = None
            if payload.entry_types:
                async with get_db_connection() as entry_conn:
                    entry_results = await _fetch_entry_types(
                        payload.entry_types, entry_conn
                    )

            jinja_context_base = build_namespaced_context(
                artifact_results, entry_results
            )
            wrap_media_entries(jinja_context_base)

            # Enrich tools
            config_tools = getattr(result, "tools", None) or []
            config_args = getattr(result, "args", None) or []
            config_args_outputs = getattr(result, "args_outputs", None) or []

            all_tool_dicts = convert_tools_to_dict(config_tools)
            all_tool_dicts = enrich_tools_with_args(
                all_tool_dicts, config_tools, config_args
            )
            all_tool_dicts = enrich_tools_with_args_outputs(
                all_tool_dicts, config_tools, config_args_outputs
            )
            createable_resources = compute_createable_resources(config_tools)
            all_artifact_types = compute_all_artifact_types(all_tool_dicts)

            # No pre-resolved prompts/instructions in legacy path
            prompts_by_id = None
            instructions_by_id = None

        # --- Step 8: Create run (all identity context already resolved) ---
        agent_ids_for_run = [aid for aid in agent_groups if aid]
        async with get_db_connection() as conn:
            from app.routes.v5.tools.entries.runs.create import create_run

            run = await create_run(
                conn,
                group_id=group_id,
                session_id=session_id,
                profiles_id=profiles_id,
                agent_ids=agent_ids_for_run,
            )
            run_id = run.id

        # --- Step 9: Init trackers ---
        units = [
            WorkUnit(
                agent_id=str(aid),
                target_type="resource" if rt in createable_resources else "entry",
                target_name=rt,
            )
            for aid, rts in agent_groups.items()
            for rt in rts
        ]
        await init_run_trackers(
            redis,
            run_id=str(run_id),
            num_agents=len(agent_groups),
            num_resources=len(resource_types),
            units=units,
        )

        # --- Step 10: Build dispatches + persist messages ---
        events: list[SocketEvent] = []

        events.append(
            internal_event(
                "generation_started",
                GenerationStartedData(
                    sid=sid,
                    artifact_type=artifact_type,
                    group_id=group_id_str,
                    run_id=str(run_id),
                    resource_types=resource_types,
                ).model_dump(mode="json"),
            )
        )

        for agent_group_id, agent_resource_types in agent_groups.items():
            agent_resource = agents_by_id.get(agent_group_id) or config_agents[0]

            llm_config = resolve_agent_config(
                agent_resource, models_by_id, providers_by_id
            )
            if not llm_config:
                continue

            # Resolve prompt + instructions for this agent
            if prompts_by_id is not None and instructions_by_id is not None:
                # ws_ctx path: already resolved, just look up
                pid = getattr(agent_resource, "prompt_id", None)
                prompt_obj = prompts_by_id.get(pid) if pid else None
                system_prompt = (
                    (getattr(prompt_obj, "system_prompt", "") or "")
                    if prompt_obj
                    else ""
                )

                iids = getattr(agent_resource, "instruction_ids", None) or []
                dev_templates = [
                    instructions_by_id[iid].template
                    for iid in iids
                    if iid in instructions_by_id and instructions_by_id[iid].template
                ]
            else:
                # Legacy path: fetch per-agent
                pool = get_pool()

                async def _fetch_prompt(ar: Any) -> str:
                    pid = getattr(ar, "prompt_id", None)
                    if not pid or not pool:
                        return ""
                    async with pool.acquire() as c:
                        prompts = await get_prompts(c, [pid], redis)
                        return (
                            prompts[0].system_prompt
                            if prompts and prompts[0].system_prompt
                            else ""
                        )

                async def _fetch_instructions(ar: Any) -> list[str]:
                    iids = getattr(ar, "instruction_ids", None) or []
                    if not iids or not pool:
                        return []
                    async with pool.acquire() as c:
                        insts = await get_instructions(c, iids, redis)
                        return [inst.template for inst in insts if inst.template]

                system_prompt, dev_templates = await asyncio.gather(
                    _fetch_prompt(agent_resource),
                    _fetch_instructions(agent_resource),
                )

            dispatch = build_agent_dispatch(
                agent_id=agent_group_id,
                agent_resource_types=agent_resource_types,
                agent=agent_resource,
                llm_config=llm_config,
                jinja_context_base=jinja_context_base,
                createable_resources=createable_resources,
                all_tool_dicts=all_tool_dicts,
                all_artifact_types=all_artifact_types,
                system_prompt=system_prompt,
                developer_instruction_templates=dev_templates,
                payload_metadata=payload_metadata,
                resource_agent_ids=resource_agent_ids,
                save=None,  # save:bool removed — all results are soft-created, promoted later
            )

            # Persist messages (I/O)
            async with get_db_connection() as conn:
                for msg in dispatch.messages:
                    if msg.persist:
                        await persist_run_message(
                            conn,
                            run_id=run_id,
                            session_id=session_id,
                            role=msg.role,
                            content=msg.raw_text,
                        )

                # Extra messages (not persisted — pre-existing chat history)
                all_messages = list(dispatch.messages_for_llm)
                if payload.extra_messages:
                    for em in payload.extra_messages:
                        all_messages.append(em)

                # User instructions (persisted)
                if payload.user_instructions:
                    for instruction in payload.user_instructions:
                        all_messages.append({"role": "user", "content": instruction})
                        await persist_run_message(
                            conn,
                            run_id=run_id,
                            session_id=session_id,
                            role="user",
                            content=instruction,
                        )

            # Build dispatch event
            events.append(
                internal_event(
                    "generate_artifact",
                    GenerateArtifactPayload(
                        sid=sid,
                        artifact_type=artifact_type,
                        resource_type=agent_resource_types[0]
                        if agent_resource_types
                        else artifact_type,
                        run_id=str(run_id),
                        group_id=group_id_str,
                        modality=payload.modality,
                        message_id=None,
                        messages=all_messages,
                        llm_config={
                            "model": llm_config.model,
                            "api_key": llm_config.api_key,
                            "base_url": llm_config.base_url,
                            "temperature": llm_config.temperature,
                            "reasoning": llm_config.reasoning,
                            "provider": llm_config.provider,
                            "voice": llm_config.voice,
                            "quality": llm_config.quality,
                            "length_seconds": None,
                            "tool_choice": "required",
                        },
                        tools=dispatch.scoped_tools,
                        metadata=dispatch.metadata or None,
                        profile_id=profile_id_str,
                        profiles_id=profiles_id_str,
                        session_id=session_id_str,
                        artifact_id=str(artifact_id) if artifact_id else None,
                        draft_id=str(payload.draft_id) if payload.draft_id else None,
                        developer_instruction_templates=dispatch.developer_instruction_templates,
                        agent_id=str(agent_group_id),
                    ).model_dump(mode="json"),
                )
            )

        # --- Step 11: Flush all events ---
        await flush_events(events, internal_sio=internal_sio)

    except Exception as e:
        logger.exception(f"Failed to generate {artifact_type} resources: {str(e)}")
        await _emit_error(
            sid,
            f"Failed to generate {artifact_type} resources: {str(e)}",
            artifact_type,
        )
