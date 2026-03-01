"""POST /auth/page — server-driven routing metadata endpoint."""

from __future__ import annotations

import time
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.access import get_access_internal
from app.api.v4.auth.route_permissions import (
    compute_available_routes,
    compute_available_sections,
    compute_breadcrumbs,
    compute_page_access,
    compute_page_metadata,
    compute_sidebar_routes,
    get_entity_name_direct,
    get_entity_name_junction,
)
from app.api.v4.auth.types import GetAuthPageApiResponse
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import GetProfileContextApiRequest

router = APIRouter()


@router.post("/page", response_model=GetAuthPageApiResponse)
async def get_auth_page(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthPageApiResponse:
    """Server-driven routing metadata endpoint."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        pathname = http_request.headers.get("X-Pathname", "")

        pass1_start = time.time()
        access = await get_access_internal(conn, profile_id, bypass_cache)
        pass1_time = (time.time() - pass1_start) * 1000

        # Pure computation — no SQL in Pass 2
        pass2_start = time.time()

        user_artifacts = access.artifacts or []
        available_sections = compute_available_sections(user_artifacts)
        available_routes = compute_available_routes(user_artifacts)

        sidebar_routes = compute_sidebar_routes(available_sections)
        breadcrumbs = compute_breadcrumbs(pathname) if pathname else []
        page_access = (
            compute_page_access(pathname, available_routes, available_sections)
            if pathname
            else None
        )
        page_metadata = (
            compute_page_metadata(pathname, available_routes) if pathname else None
        )

        # Resolve entity name for breadcrumbs if pathname has a UUID
        if pathname and breadcrumbs:
            entity_direct = get_entity_name_direct(pathname)
            entity_info = get_entity_name_junction(pathname)

            try:
                pool = get_pool()
                if pool:
                    async with pool.acquire() as c:
                        entity_name: str | None = None

                        if entity_direct:
                            # Direct denormalized name (e.g. attempt_entry.name)
                            entity_id, table, column = entity_direct
                            row = await c.fetchrow(
                                f"SELECT {column}, practice FROM {table} "  # noqa: S608
                                f"WHERE id = $1::uuid LIMIT 1",
                                UUID(entity_id),
                            )
                            if row:
                                entity_name = row[column]
                                # Override section based on practice flag
                                if row["practice"] and breadcrumbs:
                                    breadcrumbs[0].section = "practice"
                                    breadcrumbs[0].url = "/practice"
                                    breadcrumbs[0].title = "Practice"
                        elif entity_info:
                            # Junction-based name (e.g. persona_names_junction)
                            entity_id, _entity_type, name_junction = entity_info
                            entity_name = await c.fetchval(
                                f"SELECT nr.name FROM {name_junction} nj "  # noqa: S608
                                f"JOIN names_resource nr ON nr.id = nj.name_id "
                                f"WHERE nj.parent_id = $1::uuid "
                                f"AND nj.active = true LIMIT 1",
                                UUID(entity_id),
                            )

                        if entity_name:
                            for bc in breadcrumbs:
                                if bc.url and entity_id in bc.url and "..." in bc.title:
                                    bc.title = entity_name
            except Exception:
                pass  # Graceful fallback — keep truncated UUID

        pass2_time = (time.time() - pass2_start) * 1000

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"
        response.headers["X-Pass2-Time"] = f"{pass2_time:.1f}"

        return GetAuthPageApiResponse(
            sidebar_routes=sidebar_routes,
            breadcrumbs=breadcrumbs if breadcrumbs else None,
            page_access=page_access,
            page_metadata=page_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_page",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
