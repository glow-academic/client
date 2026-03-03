"""Benchmark test artifact detail endpoint.

Three-layer BFF pattern:
- get_test_internal(): Core data fetcher, returns TestInternalData
- get_test_client(): HTTP response layer with caching
- get_test_websocket(): WebSocket response layer with config resources

Uses view internal handlers with parallel query execution:
1. Query 1 (Tests): Test-level data via test view
2. Query 2 (Invocations): Invocation-level data via test_invocation view

Each query runs on its own connection from the pool for true parallelism.
"""

import asyncio
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.v5.api.main.test.permissions import compute_test_status
from app.routes.v5.api.main.test.types import (
    GetTestArtifactRequest,
    GetTestArtifactResponse,
    GetTestWebsocketResponse,
    TestEntries,
    TestInternalData,
    TestResources,
    TestRunItem,
    TestStatusSummary,
    TestWebsocketResources,
)
from app.routes.v5.tools.entries.test.search import get_test_list_internal
from app.routes.v5.tools.entries.test_invocation.get import get_test_invocation_internal
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args_internal
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs_internal
from app.routes.v5.tools.resources.evals.get import get_evals_internal
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.routes.v5.tools.resources.rubrics.get import get_rubrics_batch_internal
from app.routes.v5.tools.resources.tools.get import get_tools_internal
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Layer 1: Core data fetcher (no caching, no HTTP concerns)
# =============================================================================


