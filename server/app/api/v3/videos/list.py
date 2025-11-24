"""Videos list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class VideosFilters(BaseModel):
    """Filters for videos list request."""

    profileId: str


class VideoItem(BaseModel):
    """Individual video item in the response."""

    video_id: str
    name: str
    length_seconds: int
    active: bool
    department_ids: list[str] | None  # None = cross-department (all departments)
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    updated_at: str


class VideosListResponse(BaseModel):
    """Response for videos list endpoint."""

    videos: list[VideoItem]
    department_mapping: DepartmentMapping
    # UI-ready facet options (precomputed on server)
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post("/list", response_model=VideosListResponse)
async def get_videos_list(
    filters: VideosFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VideosListResponse:
    """Get videos list with all relationships."""
    tags = ["videos"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return VideosListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/videos/list_videos.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Build response - transform database rows
        videos = []
        department_mapping: DepartmentMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse department_mapping from JSONB
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for did, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Build video items
        for row in result:
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            videos.append(
                VideoItem(
                    video_id=str(row["video_id"]),
                    name=row["name"],
                    length_seconds=row["length_seconds"],
                    active=row["active"],
                    department_ids=dept_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    updated_at=str(row["updated_at"]),
                )
            )

        # Build facet options
        # Collect all department IDs actually assigned to videos
        assigned_department_ids = set()
        for video in videos:
            if video.department_ids:
                assigned_department_ids.update(video.department_ids)
        # Filter department_options to only include departments assigned to at least one video
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        ]

        response_data = VideosListResponse(
            videos=videos,
            department_mapping=department_mapping,
            department_options=department_options,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_videos_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

