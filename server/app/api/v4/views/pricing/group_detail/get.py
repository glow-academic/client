"""Get endpoint for pricing group detail view.

Fetches run metadata from mv_pricing_run_facts and messages from
messages_entry + simulation_contents_entry.
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
    ordered by role (system, developer, user, assistant) then created_at.
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

    # Step 3: Get all messages for these runs with content
    # Simple approach: fetch all messages per run, ordered by role then created_at
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
            ) AS contents
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

    # Step 4: Group messages by run and build response
    run_messages: dict[UUID, list[dict[str, Any]]] = {rid: [] for rid in run_ids}
    for row in message_rows:
        run_id = row["run_id"]
        if run_id in run_messages:
            run_messages[run_id].append(dict(row))

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
            contents = [
                GroupDetailContent(content=c) for c in (msg["contents"] or [])
            ]
            # If no simulation contents, use empty content
            if not contents:
                contents = [GroupDetailContent(content=None)]

            messages.append(
                GroupDetailMessage(
                    id=msg["id"],
                    role=msg["role"],
                    contents=contents,
                    run_idx=run_idx,  # Message belongs to current run
                )
            )

        # Step 5: previous_context_start_index is not needed since each run
        # only shows its own messages (no context from previous runs)
        previous_context_start_index: int | None = None

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