async def get_test_internal(
    conn: asyncpg.Connection,
    test_id: UUID,
    bypass_cache: bool = False,
    profile_id: UUID | None = None,
) -> TestInternalData:
    """Core test artifact detail fetcher.

    Fetches all data, computes business logic, and returns TestInternalData.
    No caching — consumer layers handle their own caching.
    """
    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # === PARALLEL FETCH: Tests + Invocations ===
        async def fetch_tests() -> list:
            async with pool.acquire() as c:
                result = await get_test_list_internal(
                    c,
                    test_ids=[test_id],
                    page_limit=1,
                    bypass_cache=bypass_cache,
                )
                return result.items or []

        async def fetch_invocations() -> list:
            async with pool.acquire() as c:
                return await get_test_invocation_internal(
                    conn=c,
                    test_id=test_id,
                    bypass_cache=bypass_cache,
                )

        tests, invocations = await asyncio.gather(fetch_tests(), fetch_invocations())

        test = tests[0] if tests else None
        if not test:
            return TestInternalData()

        # === DERIVE STATUS FROM INVOCATIONS ===
        num_invocations = len(invocations)
        num_completed = sum(1 for inv in invocations if inv.invocation_completed)
        status = compute_test_status(num_invocations, num_completed)

        # === RESOLVE CONFIG CHAIN (group_id -> agent/model/provider) ===
        first_invocation = invocations[0] if invocations else None
        group_id = first_invocation.group_id if first_invocation else None

        agent_ids: dict[str, UUID | None] = {}
        config_agent_resources = None
        config_model_resources = None
        config_provider_resources = None

        async def _fetch_config_chain(
            p_agent_id: UUID | None,
            p_model_id: UUID | None,
            p_provider_id: UUID | None,
        ) -> tuple[Any, Any, Any]:
            """Parallel fetch agent/model/provider resources from resolved IDs."""

            async def fetch_agents() -> Any:
                if not p_agent_id:
                    return None
                async with pool.acquire() as c:
                    return await get_agents_internal(
                        c, [p_agent_id], bypass_cache=bypass_cache
                    )

            async def fetch_models() -> Any:
                if not p_model_id:
                    return None
                async with pool.acquire() as c:
                    return await get_models_internal(
                        c, [p_model_id], bypass_cache=bypass_cache
                    )

            async def fetch_providers() -> Any:
                if not p_provider_id:
                    return None
                async with pool.acquire() as c:
                    return await get_providers_internal(
                        c, [p_provider_id], bypass_cache=bypass_cache
                    )

            return await asyncio.gather(
                fetch_agents(), fetch_models(), fetch_providers()
            )

        if group_id:
            config_row = await conn.fetchrow(
                """
                SELECT rac.agents_id AS agent_id, ar.model_id, mr.provider_id
                FROM runs_entry r
                JOIN runs_agents_connection rac ON rac.run_id = r.id AND rac.active = true
                JOIN agents_resource ar ON ar.id = rac.agents_id AND ar.active = true
                LEFT JOIN models_resource mr ON mr.id = ar.model_id
                WHERE r.group_id = $1
                ORDER BY r.created_at DESC, rac.created_at DESC
                LIMIT 1
                """,
                group_id,
            )
            if config_row:
                agent_ids["primary"] = config_row["agent_id"]
                (
                    config_agent_resources,
                    config_model_resources,
                    config_provider_resources,
                ) = await _fetch_config_chain(
                    config_row["agent_id"],
                    config_row["model_id"],
                    config_row["provider_id"],
                )

        # Dynamic agent fallback: resolve via entry-type bindings (like attempts)
        if not agent_ids.get("primary") and profile_id:
            from app.routes.v5.socket.types import TEST_GRADE_ENTRY_TYPES

            resolve_rows = await conn.fetch(
                "SELECT entry_type, agent_id FROM socket_resolve_attempt_entries_v4($1, $2)",
                profile_id,
                TEST_GRADE_ENTRY_TYPES,
            )
            if resolve_rows:
                resolved_agent_id = resolve_rows[0]["agent_id"]
                agent_ids["primary"] = resolved_agent_id

                # Resolve agent -> model -> provider chain
                chain_row = await conn.fetchrow(
                    """
                    SELECT aaj.agent_id, ar.model_id, mr.provider_id
                    FROM agent_agents_junction aaj
                    JOIN agents_resource ar ON ar.id = aaj.agents_id
                    LEFT JOIN models_resource mr ON mr.id = ar.model_id
                    WHERE aaj.agent_id = $1 AND aaj.active = true
                    LIMIT 1
                    """,
                    resolved_agent_id,
                )
                if chain_row:
                    (
                        config_agent_resources,
                        config_model_resources,
                        config_provider_resources,
                    ) = await _fetch_config_chain(
                        resolved_agent_id,
                        chain_row["model_id"],
                        chain_row["provider_id"],
                    )

        # === HYDRATION: collect IDs ===
        eval_name_ids: set[UUID] = set()
        rubric_ids: set[UUID] = set()

        # Collect all run_ids from invocations for model/agent name resolution
        all_run_ids: list[UUID] = []
        for invocation in invocations:
            if invocation.run_ids:
                all_run_ids.extend(invocation.run_ids)
            if invocation.rubric_id:
                rubric_ids.add(invocation.rubric_id)

        # Resolve run_ids -> model/agent name_ids and bundle entry IDs
        run_name_map: dict[UUID, tuple[UUID | None, UUID | None]] = {}
        run_bundle_map: dict[UUID, UUID] = {}
        if all_run_ids:
            async with pool.acquire() as c:
                rows = await c.fetch(
                    """
                    SELECT DISTINCT ON (rrc.runs_id)
                           rrc.runs_id,
                           mnj.name_id AS model_name_id,
                           anj.name_id AS agent_name_id
                    FROM runs_runs_connection rrc
                    JOIN runs_entry re ON re.id = rrc.run_id
                    LEFT JOIN runs_agents_connection rac ON rac.run_id = re.id AND rac.active = true
                    LEFT JOIN agents_resource ar ON ar.id = rac.agents_id AND ar.active = true
                    LEFT JOIN agent_agents_junction aaj ON aaj.agents_id = ar.id AND aaj.active = true
                    LEFT JOIN agent_names_junction anj ON anj.agent_id = aaj.agent_id AND anj.active = true
                    LEFT JOIN model_names_junction mnj ON mnj.model_id = ar.model_id AND mnj.active = true
                    WHERE rrc.runs_id = ANY($1::uuid[]) AND rrc.active = true
                    ORDER BY rrc.runs_id, rac.created_at DESC NULLS LAST
                    """,
                    all_run_ids,
                )
                for row in rows:
                    model_nid = row["model_name_id"]
                    agent_nid = row["agent_name_id"]
                    run_name_map[row["runs_id"]] = (model_nid, agent_nid)
                    if model_nid:
                        eval_name_ids.add(model_nid)
                    if agent_nid:
                        eval_name_ids.add(agent_nid)

                # Resolve run_ids -> suite_entry_id
                bundle_rows = await c.fetch(
                    """
                    SELECT bbrc.runs_id, bbrc.suite_id
                    FROM suite_runs_connection bbrc
                    WHERE bbrc.runs_id = ANY($1::uuid[])
                      AND bbrc.active = true
                    """,
                    all_run_ids,
                )
                for brow in bundle_rows:
                    run_bundle_map[brow["runs_id"]] = brow["suite_id"]

        # === BATCH RESOLVE: evals, names, rubrics ===
        eval_name: str | None = None
        eval_description: str | None = None
        rubric_name_map: dict[UUID, str] = {}
        name_map: dict[UUID, str] = {}

        async def fetch_eval_info() -> tuple[str | None, str | None]:
            if not test.eval_id:
                return None, None
            async with pool.acquire() as c:
                evals = await get_evals_internal(
                    c, [test.eval_id], bypass_cache=bypass_cache
                )
                if evals and evals[0]:
                    return evals[0].name, evals[0].description
            return None, None

        async def fetch_names() -> dict[UUID, str]:
            if not eval_name_ids:
                return {}
            async with pool.acquire() as c:
                names_list = await get_names(
                    c, list(eval_name_ids), bypass_cache=bypass_cache
                )
                return {n.id: n.name for n in names_list if n.id and n.name}

        async def fetch_rubrics() -> dict[UUID, str]:
            if not rubric_ids:
                return {}
            async with pool.acquire() as c:
                rubrics_list = await get_rubrics_batch_internal(
                    c, list(rubric_ids), bypass_cache=bypass_cache
                )
                return {
                    r.rubric_id: r.name for r in rubrics_list if r.rubric_id and r.name
                }

        (eval_name, eval_description), name_map, rubric_name_map = await asyncio.gather(
            fetch_eval_info(),
            fetch_names(),
            fetch_rubrics(),
        )

        # === BUILD RUNS LIST FROM INVOCATIONS ===
        runs: list[TestRunItem] = []
        completed_count = 0
        in_progress_count = 0
        not_started_count = 0

        for invocation in invocations:
            first_run_id = invocation.run_ids[0] if invocation.run_ids else None
            first_group_id = invocation.group_id

            model_name: str | None = None
            agent_name: str | None = None
            if first_run_id and first_run_id in run_name_map:
                model_nid, agent_nid = run_name_map[first_run_id]
                if model_nid:
                    model_name = name_map.get(model_nid)
                if agent_nid:
                    agent_name = name_map.get(agent_nid)

            invocation_status = (
                "completed" if invocation.invocation_completed else "not_started"
            )
            if invocation_status == "completed":
                completed_count += 1
            else:
                not_started_count += 1

            bundle_entry_id = run_bundle_map.get(first_run_id) if first_run_id else None

            runs.append(
                TestRunItem(
                    chat_id=str(invocation.invocation_id),
                    invocation_id=str(invocation.invocation_id),
                    run_id=str(first_run_id) if first_run_id else None,
                    group_id=str(first_group_id) if first_group_id else None,
                    suite_entry_id=(str(bundle_entry_id) if bundle_entry_id else None),
                    model_name=model_name,
                    agent_name=agent_name,
                    status=invocation_status,
                    grade_score=invocation.grade_score,
                    grade_passed=invocation.grade_passed,
                )
            )

        status_summary = TestStatusSummary(
            total=len(runs),
            completed=completed_count,
            in_progress=in_progress_count,
            not_started=not_started_count,
        )

        # === BUILD RESOURCES PAYLOAD ===
        resources_payload = TestResources(
            evals={
                str(test.eval_id): {
                    "name": eval_name,
                    "description": eval_description,
                }
            }
            if test.eval_id and (eval_name or eval_description)
            else None,
            rubrics={
                str(rid): {"name": rname} for rid, rname in rubric_name_map.items()
            }
            if rubric_name_map
            else None,
            names={str(nid): nname for nid, nname in name_map.items()}
            if name_map
            else None,
        )

        return TestInternalData(
            test=test,
            invocations=invocations,
            group_id=group_id,
            agent_ids=agent_ids,
            eval_name=eval_name,
            eval_description=eval_description,
            rubric_name_map=rubric_name_map,
            run_name_map=run_name_map,
            run_bundle_map=run_bundle_map,
            name_map=name_map,
            runs=runs,
            status=status,
            status_summary=status_summary,
            resources_payload=resources_payload,
            config_agent_resources=config_agent_resources,
            config_model_resources=config_model_resources,
            config_provider_resources=config_provider_resources,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path="/api/v5/artifacts/test/get",
            operation="test_get_internal",
            sql_query="view_internals: tests, invocations",
            sql_params=None,
        )
        raise  # pragma: no cover


