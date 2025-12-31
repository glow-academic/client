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

        # Get user role and primary department for default behavior
        user_role = str(result.user_role or "").lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.primary_department_id

        # Set default department_ids based on role
        if is_superadmin:
            default_department_ids = None
        else:
            default_department_ids = (
                [str(primary_department_id)] if primary_department_id else []
            )

        is_default = default_department_ids is None or len(default_department_ids) == 0
        can_edit_default = not (is_default and not is_superadmin)

        # Hardcoded metadata (keep in Python as per original)
        preset_colors_raw = [
            "#EF4444",
            "#F97316",
            "#F59E0B",
            "#10B981",
            "#3B82F6",
            "#6366F1",
            "#8B5CF6",
            "#EC4899",
        ]

        suggested_icons_raw = ["Sparkles", "Zap", "Star", "Heart", "Users"]

        valid_icons_raw = [
            "Activity",
            "Anchor",
            "Award",
            "Bell",
            "Book",
            "Briefcase",
            "Calendar",
            "Camera",
            "ChevronRight",
            "Clock",
            "Cloud",
            "Code",
            "Compass",
            "Database",
            "FileText",
            "Globe",
            "Mail",
            "Mic",
            "Monitor",
            "Phone",
            "Radio",
            "Search",
            "Settings",
            "Shield",
            "Video",
            "Wifi",
        ]

        # Filter colors and icons using server-side utilities
        preset_colors_filtered = filter_colors(preset_colors_raw, color_search)
        suggested_icons = filter_icons(suggested_icons_raw, icon_search)
        valid_icons = filter_icons(valid_icons_raw, icon_search)

        # Get default text agent ID (first valid agent with simulation-text role)
        default_text_agent_id = None
        if result.agents:
            for agent in result.agents:
                if agent.roles and "simulation-text" in agent.roles:
                    default_text_agent_id = str(agent.agent_id)
                    break

        if not default_text_agent_id:
            raise HTTPException(
                status_code=400, detail="No valid simulation-text agents found"
            )

        # Convert SQL result to API response with defaults
        response_data = GetPersonaNewApiResponse.model_validate(
            {
                **result.model_dump(),
                "name": "",
                "description": "",
                "department_ids": default_department_ids,
                "active": True,
                "color": preset_colors_filtered[0]["hex"] if preset_colors_filtered else "#3B82F6",
                "icon": suggested_icons[0] if suggested_icons else "Sparkles",
                "instructions": "",
                "text_agent_id": default_text_agent_id,
                "voice_agent_id": None,
                "in_use": False,
                "scenario_count": 0,
                "can_edit": can_edit_default,
                "can_duplicate": False,
                "can_delete": False,
                "preset_colors": preset_colors_filtered,
                "suggested_icons": suggested_icons,
                "valid_icons": valid_icons,
                "debug_info": [],
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
