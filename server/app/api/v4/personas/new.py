"""Persona new endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetPersonaNewApiRequest, GetPersonaNewApiResponse,
                           GetPersonaNewSqlParams, GetPersonaNewSqlRow,
                           load_sql_query)
from app.utils.color_utils import filter_colors, filter_icons
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/personas/get_persona_new_complete.sql"


router = APIRouter()


@router.post(
    "/new",
    response_model=GetPersonaNewApiResponse,
    dependencies=[
        audit_activity("persona.new", "{{ actor.name }} opened new persona form")
    ],
)
async def get_persona_new(
    request: GetPersonaNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaNewApiResponse:
    """Get default persona structure for creation mode."""
    tags = ["personas"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetPersonaNewApiResponse.model_validate(cached["data"])

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

        # Extract search params from API request
        color_search = request.color_search
        icon_search = request.icon_search

        # Convert API request to SQL params (add profile_id from header)
        params = GetPersonaNewSqlParams(
            profile_id=profile_id,
            color_search=color_search,
            icon_search=icon_search,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetPersonaNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        if not result.valid_department_ids:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

        # Get preset colors, icons from SQL result
        # preset_colors is list[QGetPersonaNewV4Color] (Pydantic models from composite type)
        preset_colors_from_sql = result.preset_colors or []
        suggested_icons_from_sql = result.suggested_icons or []
        valid_icons_from_sql = result.valid_icons or []

        # Convert Pydantic color models to dicts for easier manipulation
        preset_colors_dicts = [
            {"hex": color.hex or "", "name": color.name or ""}
            for color in preset_colors_from_sql
        ]

        # Filter colors and icons using server-side utilities if search params provided
        if color_search:
            # Extract hex values for filtering
            preset_colors_hex_list = [color["hex"] for color in preset_colors_dicts if color.get("hex")]
            preset_colors_filtered = filter_colors(preset_colors_hex_list, color_search)
        else:
            # No filtering needed, use colors from SQL
            preset_colors_filtered = preset_colors_dicts

        if icon_search:
            suggested_icons = filter_icons(suggested_icons_from_sql, icon_search)
            valid_icons = filter_icons(valid_icons_from_sql, icon_search)
        else:
            # No filtering needed, use icons from SQL
            suggested_icons = suggested_icons_from_sql
            valid_icons = valid_icons_from_sql

        # Convert SQL result to API response (all fields now come from SQL)
        response_data = GetPersonaNewApiResponse.model_validate(
            {
                **result.model_dump(),
                "preset_colors": preset_colors_filtered,
                "suggested_icons": suggested_icons,
                "valid_icons": valid_icons,
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
            operation="get_persona_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
