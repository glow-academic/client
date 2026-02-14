"""Group artifact endpoint - POST /artifacts/group/get

Uses lean views (mv_groups, mv_runs) and hydrates resource names
via naming junctions. Message fetching preserved from pricing/group_detail.
"""

from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.types import (
    GetGroupDetailRequest,
    GetGroupDetailResponse,
    GroupDetailCallItem,
    GroupDetailContentItem,
    GroupDetailMessageItem,
    GroupDetailResourceItem,
    GroupDetailRunItem,
    GroupDetailRunWithMessages,
)
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _fetch_runs_with_cost(conn: asyncpg.Connection, group_id: UUID) -> list[dict]:
    """Fetch runs from mv_runs and compute per-run cost."""
    run_rows = await conn.fetch(
        """
        SELECT
            run_id, group_id,
            input_tokens, output_tokens, cached_input_tokens,
            run_created_at,
            agent_ids, model_ids, provider_ids,
            input_pricing_pricing_id, input_pricing_count, input_pricing_unit_id,
            output_pricing_pricing_id, output_pricing_count, output_pricing_unit_id,
            cached_pricing_pricing_id, cached_pricing_count, cached_pricing_unit_id
        FROM mv_runs
        WHERE group_id = $1
        ORDER BY run_created_at
        """,
        group_id,
    )

    if not run_rows:
        return []

    # Collect pricing/unit IDs for batch fetch
    all_pricing_ids: set[UUID] = set()
    all_unit_ids: set[UUID] = set()
    for row in run_rows:
        for pid_col in [
            "input_pricing_pricing_id",
            "output_pricing_pricing_id",
            "cached_pricing_pricing_id",
        ]:
            if row[pid_col]:
                all_pricing_ids.add(row[pid_col])
        for uid_col in [
            "input_pricing_unit_id",
            "output_pricing_unit_id",
            "cached_pricing_unit_id",
        ]:
            if row[uid_col]:
                all_unit_ids.add(row[uid_col])

    pricing_map: dict[UUID, Decimal] = {}
    unit_map: dict[UUID, Decimal] = {}

    if all_pricing_ids:
        p_rows = await conn.fetch(
            "SELECT id, price FROM pricing_resource WHERE id = ANY($1) AND active = TRUE",
            list(all_pricing_ids),
        )
        pricing_map = {r["id"]: Decimal(str(r["price"])) for r in p_rows}

    if all_unit_ids:
        u_rows = await conn.fetch(
            "SELECT id, value FROM artifact_units_relation WHERE id = ANY($1) AND active = TRUE",
            list(all_unit_ids),
        )
        unit_map = {r["id"]: Decimal(str(r["value"])) for r in u_rows}

    # Compute per-run cost
    runs = []
    for row in run_rows:
        total_cost = Decimal("0")
        for pid_col, cnt_col, uid_col in [
            (
                "input_pricing_pricing_id",
                "input_pricing_count",
                "input_pricing_unit_id",
            ),
            (
                "output_pricing_pricing_id",
                "output_pricing_count",
                "output_pricing_unit_id",
            ),
            (
                "cached_pricing_pricing_id",
                "cached_pricing_count",
                "cached_pricing_unit_id",
            ),
        ]:
            pid = row[pid_col]
            cnt = row[cnt_col]
            uid = row[uid_col]
            if pid and cnt and uid:
                price = pricing_map.get(pid, Decimal("0"))
                unit_val = unit_map.get(uid, Decimal("1"))
                if unit_val > 0:
                    total_cost += (Decimal(str(cnt)) / unit_val) * price

        # Get profile_id for this run
        profile_id = await conn.fetchval(
            "SELECT profile_id FROM profiles_runs_connection WHERE run_id = $1 AND active = TRUE LIMIT 1",
            row["run_id"],
        )

        # Get agent/model IDs (first from arrays)
        agent_id = row["agent_ids"][0] if row["agent_ids"] else None
        model_id = row["model_ids"][0] if row["model_ids"] else None

        runs.append(
            {
                "run_id": row["run_id"],
                "created_at": row["run_created_at"],
                "input_tokens": row["input_tokens"] or 0,
                "output_tokens": row["output_tokens"] or 0,
                "cached_input_tokens": row["cached_input_tokens"] or 0,
                "cost": float(total_cost),
                "model_id": model_id,
                "agent_id": agent_id,
                "profile_id": profile_id,
            }
        )

    return runs


