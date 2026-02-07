"""Group list endpoint - POST /artifacts/group/list.

Imports from views/pricing/group_summary internal function and adds
resource hydration (agent names, model names).
"""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.types import (
    GetGroupListRequest,
    GetGroupListResponse,
    GroupListItem,
)
from app.api.v4.views.pricing.group_summary.get import (
    get_pricing_group_summary_internal,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _fetch_names_by_ids(
    conn: asyncpg.Connection,
    table: str,
    id_column: str,
    name_junction: str,
    ids: list[UUID],
) -> dict[UUID, str]:
    """Fetch names for artifact IDs via naming junction tables."""
    if not ids:
        return {}
    rows = await conn.fetch(
        f"""
        SELECT a.id, n.name
        FROM {table} a
        JOIN {name_junction} an ON an.{id_column} = a.id
        JOIN names_resource n ON an.name_id = n.id
        WHERE a.id = ANY($1)
        """,
        ids,
    )
    return {row["id"]: row["name"] for row in rows if row["name"]}


async def get_group_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetGroupListRequest,
    actor_name: str | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v4/artifacts/group/list",
) -> GetGroupListResponse:
    """Internal function for group list with resource hydration."""
    body = request.model_dump(mode="json")
    # Note: profile_id not included in cache key - data is shared across all users
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGroupListResponse.model_validate(cached["data"])

    # Fetch from views layer (no profile_id filter - show all users for analytics)
    view_result = await get_pricing_group_summary_internal(
        conn=conn,
        session_id=request.session_id,
        agent_id=request.agent_id,
        model_id=request.model_id,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    # Collect all IDs for hydration
    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()
    for item in view_result.items:
        if item.agent_ids:
            all_agent_ids.update(item.agent_ids)
        if item.model_ids:
            all_model_ids.update(item.model_ids)
        if item.profile_id:
            all_profile_ids.add(item.profile_id)

    # Fetch names via junction tables
    agent_meta = await _fetch_names_by_ids(
        conn, "agent_artifact", "agent_id", "agent_names_junction", list(all_agent_ids)
    )
    model_meta = await _fetch_names_by_ids(
        conn, "model_artifact", "model_id", "model_names_junction", list(all_model_ids)
    )
    profile_meta = await _fetch_names_by_ids(
        conn,
        "profile_artifact",
        "profile_id",
        "profile_names_junction",
        list(all_profile_ids),
    )

    # Transform view items to artifact items with hydration
    items = []
    for view_item in view_result.items:
        agent_names = None
        if view_item.agent_ids:
            agent_names = [
                agent_meta[aid] for aid in view_item.agent_ids if aid in agent_meta
            ]
            agent_names = agent_names if agent_names else None

        model_names = None
        if view_item.model_ids:
            model_names = [
                model_meta[mid] for mid in view_item.model_ids if mid in model_meta
            ]
            model_names = model_names if model_names else None

        profile_name = (
            profile_meta.get(view_item.profile_id) if view_item.profile_id else None
        )

        items.append(
            GroupListItem(
                group_id=view_item.group_id,
                session_id=view_item.session_id,
                profile_id=view_item.profile_id,
                group_name=view_item.group_name,
                trace_id=view_item.trace_id,
                first_run_at=view_item.first_run_at,
                last_run_at=view_item.last_run_at,
                run_count=view_item.run_count,
                unique_agents=view_item.unique_agents,
                unique_models=view_item.unique_models,
                total_input_tokens=view_item.total_input_tokens,
                total_output_tokens=view_item.total_output_tokens,
                total_tokens=view_item.total_tokens,
                total_cost=view_item.total_cost,
                agent_ids=view_item.agent_ids,
                model_ids=view_item.model_ids,
                profile_name=profile_name,
                agent_names=agent_names,
                model_names=model_names,
            )
        )

    api_response = GetGroupListResponse(
        actor_name=actor_name,
        items=items,
        total_count=view_result.total_count,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "group", "list"],
    )

    return api_response


@router.post(
    "/list",
    response_model=GetGroupListResponse,
    dependencies=[
        audit_activity("artifacts.group.list", "{{ actor.name }} fetched group list")
    ],
)
async def list_groups(
    request: GetGroupListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupListResponse:
    """Get paginated group list with resource hydration."""
    tags = ["artifacts", "group", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Get actor name for audit
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

        result = await get_group_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=request,
            actor_name=actor_name,
            bypass_cache=bypass_cache,
            cache_key_path=http_request.url.path,
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
            operation="artifacts_group_list",
            request=http_request,
        )
