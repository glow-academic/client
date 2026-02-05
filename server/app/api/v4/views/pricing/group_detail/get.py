"""Get endpoint for pricing group detail view.

Fetches run metadata from mv_pricing_run_facts and messages from
messages_entry + simulation_contents_entry with tree ordering.
"""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v4.views.pricing.group_detail.types import (
    GetGroupDetailResponse,
    GroupDetailContent,
    GroupDetailMessage,
    GroupDetailRunMetadata,
    GroupDetailRunWithMessages,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


class GetGroupDetailRequest(BaseModel):
    """Request for group detail view endpoint."""

    group_id: UUID


async def get_pricing_group_detail_internal(
    conn: asyncpg.Connection,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetGroupDetailResponse:
    """Internal function for fetching group detail with messages.

    Returns run metadata from mv_pricing_run_facts and messages
    ordered by message tree traversal.
    """
    cache_key_val = cache_key(
        "views/pricing/group_detail/get",
        {"group_id": str(group_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGroupDetailResponse.model_validate(cached)

    # Step 1: Check group exists
    group_exists = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM groups_entry WHERE id = $1)",
        group_id,
    )
    if not group_exists:
        return GetGroupDetailResponse(group_exists=False)

    # Step 2: Get runs from MV, ordered by creation time
    run_rows = await conn.fetch(
        """
        SELECT
            run_id, group_id, agent_id, model_id, profile_id,
            input_tokens, output_tokens, cached_input_tokens,
            total_cost, run_created_at
        FROM mv_pricing_run_facts
        WHERE group_id = $1
        ORDER BY run_created_at
        """,
        group_id,
    )

    if not run_rows:
        return GetGroupDetailResponse(group_exists=True)

    run_ids = [row["run_id"] for row in run_rows]
    # Map run_id -> index in chronological order (run_idx)
    run_id_to_idx: dict[UUID, int] = {rid: idx for idx, rid in enumerate(run_ids)}

    # Step 3: Get all messages for these runs with content via tree traversal
    # Uses recursive CTE to walk ancestor chain from each run's latest message
    message_rows = await conn.fetch(
        """
        WITH RECURSIVE
        -- Find the latest user/assistant message per run (entry point for tree walk)
        latest_per_run AS (
            SELECT DISTINCT ON (m.run_id)
                m.id AS message_id,
                m.run_id
            FROM messages_entry m
            WHERE m.run_id = ANY($1)
              AND m.role IN ('user', 'assistant')
              AND m.active = true
            ORDER BY m.run_id, m.created_at DESC
        ),
        -- Recursive ancestor walk from each run's latest message
        ancestor_path AS (
            -- Base: the latest message itself
            SELECT
                m.id,
                lpr.run_id AS origin_run_id,
                m.run_id AS msg_run_id,
                m.role,
                m.created_at,
                0 AS depth_from_latest
            FROM latest_per_run lpr
            JOIN messages_entry m ON m.id = lpr.message_id

            UNION ALL

            -- Recursive: walk up parent links
            SELECT
                parent_msg.id,
                ap.origin_run_id,
                parent_msg.run_id AS msg_run_id,
                parent_msg.role,
                parent_msg.created_at,
                ap.depth_from_latest + 1
            FROM ancestor_path ap
            JOIN simulation_message_tree_entry mt
                ON mt.child_id = ap.id AND mt.active = true
            JOIN messages_entry parent_msg
                ON parent_msg.id = mt.parent_id AND parent_msg.active = true
            WHERE ap.depth_from_latest < 100
        ),
        -- Also include system/developer messages from the first run
        -- for all subsequent runs (they won't be in the ancestor chain)
        first_run_system_msgs AS (
            SELECT
                m.id,
                target_run.run_id AS origin_run_id,
                m.run_id AS msg_run_id,
                m.role,
                m.created_at,
                999 AS depth_from_latest
            FROM messages_entry m
            CROSS JOIN LATERAL (
                SELECT unnest($1::uuid[]) AS run_id
            ) target_run
            WHERE m.run_id = $2
              AND m.role IN ('system', 'developer')
              AND m.active = true
              AND target_run.run_id != $2
        ),
        -- Combine and deduplicate (DISTINCT ON handles duplicates
        -- where ancestor_path already found a system/dev message)
        all_msgs AS (
            SELECT DISTINCT ON (origin_run_id, id)
                id, origin_run_id, msg_run_id, role, created_at, depth_from_latest
            FROM (
                SELECT * FROM ancestor_path
                UNION ALL
                SELECT * FROM first_run_system_msgs
            ) combined
            ORDER BY origin_run_id, id, depth_from_latest ASC
        ),
        -- Attach content from simulation_contents_entry
        msgs_with_content AS (
            SELECT
                am.id,
                am.origin_run_id,
                am.msg_run_id,
                am.role,
                am.created_at,
                am.depth_from_latest,
                COALESCE(
                    ARRAY_AGG(sce.content ORDER BY sce.created_at) FILTER (WHERE sce.id IS NOT NULL),
                    ARRAY[]::text[]
                ) AS contents
            FROM all_msgs am
            LEFT JOIN simulation_contents_entry sce
                ON sce.message_id = am.id AND sce.active = true
            GROUP BY am.id, am.origin_run_id, am.msg_run_id, am.role, am.created_at, am.depth_from_latest
        )
        SELECT
            id,
            origin_run_id,
            msg_run_id,
            role,
            created_at,
            depth_from_latest,
            contents
        FROM msgs_with_content
        ORDER BY origin_run_id, depth_from_latest DESC, created_at
        """,
        run_ids,
        run_ids[0],  # first run ID for system/developer messages
    )

    # Step 4: Group messages by run and build response
    run_messages: dict[UUID, list[dict[str, Any]]] = {rid: [] for rid in run_ids}
    for row in message_rows:
        origin_run_id = row["origin_run_id"]
        if origin_run_id in run_messages:
            run_messages[origin_run_id].append(dict(row))

    runs: list[GroupDetailRunWithMessages] = []
    for run_row in run_rows:
        run_id = run_row["run_id"]
        run_idx = run_id_to_idx[run_id]

        # Build run metadata
        run_meta = GroupDetailRunMetadata(
            id=run_id,
            created_at=run_row["run_created_at"],
            input_tokens=run_row["input_tokens"] or 0,
            output_tokens=run_row["output_tokens"] or 0,
            cached_input_tokens=run_row["cached_input_tokens"] or 0,
            cost=float(run_row["total_cost"]) if run_row["total_cost"] else 0,
            model_id=run_row["model_id"],
            agent_id=run_row["agent_id"],
            profile_id=run_row["profile_id"],
        )

        # Build messages list
        messages: list[GroupDetailMessage] = []
        for msg in run_messages.get(run_id, []):
            msg_run_id = msg["msg_run_id"]
            msg_run_idx = run_id_to_idx.get(msg_run_id, 0)

            contents = [
                GroupDetailContent(content=c) for c in (msg["contents"] or [])
            ]
            # If no simulation contents, try text_id fallback
            if not contents:
                contents = [GroupDetailContent(content=None)]

            messages.append(
                GroupDetailMessage(
                    id=msg["id"],
                    role=msg["role"],
                    contents=contents,
                    run_idx=msg_run_idx,
                )
            )

        # Step 5: Calculate previous_context_start_index
        previous_context_start_index: int | None = None
        if run_idx > 0 and messages:
            for i, m in enumerate(messages):
                if m.run_idx == run_idx:
                    previous_context_start_index = i
                    break

        runs.append(
            GroupDetailRunWithMessages(
                run=run_meta,
                messages=messages,
                previous_context_start_index=previous_context_start_index,
            )
        )

    response = GetGroupDetailResponse(group_exists=True, runs=runs)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=300,
        tags=["views", "pricing", "group_detail"],
    )

    return response


@router.post(
    "/get",
    response_model=GetGroupDetailResponse,
    dependencies=[
        audit_activity(
            "views.pricing.group_detail.get",
            "{{ actor.name }} fetched pricing group detail data",
        )
    ],
)
async def get_pricing_group_detail(
    request: GetGroupDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupDetailResponse:
    """Get pricing group detail data with messages."""
    tags = ["views", "pricing", "group_detail"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_pricing_group_detail_internal(
            conn=conn,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_pricing_group_detail_get",
            request=http_request,
        )