async def _fetch_messages_and_calls(
    conn: asyncpg.Connection, run_ids: list[UUID]
) -> tuple[dict[UUID, list[dict[str, Any]]], dict[UUID, list[dict[str, Any]]]]:
    """Fetch messages and calls for runs. Returns (run_messages, orphan_calls_by_run)."""
    # Get messages with content and call_ids
    message_rows = await conn.fetch(
        """
        SELECT
            m.id,
            m.run_id,
            m.role,
            m.created_at,
            COALESCE(
                ARRAY_AGG(sce.content ORDER BY sce.created_at) FILTER (WHERE sce.id IS NOT NULL),
                ARRAY[]::text[]
            ) AS contents,
            COALESCE(
                ARRAY_AGG(DISTINCT sce.call_id) FILTER (WHERE sce.call_id IS NOT NULL),
                ARRAY[]::uuid[]
            ) AS call_ids
        FROM messages_entry m
        LEFT JOIN simulation_contents_entry sce
            ON sce.message_id = m.id AND sce.active = true
        WHERE m.run_id = ANY($1)
          AND m.active = true
        GROUP BY m.id, m.run_id, m.role, m.created_at
        ORDER BY m.run_id,
            CASE m.role
                WHEN 'system' THEN 1
                WHEN 'developer' THEN 2
                WHEN 'user' THEN 3
                WHEN 'assistant' THEN 4
                ELSE 5
            END,
            m.created_at
        """,
        run_ids,
    )

    # Collect linked call_ids
    linked_call_ids: set[UUID] = set()
    for row in message_rows:
        if row["call_ids"]:
            linked_call_ids.update(row["call_ids"])

    # Get ALL calls for these runs
    all_call_rows = await conn.fetch(
        """
        SELECT
            c.id,
            c.run_id,
            c.created_at,
            c.arguments_raw,
            n.name as tool_name
        FROM calls_entry c
        LEFT JOIN tool_calls_junction tcj ON tcj.call_id = c.id
        LEFT JOIN tool_names_junction tn ON tn.tool_id = tcj.tool_id
        LEFT JOIN names_resource n ON n.id = tn.name_id
        WHERE c.run_id = ANY($1)
        """,
        run_ids,
    )

    # Build call details and track orphan calls
    call_details: dict[UUID, dict[str, Any]] = {}
    orphan_calls_by_run: dict[UUID, list[dict[str, Any]]] = {rid: [] for rid in run_ids}
    for row in all_call_rows:
        call_dict = dict(row)
        call_details[row["id"]] = call_dict
        if row["id"] not in linked_call_ids:
            orphan_calls_by_run[row["run_id"]].append(call_dict)

    # Group messages by run
    run_messages: dict[UUID, list[dict[str, Any]]] = {rid: [] for rid in run_ids}
    for row in message_rows:
        run_id = row["run_id"]
        if run_id in run_messages:
            run_messages[run_id].append(
                {
                    "id": row["id"],
                    "role": row["role"],
                    "contents": row["contents"],
                    "call_ids": row["call_ids"],
                    "call_details": call_details,
                }
            )

    return run_messages, orphan_calls_by_run


