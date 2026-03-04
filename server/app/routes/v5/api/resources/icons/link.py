"""Link icons endpoint - records tool call tracking for non-creatable resources."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db
from app.routes.v5.tools.resources.icons.link import (
    LinkIconsSqlParams,
    link_icons_internal,
)
from app.utils.error.handle_route_error import handle_route_error


class LinkIconsApiRequest(BaseModel):
    resource_id: UUID
    group_id: UUID
    tool_id: UUID


class LinkIconsApiResponse(BaseModel):
    success: bool = True
    icon_id: UUID | None = None


router = APIRouter()


@router.post(
    "/icons/link",
    response_model=LinkIconsApiResponse,
)
async def link_icons(
    request: LinkIconsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LinkIconsApiResponse:
    """Record tool call tracking for linking an existing icon resource."""
    sql_params_tuple: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = LinkIconsSqlParams(
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )
            sql_params_tuple = params.to_tuple()

            icon_id = await link_icons_internal(
                conn,
                resource_id=request.resource_id,
                group_id=request.group_id,
                tool_id=request.tool_id,
            )

            return LinkIconsApiResponse(
                success=True,
                icon_id=icon_id,
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="link_icons",
            sql_query=None,
            sql_params=sql_params_tuple,
            request=http_request,
        )
