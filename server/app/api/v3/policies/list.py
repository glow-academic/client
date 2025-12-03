"""Policies list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class PoliciesFilters(BaseModel):
    """Filters for policies list request."""

    profileId: str


class VideoMappingItem(BaseModel):
    """Video mapping item for facet options."""

    name: str
    description: str
    length_seconds: int | None = None
    active: bool | None = None


class PolicyItem(BaseModel):
    """Individual policy item in the response."""

    policy_id: str
    name: str
    description: str
    upload_id: str | None = None
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str] | None = None
    video_ids: list[str] = []
    video_count: int = 0
    extension: str = ""
    can_edit: bool
    can_delete: bool


class PoliciesListResponse(BaseModel):
    """Response for policies list endpoint."""

    policies: list[PolicyItem]
    department_mapping: DepartmentMapping
    department_options: list[dict[str, str]] = []
    video_mapping: dict[str, VideoMappingItem] = {}
    video_options: list[dict[str, str]] = []
    extension_options: list[dict[str, str]] = []


router = APIRouter()


@router.post("/list", response_model=PoliciesListResponse)
async def get_policies_list(
    filters: PoliciesFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PoliciesListResponse:
    """Get policies list."""
    tags = ["policies"]  # From router tags

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
            return PoliciesListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/policies/list_policies.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Build response - transform database rows
        policies = []
        department_mapping: DepartmentMapping = {}
        video_mapping: dict[str, VideoMappingItem] = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse department mapping from JSONB
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                department_mapping = department_mapping_data

            # Parse video mapping from JSONB
            video_mapping_data = first_row.get("video_mapping")
            if isinstance(video_mapping_data, str):
                video_mapping_data = json.loads(video_mapping_data)
            if video_mapping_data and isinstance(video_mapping_data, dict):
                for vid, vdata in video_mapping_data.items():
                    if isinstance(vdata, dict):
                        video_mapping[vid] = VideoMappingItem(
                            name=vdata.get("name", ""),
                            description=vdata.get("description", ""),
                            length_seconds=vdata.get("length_seconds"),
                            active=vdata.get("active"),
                        )

        # Build policy items
        for row in result:
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            video_ids = []
            if row.get("video_ids"):
                video_ids = [str(vid) for vid in row["video_ids"]]

            extension = row.get("extension") or ""

            policies.append(
                PolicyItem(
                    policy_id=str(row["policy_id"]),
                    name=row["name"],
                    description=row["description"],
                    upload_id=row.get("upload_id"),
                    active=row["active"],
                    created_at=str(row["created_at"]),
                    updated_at=str(row["updated_at"]),
                    department_ids=dept_ids,
                    video_ids=video_ids,
                    video_count=row.get("video_count", 0) or 0,
                    extension=extension,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Build facet options
        # Video options from video_mapping
        video_options = [
            {"value": vid, "label": v.name or vid}
            for (vid, v) in video_mapping.items()
        ]

        # Extension options from actual extensions used
        used_extensions = {p.extension for p in policies if p.extension}
        extension_options = [
            {"value": ext, "label": ext.upper()}
            for ext in sorted(used_extensions)
        ]

        # Department options from department_mapping
        department_options = [
            {"value": did, "label": d.get("name", did) if isinstance(d, dict) else did}
            for (did, d) in department_mapping.items()
        ]

        response_data = PoliciesListResponse(
            policies=policies,
            department_mapping=department_mapping,
            department_options=department_options,
            video_mapping=video_mapping,
            video_options=video_options,
            extension_options=extension_options,
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
            operation="get_policies_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

