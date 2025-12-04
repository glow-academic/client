"""Profile by email endpoint - get profile by email."""

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.api.v3.profile.detail import ProfileDetailResponse, ProfileItem
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class ProfileByEmailRequest(BaseModel):
    """Request to get profile by email."""

    email: str


@router.post("/by-email", response_model=ProfileDetailResponse)
async def get_profile_by_email(
    request: ProfileByEmailRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Get profile by email (for auth operations)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/profile/get_profile_by_email.sql")
        sql_params = (request.email,)

        # Execute
        row = await conn.fetchrow(sql_query, request.email)
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Transform database row to response
        emails = row.get("emails") or []
        primary_email = row.get("primary_email")
        profile = ProfileItem(
            id=str(row["id"]),
            firstName=row["first_name"],
            lastName=row["last_name"],
            emails=emails if isinstance(emails, list) else [],
            primaryEmail=primary_email,
            role=row["role"],
            active=row["active"],
            reqPerDay=row["req_per_day"],
            lastLogin=row["last_login"].isoformat() if row["last_login"] else "",
            lastActive=row["last_active"].isoformat() if row["last_active"] else None,
            createdAt=row["created_at"].isoformat() if row["created_at"] else "",
            updatedAt=row["updated_at"].isoformat() if row["updated_at"] else "",
            primaryDepartmentId=str(row["primary_department_id"])
            if row.get("primary_department_id")
            else None,
        )

        return ProfileDetailResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_by_email",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
