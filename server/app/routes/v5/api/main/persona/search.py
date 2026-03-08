"""Persona search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.persona_search.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db, get_redis_client
from app.infra.persona_search import search_persona_client
from app.routes.v5.api.main.persona.types import ListPersonaApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchPersonaApiRequest(BaseModel):
    """Request model for persona search endpoint."""

    # Main filters
    search: str | None = None
    scenario_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    # Facet search text
    scenario_search: str | None = None
    field_search: str | None = None
    department_search: str | None = None
    color_search: str | None = None
    icon_search: str | None = None
    voice_search: str | None = None
    instruction_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/search", response_model=ListPersonaApiResponse)
async def search_persona(
    request: SearchPersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListPersonaApiResponse:
    """Search personas — composable infra architecture."""
    tags = ["personas"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_persona_client(
            conn,
            redis,
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=request.scenario_search,
            field_search=request.field_search,
            department_search=request.department_search,
            color_search=request.color_search,
            icon_search=request.icon_search,
            voice_search=request.voice_search,
            instruction_search=request.instruction_search,
            page_size=request.page_size or 12,
            page_offset=request.page_offset or 0,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_persona",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
