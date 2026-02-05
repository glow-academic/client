"""Group artifact endpoint - POST /artifacts/group/get

Uses views-layer internal function and hydrates resource names.
"""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.types import (
    GetGroupDetailRequest,
    GetGroupDetailResponse,
    GroupDetailContentItem,
    GroupDetailMessageItem,
    GroupDetailResourceItem,
    GroupDetailRunItem,
    GroupDetailRunWithMessages,
)
from app.api.v4.views.pricing.group_detail.get import get_pricing_group_detail_internal
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

        # Call views-layer internal
        view_result = await get_pricing_group_detail_internal(
            conn=conn,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        if not view_result.group_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        if not view_result.runs:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. It may be restricted to other departments.",
            )

        # Collect unique resource IDs from runs
        all_model_ids: set[UUID] = set()
        all_agent_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        for run_with_msgs in view_result.runs:
            if run_with_msgs.run.model_id:
                all_model_ids.add(run_with_msgs.run.model_id)
            if run_with_msgs.run.agent_id:
                all_agent_ids.add(run_with_msgs.run.agent_id)
            if run_with_msgs.run.profile_id:
                all_profile_ids.add(run_with_msgs.run.profile_id)

        # Hydrate resource names
        model_names = await _fetch_names_by_ids(
            conn, "model_artifact", "model_id", "model_names_junction", list(all_model_ids)
        )
        agent_names = await _fetch_names_by_ids(
            conn, "agent_artifact", "agent_id", "agent_names_junction", list(all_agent_ids)
        )
        profile_names = await _fetch_names_by_ids(
            conn, "profile_artifact", "profile_id", "profile_names_junction", list(all_profile_ids)
        )

        # Build runs with artifact-layer types
        runs: list[GroupDetailRunWithMessages] = []
        for view_run in view_result.runs:
            run_item = GroupDetailRunItem(
                id=view_run.run.id,
                created_at=view_run.run.created_at,
                input_tokens=view_run.run.input_tokens,
                output_tokens=view_run.run.output_tokens,
                cached_input_tokens=view_run.run.cached_input_tokens,
                cost=view_run.run.cost,
                model_id=view_run.run.model_id,
                agent_id=view_run.run.agent_id,
                profile_id=view_run.run.profile_id,
            )

            messages: list[GroupDetailMessageItem] = []
            for view_msg in view_run.messages:
                messages.append(
                    GroupDetailMessageItem(
                        id=view_msg.id,
                        role=view_msg.role,
                        contents=[
                            GroupDetailContentItem(content=c.content)
                            for c in view_msg.contents
                        ],
                    )
                )

            runs.append(
                GroupDetailRunWithMessages(
                    run=run_item,
                    messages=messages,
                    previous_context_start_index=view_run.previous_context_start_index,
                )
            )

        # Build resource arrays
        models = [
            GroupDetailResourceItem(model_id=mid, name=name)
            for mid, name in model_names.items()
        ]
        agents = [
            GroupDetailResourceItem(agent_id=aid, name=name)
            for aid, name in agent_names.items()
        ]
        profiles = [
            GroupDetailResourceItem(profile_id=pid, name=name)
            for pid, name in profile_names.items()
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
