"""Persona get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (persona_id = NULL) and detail (persona_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetPersonaApiRequest, GetPersonaApiResponse,
                           GetPersonaSqlParams, GetPersonaSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/personas/get_persona_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetPersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.get",
            "{{ actor.name }} {% if persona %}viewed{% else %}opened new{% endif %} persona{% if persona %} '{{ persona.name }}'{% endif %}"
        )
    ],
)
async def get_persona(
    request: GetPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPersonaApiResponse:
    """Get persona information - handles both new (persona_id = NULL) and detail (persona_id provided)."""
    tags = ["personas"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetPersonaApiResponse.model_validate(cached["data"])

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
        draft_id = request.draft_id
        persona_id = request.persona_id  # Can be NULL for new mode

        # Convert API request to SQL params (add profile_id from header)
        params = GetPersonaSqlParams(
            persona_id=persona_id,
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

        # Execute SQL with typed helper
        result = cast(
            GetPersonaSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {
                "actor": {"name": result.actor_name, "id": profile_id}
            }
            # Only add persona to audit context if persona_id was provided (detail mode)
            if persona_id and result.name_resource and result.name_resource.name:
                audit_ctx["persona"] = {
                    "name": result.name_resource.name,
                    "id": str(persona_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if persona_id is None:
            # New mode: check for valid departments
            if not result.valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if persona exists and has access
            if result.persona_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Persona {persona_id} not found"
                )

            if not result.name_resource or not result.name_resource.name:
                # Persona exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this persona. It may be restricted to other departments.",
                )

        # Convert SQL result to API response
        response_data = GetPersonaApiResponse.model_validate(
            {
                **result.model_dump(),
                "debug_info": [],  # Empty for now (only used in detail mode)
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
            operation="get_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
