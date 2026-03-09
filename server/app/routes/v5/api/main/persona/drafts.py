"""Persona drafts list endpoint — returns all drafts owned by the current profile."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool
from app.routes.v5.tools.entries.persona_drafts.search import search_persona_drafts
from app.routes.v5.tools.entries.persona_drafts.types import GetPersonaDraftResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class GetPersonaDraftsApiResponse(BaseModel):
    entries: list[GetPersonaDraftResponse] | None = None


@router.post("/drafts", response_model=GetPersonaDraftsApiResponse)
async def get_persona_drafts(
    http_request: Request,
    response: Response,
) -> GetPersonaDraftsApiResponse:
    """List persona drafts owned by the current profile."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()

        # Resolve profile_id → profiles_id (resource ID) via junction
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT profiles_id
                   FROM profile_profiles_junction
                   WHERE profile_id = $1""",
                UUID(profile_id),
            )

        if not row:
            return GetPersonaDraftsApiResponse(entries=[])

        profiles_id: UUID = row["profiles_id"]

        # Search drafts filtered by ownership
        async with pool.acquire() as conn:
            entries = await search_persona_drafts(
                conn,
                profile_ids=[profiles_id],
            )

        response.headers["X-Cache-Tags"] = "personas,drafts"
        return GetPersonaDraftsApiResponse(entries=entries)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona_drafts",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
