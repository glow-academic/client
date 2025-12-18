"""Search simulatable profiles endpoint - search profiles that can be emulated."""

import json
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.profile.detail import ProfileItem
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class SearchSimulatableProfilesRequest(BaseModel):
    """Request for simulatable profiles search."""

    query: str | None = (
        None  # Search term (first_name, last_name, email, role). Empty/None returns all profiles (up to limit)
    )
    limit: int = 200  # Maximum number of results
    # profileId removed - comes from X-Profile-Id header


class SearchSimulatableProfilesResponse(BaseModel):
    """Response for simulatable profiles search endpoint."""

    profiles: list[ProfileItem]  # Filtered profiles list (max limit items)


@router.post("/simulatable", response_model=SearchSimulatableProfilesResponse)
async def search_simulatable_profiles(
    request: SearchSimulatableProfilesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulatableProfilesResponse:
    """Search profiles that can be emulated by the requester."""
    tags = ["profile"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SearchSimulatableProfilesResponse.model_validate(cached["data"])

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Load base SQL query
        sql_query = load_sql("sql/v3/profile/search_simulatable_profiles.sql")

        # Build search WHERE clause
        search_where_clause = ""
        params: list[Any] = [profile_id, request.limit]

        # Search query filter (if provided)
        if request.query and request.query.strip():
            search_term = f"%{request.query.strip()}%"
            # Cast role enum to text for ILIKE comparison
            # Also check concatenated full name for queries like "default admin"
            search_where_clause = "AND (p.first_name ILIKE $3 OR p.last_name ILIKE $3 OR EXISTS (SELECT 1 FROM profile_emails pe WHERE pe.profile_id = p.id AND pe.active = true AND pe.email ILIKE $3) OR p.role::text ILIKE $3 OR (p.first_name || ' ' || p.last_name) ILIKE $3)"
            params.append(search_term)

        # Replace placeholder in SQL
        sql_query = sql_query.replace("{search_where_clause}", search_where_clause)

        result = await conn.fetchrow(sql_query, *params)

        if not result:
            # Return empty list if no data
            response_data = SearchSimulatableProfilesResponse(profiles=[])

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

        # Parse profiles JSONB array
        profiles = []
        profiles_data = result.get("profiles")
        if isinstance(profiles_data, str):
            profiles_data = json.loads(profiles_data)
        if profiles_data and isinstance(profiles_data, list):
            for item in profiles_data:
                if isinstance(item, dict):
                    # Helper to convert datetime to ISO string if needed
                    def to_iso_string(val: str | None) -> str:
                        if val is None:
                            return ""
                        return val

                    emails = item.get("emails") or []
                    primary_email = item.get("primary_email")
                    profiles.append(
                        ProfileItem(
                            id=str(item.get("id", "")),
                            firstName=item.get("first_name", ""),
                            lastName=item.get("last_name", ""),
                            emails=emails if isinstance(emails, list) else [],
                            primaryEmail=primary_email,
                            role=item.get("role", ""),
                            active=item.get("active", False),
                            reqPerDay=item.get("req_per_day", 0),
                            lastLogin=to_iso_string(item.get("last_login")),
                            lastActive=to_iso_string(item.get("last_active")),
                            createdAt=to_iso_string(item.get("created_at")),
                            updatedAt=to_iso_string(item.get("updated_at")),
                            primaryDepartmentId=item.get("primary_department_id"),
                        )
                    )

        response_data = SearchSimulatableProfilesResponse(profiles=profiles)

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
            route_path=http_request.url.path,
            operation="search_simulatable_profiles",
            sql_query=sql_query,
            sql_params=params,
            request=http_request,
        )
