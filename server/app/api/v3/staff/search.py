"""Staff search endpoint - search staff with query and filters."""

import json
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.staff.list import StaffItem
from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


router = APIRouter()


class SearchStaffRequest(BaseModel):
    """Request for staff search."""

    query: str | None = (
        None  # Search term (first_name, last_name, email, role). Empty/None returns all profiles (up to limit)
    )
    cohortIds: list[str] | None = None  # Cohort IDs to EXCLUDE profiles from (optional)
    departmentIds: list[str] | None = (
        None  # Department IDs to EXCLUDE profiles from (optional)
    )
    limit: int = 200  # Maximum number of results
    # profileId removed - comes from X-Profile-Id header


class SearchStaffResponse(BaseModel):
    """Response for staff search endpoint."""

    staff: list[StaffItem]  # Filtered staff list (max limit items)
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


@router.post(
    "/search",
    response_model=SearchStaffResponse,
    dependencies=[
        audit_activity("staff.searched", "{{ actor.name }} searched staff")
    ],
)
async def search_staff(
    request: SearchStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchStaffResponse:
    """Search staff with query and filters."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SearchStaffResponse.model_validate(cached["data"])

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Build dynamic SQL query (similar to staff_queries.search_staff)
        # Start with current_profile_id (used in CTEs)
        params: list[Any] = [profile_id]
        param_idx = 2  # $1 is current_profile_id

        # Build search WHERE clause
        search_conditions = []

        # Search query filter (if provided)
        if request.query and request.query.strip():
            search_term = f"%{request.query.strip()}%"
            # Use the same parameter for all ILIKE conditions (PostgreSQL allows this)
            # Cast role enum to text for ILIKE comparison
            # Also check concatenated full name for queries like "default admin"
            search_conditions.append(
                f"(p.first_name ILIKE ${param_idx} OR p.last_name ILIKE ${param_idx} OR EXISTS (SELECT 1 FROM profile_emails pe WHERE pe.profile_id = p.id AND pe.active = true AND pe.email ILIKE ${param_idx}) OR p.role::text ILIKE ${param_idx} OR (p.first_name || ' ' || p.last_name) ILIKE ${param_idx})"
            )
            params.append(search_term)
            param_idx += 1

        # Cohort exclusion filter (if provided)
        cohort_exclusion = ""
        if request.cohortIds and len(request.cohortIds) > 0:
            cohort_exclusion = f"AND NOT EXISTS (SELECT 1 FROM cohort_profiles cp WHERE cp.profile_id = p.id AND cp.cohort_id = ANY(${param_idx}::uuid[]) AND cp.active = true)"
            params.append(request.cohortIds)
            param_idx += 1

        # Department exclusion filter (if provided)
        dept_exclusion = ""
        if request.departmentIds and len(request.departmentIds) > 0:
            dept_exclusion = f"AND NOT EXISTS (SELECT 1 FROM profile_departments pd2 WHERE pd2.profile_id = p.id AND pd2.department_id = ANY(${param_idx}::uuid[]) AND pd2.active = true)"
            params.append(request.departmentIds)
            param_idx += 1

        # Build WHERE clause
        where_clause = ""
        if search_conditions:
            where_clause = "AND " + " AND ".join(search_conditions)

        # Add limit
        params.append(request.limit)
        limit_param = param_idx
        param_idx += 1

        # Build the full SQL query dynamically
        sql_query = f"""
        WITH user_profile AS (
            SELECT COALESCE((SELECT role FROM profiles WHERE id = $1), 'guest') as role
        ),
        user_departments AS (
            SELECT department_id
            FROM profile_departments
            WHERE profile_id = $1 AND active = true
        ),
        profile_cohorts AS (
            SELECT
                cp.profile_id,
                ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
            FROM cohort_profiles cp
            JOIN cohorts c ON c.id = cp.cohort_id
            WHERE cp.active = true
            GROUP BY cp.profile_id
        ),
        profile_departments_agg AS (
            SELECT
                pd.profile_id,
                ARRAY_AGG(pd.department_id ORDER BY d.title) as department_ids
            FROM profile_departments pd
            JOIN departments d ON d.id = pd.department_id
            WHERE pd.active = true
            GROUP BY pd.profile_id
        ),
        recent_runs AS (
            SELECT
                rp.profile_id,
                COUNT(*) as run_count
            FROM runs r
            JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
            WHERE r.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY rp.profile_id
        ),
        profile_total_runs AS (
            SELECT
                rp.profile_id,
                COUNT(*) as total_requests
            FROM run_profiles rp
            WHERE rp.active = true
            GROUP BY rp.profile_id
        ),
        all_cohort_ids AS (
            SELECT DISTINCT c.id as cohort_id
            FROM cohorts c
            WHERE c.active = true
        ),
        cohort_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                c.id::text,
                jsonb_build_object(
                    'name', c.title,
                    'description', COALESCE(c.description, '')
                )
            ), '{{}}'::jsonb) as cohort_mapping
            FROM cohorts c
            WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
        ),
        department_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ), '{{}}'::jsonb) as department_mapping
            FROM departments d
            WHERE d.active = true
        ),
        staff_data AS (
            SELECT DISTINCT ON (p.id)
                jsonb_build_object(
                    'profile_id', p.id::text,
                    'first_name', p.first_name,
                    'last_name', p.last_name,
                    'emails', COALESCE(
                        ARRAY(
                            SELECT email FROM (
                                SELECT DISTINCT ON (pe2.email) 
                                    pe2.email,
                                    pe2.is_primary,
                                    pe2.created_at
                                FROM profile_emails pe2 
                                WHERE pe2.profile_id = p.id AND pe2.active = true 
                                ORDER BY pe2.email, pe2.is_primary DESC, pe2.created_at
                            ) distinct_emails
                            ORDER BY is_primary DESC, created_at
                        ),
                        ARRAY[]::text[]
                    ),
                    'primary_email', (SELECT pe.email FROM profile_emails pe WHERE pe.profile_id = p.id AND pe.is_primary = true AND pe.active = true LIMIT 1),
                    'name', p.first_name || ' ' || p.last_name,
                    'role', p.role,
                    'initials', SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1),
                    'active', p.active,
                    'last_active', CASE WHEN pa.last_active IS NOT NULL THEN pa.last_active::text ELSE NULL END,
                    'cohort_ids', COALESCE(
                        ARRAY(SELECT unnest(pc.cohort_ids)::text),
                        ARRAY[]::text[]
                    ),
                    'department_ids', COALESCE(
                        ARRAY(SELECT unnest(pda.department_ids)::text),
                        ARRAY[]::text[]
                    ),
                    'primary_department_id', COALESCE((SELECT pd2.department_id::text FROM profile_departments pd2 WHERE pd2.profile_id = p.id AND pd2.active = true AND pd2.is_primary = true LIMIT 1), ''),
                    'requests_per_day', prl.requests_per_day,
                    'total_requests', COALESCE(ptr.total_requests, 0),
                    'requests_in_last_day', COALESCE(rr.run_count::int, 0),
                    'can_edit', false,
                    'can_delete', false
                ) as staff_item
            FROM profiles p
            JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
            LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
            LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
            LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
            LEFT JOIN recent_runs rr ON rr.profile_id = p.id
            LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
            LEFT JOIN LATERAL (
                SELECT last_active
                FROM profile_activity
                WHERE profile_id = p.id
                ORDER BY created_at DESC
                LIMIT 1
            ) pa ON true
            CROSS JOIN user_profile up
            WHERE (
                -- Superadmin sees all staff
                up.role = 'superadmin'
                OR
                -- For search, show all staff with active departments
                true
            )
            {where_clause}
            {cohort_exclusion}
            {dept_exclusion}
            ORDER BY p.id, p.last_name, p.first_name
            LIMIT ${limit_param}
        ),
        staff_aggregated AS (
            SELECT COALESCE(
                jsonb_agg(sd.staff_item ORDER BY sd.staff_item->>'last_name', sd.staff_item->>'first_name'),
                '[]'::jsonb
            ) as staff
            FROM staff_data sd
        )
        SELECT
            sa.staff,
            cmd.cohort_mapping,
            dmd.department_mapping
        FROM cohort_mapping_data cmd
        CROSS JOIN department_mapping_data dmd
        CROSS JOIN staff_aggregated sa
        """

        result = await conn.fetchrow(sql_query, *params)

        if not result:
            # Return empty mappings if no data
            response_data = SearchStaffResponse(
                staff=[],
                department_mapping={},
                cohort_mapping={},
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

        # Parse staff JSONB array
        staff = []
        staff_data = result.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for item in staff_data:
                if isinstance(item, dict):
                    # Convert UUID arrays to string arrays
                    cohort_ids = [str(cid) for cid in (item.get("cohort_ids") or [])]
                    department_ids = [
                        str(did) for did in (item.get("department_ids") or [])
                    ]
                    # Get primary department_id - ensure it always exists (default to empty string or first department)
                    primary_department_id = item.get("primary_department_id") or ""
                    if not primary_department_id and department_ids:
                        # Fallback to first department if no primary department set
                        primary_department_id = (
                            department_ids[0] if len(department_ids) > 0 else ""
                        )

                    emails = item.get("emails") or []
                    primary_email = item.get("primary_email")
                    staff.append(
                        StaffItem(
                            profile_id=str(item.get("profile_id", "")),
                            first_name=item.get("first_name", ""),
                            last_name=item.get("last_name", ""),
                            emails=emails if isinstance(emails, list) else [],
                            primary_email=primary_email,
                            name=item.get("name", ""),
                            role=item.get("role", ""),
                            initials=item.get("initials", ""),
                            active=item.get("active", False),
                            last_active=item.get("last_active"),
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            primary_department_id=primary_department_id,
                            requests_per_day=item.get("requests_per_day"),
                            total_requests=item.get("total_requests", 0),
                            requests_in_last_day=item.get("requests_in_last_day", 0),
                            can_edit=False,  # Not needed for search modal
                            can_delete=False,  # Not needed for search modal
                        )
                    )

        # Parse cohort mapping JSONB
        cohort_mapping = {}
        cohort_mapping_data = result.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse department mapping JSONB
        department_mapping = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        response_data = SearchStaffResponse(
            staff=staff,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

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
            operation="search_staff",
            sql_query=None,  # Dynamic SQL query
            sql_params=None,  # Dynamic params
            request=http_request,
        )
