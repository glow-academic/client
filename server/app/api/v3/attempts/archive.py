"""Attempts bulk archive endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Filter schema for bulk archive (subset of DashboardHistoryFilters, without pagination/sorting)
class BulkArchiveFilters(BaseModel):
    """Filter schema for bulk archive operations."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    departmentIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[str] | None = None  # ["general", "practice", "archived"]
    profileId: str | None = None
    search: str | None = None
    profileIds: list[str] | None = None
    simulationIds: list[str] | None = None
    scenarioIds: list[str] | None = None
    infiniteMode: bool | None = None


# Inline request/response schemas
class BulkArchiveAttemptsRequest(BaseModel):
    archived: bool
    attemptIds: list[str] | None = None  # Optional: used when archiveAll is False
    archiveAll: bool = False  # When True, use filters instead of attemptIds
    filters: BulkArchiveFilters | None = None  # Optional: used when archiveAll is True


class BulkArchiveAttemptsResponse(BaseModel):
    success: bool
    message: str
    count: int


router = APIRouter()


@router.post("/archive", response_model=BulkArchiveAttemptsResponse)
async def bulk_archive_attempts(
    request: BulkArchiveAttemptsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkArchiveAttemptsResponse:
    """Bulk archive or unarchive simulation attempts."""
    tags = ["attempts"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Determine which operation mode to use
        if request.archiveAll and request.filters:
            # Filter-based bulk archive: archive all attempts matching filters
            if not request.filters.startDate or not request.filters.endDate:
                raise HTTPException(
                    status_code=400,
                    detail="startDate and endDate are required when using filter-based archive",
                )

            from datetime import datetime

            sql_query = load_sql("sql/v3/attempts/bulk_archive_attempts_by_filters.sql")

            # Build parameters matching SQL file expectations:
            # $1: archived (bool)
            # $2, $3: start_date, end_date (datetime)
            # $4: profile_id (uuid, optional)
            # $5: cohort_ids (uuid[])
            # $6: department_ids (uuid[])
            # $7: roles (profile_role[])
            # $8: simulationFilters (text[], optional)
            # $9: search (text, optional)
            # $10: profileIds filter (uuid[], optional)
            # $11: simulationIds filter (uuid[], optional)
            # $12: scenarioIds filter (uuid[], optional)
            # $13: infiniteMode filter (bool, optional)

            roles = request.filters.roles if request.filters.roles else []
            simulation_filters = (
                request.filters.simulationFilters
                if request.filters.simulationFilters
                else ["general"]
            )

            sql_params = (
                request.archived,  # $1
                datetime.fromisoformat(
                    request.filters.startDate.replace("Z", "+00:00")
                ),  # $2
                datetime.fromisoformat(
                    request.filters.endDate.replace("Z", "+00:00")
                ),  # $3
                request.filters.profileId if request.filters.profileId else None,  # $4
                request.filters.cohortIds if request.filters.cohortIds else [],  # $5
                request.filters.departmentIds
                if request.filters.departmentIds
                else [],  # $6
                roles,  # $7
                simulation_filters,  # $8
                request.filters.search if request.filters.search else None,  # $9
                request.filters.profileIds if request.filters.profileIds else [],  # $10
                request.filters.simulationIds
                if request.filters.simulationIds
                else [],  # $11
                request.filters.scenarioIds
                if request.filters.scenarioIds
                else [],  # $12
                request.filters.infiniteMode,  # $13 (can be None)
            )
            result = await conn.fetchrow(sql_query, *sql_params)
        elif request.attemptIds:
            # AttemptIds-based bulk archive: archive specific attempts (backward compatible)
            sql_query = load_sql("sql/v3/attempts/bulk_archive_attempts_complete.sql")
            sql_params = (request.archived, request.attemptIds)
            result = await conn.fetchrow(
                sql_query, request.archived, request.attemptIds
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Either attemptIds must be provided, or archiveAll=true with filters must be provided",
            )

        if not result:
            updated_count = 0
        else:
            updated_count = result["updated_count"]

        action = "archived" if request.archived else "unarchived"
        count = updated_count

        result_data = BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )

        # Refresh analytics materialized view to update is_archived/is_general flags
        # This is critical because archiving changes these computed columns
        try:
            refresh_sql = load_sql("sql/v3/analytics/refresh_materialized_view.sql")
            await conn.execute(refresh_sql)
        except Exception as refresh_error:
            # Log error but don't fail the archive operation
            # The view will be stale until next manual refresh or next archive operation
            logger.warning(
                f"Failed to refresh analytics view after bulk archive: {refresh_error}",
                exc_info=True,
            )

        # Invalidate cache after mutation - only invalidate history sections
        # Overview sections are based on materialized views and don't need invalidation
        # History sections need invalidation since archive status affects what's shown

        # Build base invalidation tags
        # Dashboard uses general tags (no profileId filter), so always invalidate it
        # Home, reports, and practice use profile-specific tags (require profileId)
        invalidation_tags = tags + [
            "dashboard",  # Invalidates dashboard history endpoint (no profileId filter)
        ]

        # Determine which profileIds to invalidate
        profile_ids_to_invalidate: set[str] = set()

        if request.archiveAll and request.filters and request.filters.profileId:
            # Filter-based archive with specific profileId
            profile_ids_to_invalidate.add(request.filters.profileId)
        elif request.attemptIds:
            # AttemptIds-based archive - query database to get unique profileIds
            try:
                profile_ids_query = """
                    SELECT DISTINCT ap.profile_id::text
                    FROM attempt_profiles ap
                    WHERE ap.attempt_id = ANY($1::uuid[])
                    AND ap.active = true
                    AND ap.profile_id IS NOT NULL
                """
                profile_id_rows = await conn.fetch(
                    profile_ids_query, request.attemptIds
                )
                profile_ids_to_invalidate = {
                    str(row["profile_id"])
                    for row in profile_id_rows
                    if row["profile_id"]
                }
            except Exception as profile_query_error:
                # Log error but continue with general invalidation
                logger.warning(
                    f"Failed to query profileIds from attemptIds: {profile_query_error}",
                    exc_info=True,
                )

        # Add profile-specific tags for each affected profileId
        # These endpoints require profileId, so we only need profile-specific invalidation
        for profile_id in profile_ids_to_invalidate:
            invalidation_tags.extend(
                [
                    f"home:profile:{profile_id}",
                    f"reports:profile:{profile_id}",
                    f"practice:profile:{profile_id}",
                    f"history:profile:{profile_id}",
                ]
            )

        await invalidate_tags(invalidation_tags)
        response.headers["X-Invalidate-Tags"] = ",".join(invalidation_tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_archive_attempts",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