@router.post(
    "/get",
    response_model=GetGroupDetailResponse,
    dependencies=[audit_activity("group.get", "{{ actor.name }} viewed group detail")],
)
async def get_group(
    request: GetGroupDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupDetailResponse:
    """Get detailed group information with all runs and messages."""
    tags = ["artifacts", "group", "detail"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetGroupDetailResponse.model_validate(cached["data"])

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Resolve actor name
        actor_name = await conn.fetchval(
            """
            SELECT n.name
            FROM profile_names_junction pn
            JOIN names_resource n ON pn.name_id = n.id
            WHERE pn.profile_id = $1
            LIMIT 1
            """,
            profile_id,
        )

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Step 1: Verify group exists via lean MV
        group_view = await get_group_list_view_internal(
            conn=conn,
            group_ids=[request.group_id],
            bypass_cache=bypass_cache,
        )

        if not group_view.items:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        # Step 2: Get runs with computed costs from mv_runs
        run_data = await _fetch_runs_with_cost(conn, request.group_id)

        if not run_data:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. It may be restricted to other departments.",
            )

        run_ids = [r["run_id"] for r in run_data]

        # Step 3: Fetch messages and calls
        run_messages, orphan_calls_by_run = await _fetch_messages_and_calls(
            conn, run_ids
        )

        # Collect name IDs for hydration via naming junctions
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        for r in run_data:
            if r["model_id"]:
                all_model_ids.add(r["model_id"])
            if r["agent_id"]:
                all_agent_ids.add(r["agent_id"])
            if r["profile_id"]:
                all_profile_ids.add(r["profile_id"])

        # Fetch names via junction tables
        model_names: dict[UUID, str] = {}
        agent_names: dict[UUID, str] = {}
        profile_names: dict[UUID, str] = {}

        if all_model_ids:
            rows = await conn.fetch(
                """
                SELECT ma.id, n.name
                FROM model_artifact ma
                JOIN model_names_junction mn ON mn.model_id = ma.id
                JOIN names_resource n ON mn.name_id = n.id
                WHERE ma.id = ANY($1)
                """,
                list(all_model_ids),
            )
            model_names = {r["id"]: r["name"] for r in rows if r["name"]}

        if all_agent_ids:
            rows = await conn.fetch(
                """
                SELECT aa.id, n.name
                FROM agent_artifact aa
                JOIN agent_names_junction an ON an.agent_id = aa.id
                JOIN names_resource n ON an.name_id = n.id
                WHERE aa.id = ANY($1)
                """,
                list(all_agent_ids),
            )
            agent_names = {r["id"]: r["name"] for r in rows if r["name"]}

        if all_profile_ids:
            rows = await conn.fetch(
                """
                SELECT pa.id, n.name
                FROM profile_artifact pa
                JOIN profile_names_junction pn ON pn.profile_id = pa.id
                JOIN names_resource n ON pn.name_id = n.id
                WHERE pa.id = ANY($1)
                """,
                list(all_profile_ids),
            )
            profile_names = {r["id"]: r["name"] for r in rows if r["name"]}

        # Build runs with messages
        runs: list[GroupDetailRunWithMessages] = []
        for r in run_data:
            run_id = r["run_id"]

            run_item = GroupDetailRunItem(
                id=run_id,
                created_at=r["created_at"],
                input_tokens=r["input_tokens"],
                output_tokens=r["output_tokens"],
                cached_input_tokens=r["cached_input_tokens"],
                cost=r["cost"],
                model_id=r["model_id"],
                agent_id=r["agent_id"],
                profile_id=r["profile_id"],
            )

            # Build messages
            messages: list[GroupDetailMessageItem] = []
            for msg in run_messages.get(run_id, []):
                call_details = msg.get("call_details", {})
                msg_calls: list[GroupDetailCallItem] = []
                for call_id in msg.get("call_ids") or []:
                    if call_id in call_details:
                        call = call_details[call_id]
                        msg_calls.append(
                            GroupDetailCallItem(
                                id=call["id"],
                                template_name=call.get("tool_name"),
                                arguments=call["arguments_raw"],
                                created_at=call["created_at"],
                            )
                        )

                contents = [
                    GroupDetailContentItem(content=c) for c in (msg["contents"] or [])
                ]
                if not contents:
                    contents = [GroupDetailContentItem(content=None)]

                messages.append(
                    GroupDetailMessageItem(
                        id=msg["id"],
                        role=msg["role"],
                        contents=contents,
                        calls=msg_calls,
                    )
                )

            # Attach orphan calls to the last message
            orphan_calls = orphan_calls_by_run.get(run_id, [])
            if orphan_calls and messages:
                for call in orphan_calls:
                    messages[-1].calls.append(
                        GroupDetailCallItem(
                            id=call["id"],
                            template_name=call.get("tool_name"),
                            arguments=call["arguments_raw"],
                            created_at=call["created_at"],
                        )
                    )

            runs.append(
                GroupDetailRunWithMessages(
                    run=run_item,
                    messages=messages,
                    previous_context_start_index=None,
                )
            )

        # Build resource arrays
        models = [
            GroupDetailResourceItem(model_id=mid, name=model_names.get(mid))
            for mid in all_model_ids
        ]
        agents = [
            GroupDetailResourceItem(agent_id=aid, name=agent_names.get(aid))
            for aid in all_agent_ids
        ]
        profiles = [
            GroupDetailResourceItem(profile_id=pid, name=profile_names.get(pid))
            for pid in all_profile_ids
        ]

        api_response = GetGroupDetailResponse(
            group_exists=True,
            actor_name=actor_name,
            runs=runs,
            models=models,
            agents=agents,
            profiles=profiles,
        )

        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_group",
            request=http_request,
        )