# =============================================================================
# Layer 2a: HTTP client response (with caching)
# =============================================================================


async def get_test_client(
    conn: asyncpg.Connection,
    test_id: UUID,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v5/artifacts/test/get",
) -> tuple[GetTestArtifactResponse, bool]:
    """HTTP response layer with caching.

    Calls get_test_internal() and assembles GetTestArtifactResponse.
    Returns (response, cache_hit).
    """
    tags = ["artifacts", "test"]
    body_dict = GetTestArtifactRequest(test_id=test_id).model_dump(mode="json")
    cache_key_val = cache_key(cache_key_path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetTestArtifactResponse.model_validate(cached["data"]), True

    data = await get_test_internal(
        conn=conn,
        test_id=test_id,
        bypass_cache=bypass_cache,
    )

    if not data.test:
        raise HTTPException(status_code=404, detail="Benchmark test not found")

    # Get first rubric name from map for backward compat
    rubric_name: str | None = None
    if data.rubric_name_map:
        rubric_name = next(iter(data.rubric_name_map.values()), None)

    api_response = GetTestArtifactResponse(
        test=data.test,
        invocations=data.invocations,
        status=data.status,
        eval_name=data.eval_name,
        eval_description=data.eval_description,
        rubric_name=rubric_name,
        infinite_mode=data.test.infinite_mode,
        runs=data.runs,
        status_summary=data.status_summary,
        entries=TestEntries(
            test=[data.test],
            test_invocation=data.invocations,
        ),
        resources=data.resources_payload,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=tags,
    )

    return api_response, False


# =============================================================================
# Layer 2b: WebSocket response (config resources + tools)
# =============================================================================


async def get_test_websocket(
    conn: asyncpg.Connection,
    test_id: UUID,
    bypass_cache: bool = False,
    profile_id: UUID | None = None,
) -> GetTestWebsocketResponse:
    """WebSocket response layer with config resources.

    Calls get_test_internal() and assembles GetTestWebsocketResponse
    with content resources + config resources (agents, models, providers, tools).
    Also fetches config_profile (for rate limiting) and runs_today in parallel
    when profile_id is provided.
    """
    from datetime import UTC, datetime

    from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
    from app.routes.v5.tools.resources.profiles.get import get_profiles_internal

    data = await get_test_internal(
        conn=conn,
        test_id=test_id,
        bypass_cache=bypass_cache,
        profile_id=profile_id,
    )

    if not data.test:
        return GetTestWebsocketResponse()

    pool = get_pool()

    async def fetch_config_profile():
        if not pool or not profile_id:
            return None
        async with pool.acquire() as c:
            return await get_profiles_internal(c, [profile_id], bypass_cache)

    async def fetch_runs_today():
        if not pool or not profile_id:
            return None
        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as c:
            return await get_run_list_entries_internal(
                conn=c,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    async def fetch_tools():
        if not data.config_agent_resources or not pool:
            return None
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            if agent.tool_ids:
                tool_ids.extend(agent.tool_ids)
        if not tool_ids:
            return None
        async with pool.acquire() as c:
            return await get_tools_internal(
                c, list(set(tool_ids)), bypass_cache=bypass_cache
            )

    config_profile_result, runs_result, config_tools = await asyncio.gather(
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build websocket resources (content only)
    ws_resources = TestWebsocketResources(
        evals=data.resources_payload.evals,
        rubrics=data.resources_payload.rubrics,
        names=data.resources_payload.names,
    )

    return GetTestWebsocketResponse(
        entries=TestEntries(
            test=[data.test],
            test_invocation=data.invocations,
            runs=runs_result,
        ),
        resources=ws_resources,
        params=GetTestArtifactRequest(test_id=test_id),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=config_tools,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        resource_agent_ids=data.agent_ids if data.agent_ids else None,
        group_id=data.group_id,
    )


# =============================================================================
# HTTP Route Handler
# =============================================================================


@router.post("/get", response_model=GetTestArtifactResponse)
async def get_test_artifact(
    request: GetTestArtifactRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestArtifactResponse:
    """Get benchmark test artifact details with tests/invocations in parallel."""
    tags = ["artifacts", "test"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        response_data, cache_hit = await get_test_client(
            conn=conn,
            test_id=request.test_id,
            bypass_cache=bypass_cache,
            cache_key_path=http_request.url.path,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1" if cache_hit else "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_get",
            request=http_request,
        )
