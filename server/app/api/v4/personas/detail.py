"""Persona detail endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPersonaDetailApiRequest,
    GetPersonaDetailApiResponse,
    GetPersonaDetailSqlParams,
    GetPersonaDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/personas/get_persona_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetPersonaDetailApiResponse,
    dependencies=[
        audit_activity(
            "persona.viewed", "{{ actor.name }} viewed persona '{{ persona.name }}'"
        )
    ],
)
async def get_persona_detail(
    request: GetPersonaDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaDetailApiResponse:
    """Get detailed persona information."""
    tags = ["personas"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetPersonaDetailApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Extract search and filter params from API request
        color_search = request.color_search
        icon_search = request.icon_search
        color_show_selected = request.color_show_selected
        icon_show_selected = request.icon_show_selected
        current_color = request.current_color
        current_icon = request.current_icon
        draft_id = getattr(request, "draft_id", None)

        # Convert API request to SQL params (add profile_id from header)
        params = GetPersonaDetailSqlParams(
            persona_id=request.persona_id,
            profile_id=profile_id,
            color_search=color_search,
            icon_search=icon_search,
            color_show_selected=color_show_selected,
            icon_show_selected=icon_show_selected,
            current_color=current_color,
            current_icon=current_icon,
            draft_id=draft_id,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetPersonaDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if persona exists and has access using SQL result
        if not result.persona_exists:
            raise HTTPException(
                status_code=404, detail=f"Persona {request.persona_id} not found"
            )

        if not result.name:
            # Persona exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this persona. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                persona={"name": result.name, "id": str(request.persona_id)},
            )

        # Convert SQL result to API response
        # Note: preset_colors, suggested_icons, valid_icons now come from SQL (filtered server-side)
        response_data = GetPersonaDetailApiResponse.model_validate(
            {
                **result.model_dump(),
                "debug_info": [],  # Empty for now
            }
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
