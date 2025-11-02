"""Staff service layer - business logic for staff operations."""

import json
import os
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.cohort_queries import CohortQueries
from app.queries.staff_queries import StaffQueries
from app.schemas.analytics import TrendData
from app.schemas.base import CohortMappingItem, DepartmentMappingItem
from app.schemas.staff import (BulkCreateOrUpdateStaffRequest,
                               BulkCreateOrUpdateStaffResponse,
                               BulkCreateStaffRequest, BulkCreateStaffResponse,
                               BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               CreateOrUpdateStaffRequest,
                               CreateOrUpdateStaffResponse,
                               CreateStaffDataRequest, CreateStaffDataResponse,
                               CreateStaffRequest, CreateStaffResponse,
                               CSVColumnMapping, CSVRowError,
                               DeleteStaffRequest, DeleteStaffResponse,
                               ProcessCSVRequest, ProcessCSVResponse,
                               ProcessedCSVRow, SearchStaffRequest,
                               SearchStaffResponse, StaffDetailBulkRequest,
                               StaffDetailBulkResponse, StaffDetailRequest,
                               StaffDetailResponse, StaffFilters, StaffItem,
                               StaffListResponse, UpdateStaffRequest,
                               UpdateStaffResponse)
from app.services.base_service import BaseService, with_cache


class StaffService(BaseService):
    """Service layer for staff operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = StaffQueries()
        self.cohort_queries = CohortQueries()

    @with_cache(lambda self, filters: keys.staff_list(filters))
    async def get_staff_list(self, filters: StaffFilters) -> StaffListResponse:
        """Get staff list with permissions using dynamic SQL."""
        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Get query from query builder (now includes JSONB mappings)
        query, params = self.queries.list_staff(
            filters.profileId, campus_domain
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        staff = []
        cohort_mapping = {}
        department_mapping = {}
        trend_data: dict[str, list[TrendData]] = {
            "active": [],
            "admin": [],
            "instructional": [],
            "ta": [],
            "total_requests": [],
        }

        for row in result:
            # Convert UUID arrays to string arrays
            cohort_ids = [str(cid) for cid in (row["cohort_ids"] or [])]
            # Convert UUID arrays to string arrays (department_ids comes as text[] from query)
            department_ids = row["department_ids"] or []

            staff.append(
                StaffItem(
                    profile_id=str(row["profile_id"]),
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    alias=row["alias"],
                    name=row["name"],
                    role=row["role"],
                    email=row["email"],
                    initials=row["initials"],
                    active=row["active"],
                    last_active=row["lastactive"].isoformat()
                    if row["lastactive"]
                    else None,
                    cohort_ids=cohort_ids,
                    department_ids=department_ids,
                    requests_per_day=row["requests_per_day"],
                    total_requests=row["total_requests"] or 0,
                    default_profile=row["default_profile"],
                    requests_in_last_day=row["requests_in_last_day"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Parse JSONB mappings from query result (single query optimization)
        if result and len(result) > 0:
            # Cohort mapping (JSONB from query - may be string or dict)
            cohort_mapping_data = result[0].get("cohort_mapping")
            if isinstance(cohort_mapping_data, str):
                cohort_mapping_data = json.loads(cohort_mapping_data)
            if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
                for cid, cdata in cohort_mapping_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

            # Department mapping (JSONB from query - may be string or dict)
            dept_mapping_data = result[0].get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

            # Trend data (JSONB from query - may be string or dict)
            trend_data_raw = result[0].get("trend_data")
            if isinstance(trend_data_raw, str):
                trend_data_raw = json.loads(trend_data_raw)
            if trend_data_raw and isinstance(trend_data_raw, dict):
                for key in ["active", "admin", "instructional", "ta", "total_requests"]:
                    trend_array = trend_data_raw.get(key, [])
                    if isinstance(trend_array, list):
                        trend_data[key] = [
                            TrendData(
                                date=str(item.get("date", "")),
                                value=float(item.get("value", 0)),
                                count=int(item.get("count", 0)),
                            )
                            for item in trend_array
                            if isinstance(item, dict)
                        ]

        return StaffListResponse(
            staff=staff,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
            trend_data=trend_data,
        )

    @with_cache(
        lambda self, request: keys.staff_detail(
            request.profileId, request.currentProfileId
        )
    )
    async def get_staff_detail(
        self, request: StaffDetailRequest
    ) -> StaffDetailResponse:
        """Get detailed staff information using dynamic SQL."""
        # Get campus email domain from environment
        campus_email = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")

        # Get complete profile data with JSONB mappings (consolidated query)
        query, params = self.queries.get_staff_detail_complete(
            request.profileId, request.currentProfileId
        )
        profile = await self.conn.fetchrow(query, *params)

        if not profile:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Construct email
        email = profile["alias"] + campus_email

        # Parse data from consolidated query
        department_id = profile["department_id"]
        cohort_ids = profile["cohort_ids"] or []

        # Parse JSONB cohort mapping (may be string or dict)
        cohort_mapping = {}
        cohort_mapping_data = profile.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse valid departments from consolidated query
        valid_department_ids = profile.get("valid_department_ids") or []
        valid_department_ids = [str(did) for did in valid_department_ids]

        # Parse department mapping from consolidated query
        department_mapping = {}
        dept_mapping_data = profile.get("department_mapping_full")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        return StaffDetailResponse(
            name=profile["name"],
            email=email,
            role=profile["role"],
            requests_per_day=profile["requests_per_day"],
            active=profile["active"],
            department_id=department_id,
            valid_department_ids=valid_department_ids,
            cohort_ids=cohort_ids,
            role_options=role_options,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(
        lambda self, request: keys.staff_detail_bulk(
            request.profileIds, request.currentProfileId
        )
    )
    async def get_staff_detail_bulk(
        self, request: StaffDetailBulkRequest
    ) -> StaffDetailBulkResponse:
        """Get bulk staff detail information."""
        # Get profiles with JSONB department mapping (consolidated query)
        query, params = self.queries.get_profiles_by_ids(
            request.profileIds, request.currentProfileId
        )
        profiles = await self.conn.fetch(query, *params)

        if not profiles:
            raise ValueError("No profiles found")

        # Check if roles are consistent
        roles = list(set([p["role"] for p in profiles]))
        role = roles[0] if len(roles) == 1 else None

        # Check if requests_per_day are consistent
        req_per_days = list(
            set(
                [
                    p["requests_per_day"]
                    for p in profiles
                    if p["requests_per_day"] is not None
                ]
            )
        )
        requests_per_day = req_per_days[0] if len(req_per_days) == 1 else None

        # Get all department_ids from optimized query result
        all_dept_ids: list[str] = []
        for p in profiles:
            dept_ids = p.get("department_ids") or []
            all_dept_ids.extend(dept_ids)
        department_ids = list(set(all_dept_ids))

        # Parse JSONB department mapping from query result (may be string or dict)
        department_mapping = {}
        if profiles and len(profiles) > 0:
            dept_mapping_data = profiles[0].get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Parse valid departments from consolidated query
        valid_department_ids = []
        if profiles and len(profiles) > 0:
            valid_dept_ids_raw = profiles[0].get("valid_department_ids") or []
            valid_department_ids = [str(did) for did in valid_dept_ids_raw]

            # Update department_mapping to use department_mapping_full
            dept_mapping_full = profiles[0].get("department_mapping_full")
            if isinstance(dept_mapping_full, str):
                dept_mapping_full = json.loads(dept_mapping_full)
            if dept_mapping_full and isinstance(dept_mapping_full, dict):
                # Override with full department mapping
                department_mapping = {}
                for did, ddata in dept_mapping_full.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        return StaffDetailBulkResponse(
            role=role,
            requests_per_day=requests_per_day,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            role_options=role_options,
            department_mapping=department_mapping,
        )

    async def create_staff(self, request: CreateStaffRequest) -> CreateStaffResponse:
        """Create a new staff member."""

        # Check if alias already exists
        query, params = self.queries.check_alias_exists(request.alias)
        existing = await self.conn.fetchrow(query, *params)

        if existing:
            raise ValueError(f"Alias '{request.alias}' already exists")

        # Generate new profile ID
        profile_id = str(uuid.uuid4())

        async with transaction(self.conn):
            # Insert profile
            query, _ = self.queries.create_profile()
            await self.conn.execute(
                query,
                profile_id,
                request.firstName,
                request.lastName,
                request.alias,
                request.role,
                True,
                False,
                False,
                False,
            )

            # If department_id is provided, insert profile_departments relationship
            if request.department_id:
                dept_query, _ = self.queries.insert_profile_department()
                await self.conn.execute(
                    dept_query,
                    profile_id,
                    request.department_id,
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return CreateStaffResponse(
            success=True,
            profileId=profile_id,
            message=f"Staff '{request.firstName} {request.lastName}' created successfully",
        )

    async def bulk_create_staff(
        self, request: BulkCreateStaffRequest
    ) -> BulkCreateStaffResponse:
        """Bulk create staff members."""

        # Check for duplicate aliases
        aliases = [p.alias for p in request.profiles]
        query, params = self.queries.check_aliases_exist(aliases)
        existing = await self.conn.fetch(query, *params)

        if existing:
            existing_aliases = [row["alias"] for row in existing]
            raise ValueError(f"Aliases already exist: {', '.join(existing_aliases)}")

        # Create all profiles
        profile_ids: list[str] = []
        for profile_req in request.profiles:
            profile_id = str(uuid.uuid4())
            profile_ids.append(profile_id)

            # Insert profile
            query, _ = self.queries.create_profile()
            await self.conn.execute(
                {
                    "id": profile_id,
                    "first_name": profile_req.firstName,
                    "last_name": profile_req.lastName,
                    "alias": profile_req.alias,
                    "role": profile_req.role,
                    "active": True,
                    "default_profile": False,
                    "viewed_intro": False,
                    "viewed_chat": False,
                },
            )

            # If department_id is provided, insert profile_departments relationship
            if profile_req.department_id:
                query, _ = self.queries.insert_profile_department()
                await self.conn.execute(
                    {
                        "profile_id": profile_id,
                        "department_id": profile_req.department_id,
                    },
                )

        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return BulkCreateStaffResponse(
            success=True,
            profileIds=profile_ids,
            message=f"{len(profile_ids)} staff members created successfully",
        )

    async def update_staff(self, request: UpdateStaffRequest) -> UpdateStaffResponse:
        """Update a staff member."""

        # Check if profile exists
        query, params = self.queries.get_profile_name(request.profileId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Profile not found: {request.profileId}")

        async with transaction(self.conn):
            # Update profile
            query, _ = self.queries.update_profile()
            await self.conn.execute(
                query,
                request.profileId,
                request.role,
                request.active,
            )

            # Update department
            query, _ = self.queries.update_profile_department()
            await self.conn.execute(
                query,
                request.profileId,
                request.department_id,
            )

            # Update or insert profile request limit if provided
            if request.requests_per_day is not None:
                limit_query, _ = self.queries.upsert_profile_request_limit()
                await self.conn.execute(
                    limit_query,
                    request.profileId,
                    request.requests_per_day,
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_by_id(request.profileId),
                keys.tag_staff_all(),
                keys.tag_profile_by_id(request.profileId),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return UpdateStaffResponse(
            success=True, message=f"Staff '{existing['name']}' updated successfully"
        )

    async def bulk_update_staff(
        self, request: BulkUpdateStaffRequest
    ) -> BulkUpdateStaffResponse:
        """Bulk update staff members with permission validation."""

        # Get current user's role for validation
        current_profile_id = request.currentProfileId
        query, params = self.queries.get_profile_role(current_profile_id)
        current_user = await self.conn.fetchrow(query, *params)
        
        if not current_user:
            raise ValueError(f"Current user profile not found: {current_profile_id}")
        
        current_user_role = current_user["role"]

        # Role hierarchy validation helper
        def can_assign_role(creator_role: str, target_role: str) -> bool:
            """Check if creator_role can assign target_role."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return target_role in role_hierarchy.get(creator_role, [])
        
        def get_assignable_roles(creator_role: str) -> list[str]:
            """Get list of roles that creator_role can assign."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return role_hierarchy.get(creator_role, [])

        async with transaction(self.conn):
            # Validate permissions for each profile before updating
            for profile_id in request.profileIds:
                # Check if profile is default_profile
                check_default_query = "SELECT default_profile, role FROM profiles WHERE id = $1"
                profile_data = await self.conn.fetchrow(check_default_query, profile_id)
                
                if not profile_data:
                    raise ValueError(f"Profile not found: {profile_id}")
                
                target_is_default = profile_data["default_profile"]
                target_role = profile_data["role"]
                
                # Validate default_profile editing (only superadmin can edit default profiles)
                if target_is_default and current_user_role != "superadmin":
                    raise ValueError(
                        f"Cannot edit default profile {profile_id}. Only superadmin can edit default profiles."
                    )
                
                # Validate role assignment if role is being updated
                if request.role is not None:
                    if not can_assign_role(current_user_role, request.role):
                        assignable = get_assignable_roles(current_user_role)
                        raise ValueError(
                            f"Cannot assign role '{request.role}' with current role '{current_user_role}'. "
                            f"Only roles: {', '.join(assignable)} can be assigned."
                        )
                    
                    # Cannot assign role equal or higher than current role (except self and superadmin)
                    if profile_id != current_profile_id and current_user_role != "superadmin":
                        role_levels = {
                            "superadmin": 4,
                            "admin": 3,
                            "instructional": 2,
                            "ta": 1,
                            "guest": 0,
                        }
                        current_level = role_levels.get(current_user_role, -1)
                        target_level = role_levels.get(request.role, -1)
                        if target_level >= current_level:
                            raise ValueError(
                                f"Cannot assign role '{request.role}' which is equal or higher than current role '{current_user_role}'."
                            )

            # Build dynamic SET clauses for profiles table (excluding requests_per_day)
            set_clauses = []
            params_dict: dict[str, Any] = {"profile_ids": request.profileIds}

            if request.role is not None:
                set_clauses.append("role = :role")
                params_dict["role"] = request.role

            if request.default_profile is not None:
                set_clauses.append("default_profile = :default_profile")
                params_dict["default_profile"] = request.default_profile

            if request.active is not None:
                set_clauses.append("active = :active")
                params_dict["active"] = request.active

            # Update profiles if there are fields to update
            if set_clauses:
                query, _ = self.queries.bulk_update_profiles()
                query = query.format(set_clauses=", ".join(set_clauses) + ",")
                await self.conn.execute(query, **params_dict)

            # Update request limits if provided
            # requests_per_day can be:
            # - int: specific limit
            # - None: unlimited
            # - "__keep__": don't update (keep existing)
            if isinstance(request.requests_per_day, str) and request.requests_per_day == "__keep__":
                # Don't update requests_per_day
                pass
            else:
                limit_query, _ = self.queries.upsert_profile_request_limit()
                for profile_id in request.profileIds:
                    # Convert string to int if needed (from frontend)
                    value = None
                    if isinstance(request.requests_per_day, str) and request.requests_per_day != "__keep__":
                        try:
                            value = int(request.requests_per_day)
                        except (ValueError, TypeError):
                            value = None  # Treat invalid as unlimited
                    elif isinstance(request.requests_per_day, int):
                        value = request.requests_per_day
                    elif request.requests_per_day is None:
                        value = None  # Explicitly unlimited
                    
                    await self.conn.execute(
                        limit_query,
                        profile_id,
                        value,
                    )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return BulkUpdateStaffResponse(
            success=True,
            message=f"{len(request.profileIds)} staff members updated successfully",
        )

    async def delete_staff(self, request: DeleteStaffRequest) -> DeleteStaffResponse:
        """Delete a staff member."""

        # Check if profile is default
        query, params = self.queries.check_default_profile(request.profileId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Profile not found: {request.profileId}")

        if result["default_profile"]:
            raise ValueError("Cannot delete default profile")

        # Get profile name
        query, params = self.queries.get_profile_name(request.profileId)
        profile = await self.conn.fetchrow(query, *params)

        if not profile:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Delete profile
        query, params = self.queries.delete_profile(request.profileId)
        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_by_id(request.profileId),
                keys.tag_staff_all(),
                keys.tag_profile_by_id(request.profileId),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return DeleteStaffResponse(
            success=True, message=f"Staff '{profile['name']}' deleted successfully"
        )

    async def bulk_delete_staff(
        self, request: BulkDeleteStaffRequest
    ) -> BulkDeleteStaffResponse:
        """Bulk delete staff members."""

        # Check for default profiles
        query, params = self.queries.bulk_check_default_profiles(request.profileIds)
        default_profiles = await self.conn.fetch(query, *params)
        default_ids = [str(row["id"]) for row in default_profiles]

        # Filter out default profiles
        deletable_ids = [pid for pid in request.profileIds if pid not in default_ids]

        if not deletable_ids:
            raise ValueError("No profiles can be deleted (all are default profiles)")

        # Delete profiles
        query, params = self.queries.bulk_delete_profiles(deletable_ids)
        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        message = f"{len(deletable_ids)} staff members deleted successfully"
        if default_ids:
            message += f" ({len(default_ids)} default profiles skipped)"

        return BulkDeleteStaffResponse(success=True, message=message)

    async def get_create_staff_data(
        self, request: CreateStaffDataRequest
    ) -> CreateStaffDataResponse:
        """Get all data needed for create staff UI in one query."""
        query, params = self.queries.get_create_staff_data(
            request.departmentIds, request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            # Return empty mappings if no data
            return CreateStaffDataResponse(
                staff=[],
                department_mapping={},
                cohort_mapping={},
                role_options=["superadmin", "admin", "instructional", "ta", "guest"],
            )

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
                    department_ids = item.get("department_ids") or []
                    
                    staff.append(
                        StaffItem(
                            profile_id=str(item.get("profile_id", "")),
                            first_name=item.get("first_name", ""),
                            last_name=item.get("last_name", ""),
                            alias=item.get("alias", ""),
                            name=item.get("name", ""),
                            role=item.get("role", ""),
                            email="",  # Not needed for search modal
                            initials="",  # Not needed for search modal
                            active=item.get("active", False),
                            last_active=item.get("last_active"),
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            requests_per_day=item.get("requests_per_day"),
                            total_requests=item.get("total_requests", 0),
                            default_profile=item.get("default_profile", False),
                            requests_in_last_day=item.get("requests_in_last_day", 0),
                            can_edit=False,  # Not needed for search modal
                            can_delete=False,  # Not needed for search modal
                        )
                    )

        # Parse JSONB mappings
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

        return CreateStaffDataResponse(
            staff=staff,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
            role_options=["superadmin", "admin", "instructional", "ta", "guest"],
        )

    async def search_staff(
        self, request: SearchStaffRequest
    ) -> SearchStaffResponse:
        """Search staff with query and filters in one query."""
        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")
        
        query, params = self.queries.search_staff(
            query=request.query,
            cohort_ids=request.cohortIds,
            department_ids=request.departmentIds,
            limit=request.limit,
            current_profile_id=request.profileId,
            campus_domain=campus_domain,
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            # Return empty mappings if no data
            return SearchStaffResponse(
                staff=[],
                department_mapping={},
                cohort_mapping={},
            )

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
                    department_ids = [str(did) for did in (item.get("department_ids") or [])]
                    
                    staff.append(
                        StaffItem(
                            profile_id=str(item.get("profile_id", "")),
                            first_name=item.get("first_name", ""),
                            last_name=item.get("last_name", ""),
                            alias=item.get("alias", ""),
                            name=item.get("name", ""),
                            role=item.get("role", ""),
                            email=item.get("email", ""),
                            initials=item.get("initials", ""),
                            active=item.get("active", False),
                            last_active=item.get("last_active"),
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            requests_per_day=item.get("requests_per_day"),
                            total_requests=item.get("total_requests", 0),
                            default_profile=item.get("default_profile", False),
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

        return SearchStaffResponse(
            staff=staff,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

    async def process_csv(self, request: ProcessCSVRequest) -> ProcessCSVResponse:
        """Process CSV file and map columns to target fields."""
        import csv
        from io import StringIO

        # Parse CSV content
        csv_file = StringIO(request.csv_content)
        reader = csv.DictReader(csv_file)
        headers = reader.fieldnames or []

        # Build mapping dict for quick lookup
        column_to_field: dict[str, str | None] = {}
        for mapping in request.column_mappings:
            column_to_field[mapping.csv_column] = mapping.target_field

        rows: list[ProcessedCSVRow] = []
        row_index = 0

        for csv_row in reader:
            row_index += 1
            errors: list[CSVRowError] = []

            # Extract values based on mappings
            firstName = None
            lastName = None
            alias = None
            role = None
            department_ids: list[str] = []
            cohort_ids: list[str] = []

            for header in headers:
                field = column_to_field.get(header)
                value = csv_row.get(header, "").strip() if header else ""

                if field == "firstName":
                    firstName = value if value else None
                elif field == "lastName":
                    lastName = value if value else None
                elif field == "alias":
                    alias = value if value else None
                    # Extract alias from email if needed
                    if alias and "@" in alias:
                        alias = alias.split("@")[0].strip()
                elif field == "role":
                    role = value if value else None
                elif field == "department":
                    # Support comma-separated values for multiple departments
                    if value:
                        dept_values = [d.strip() for d in value.split(",") if d.strip()]
                        department_ids.extend(dept_values)
                elif field == "cohort":
                    # Support comma-separated values for multiple cohorts
                    if value:
                        cohort_values = [c.strip() for c in value.split(",") if c.strip()]
                        cohort_ids.extend(cohort_values)

            # Validate required fields
            if not firstName:
                errors.append(
                    CSVRowError(
                        row_index=row_index, field="firstName", message="First name is required"
                    )
                )
            if not lastName:
                errors.append(
                    CSVRowError(
                        row_index=row_index, field="lastName", message="Last name is required"
                    )
                )
            if not alias:
                errors.append(
                    CSVRowError(
                        row_index=row_index, field="alias", message="Alias is required"
                    )
                )

            # Default role to 'ta' if not provided
            if not role:
                role = "ta"

            rows.append(
                ProcessedCSVRow(
                    row_index=row_index,
                    firstName=firstName,
                    lastName=lastName,
                    alias=alias,
                    role=role,
                    department_ids=department_ids,
                    cohort_ids=cohort_ids,
                    errors=errors,
                )
            )

        return ProcessCSVResponse(success=True, rows=rows, headers=list(headers))

    async def create_or_update_staff(
        self, request: CreateOrUpdateStaffRequest
    ) -> CreateOrUpdateStaffResponse:
        """Create or update a staff member based on alias."""
        # Check if alias exists
        query, params = self.queries.check_alias_exists(request.alias)
        existing = await self.conn.fetchrow(query, *params)

        async with transaction(self.conn):
            if existing:
                # Update existing profile
                profile_id = existing["id"]

                # Update profile fields
                query, _ = self.queries.update_profile()
                await self.conn.execute(
                    query,
                    profile_id,
                    request.role,
                    True,  # active
                )

                # Update firstName and lastName (need a separate query)
                update_name_query = """
                UPDATE profiles 
                SET first_name = $2, last_name = $3, updated_at = NOW()
                WHERE id = $1
                """
                await self.conn.execute(
                    update_name_query, profile_id, request.firstName, request.lastName
                )

                # Update departments (handle array)
                if request.department_ids:
                    # First, delete any existing department relationships
                    delete_dept_query = """
                    DELETE FROM profile_departments WHERE profile_id = $1
                    """
                    await self.conn.execute(delete_dept_query, profile_id)
                    # Then insert all new ones (first one as primary)
                    insert_dept_query = """
                    INSERT INTO profile_departments (profile_id, department_id, is_primary)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (profile_id, department_id) DO UPDATE SET
                        is_primary = EXCLUDED.is_primary,
                        active = true,
                        updated_at = NOW()
                    """
                    for idx, dept_id in enumerate(request.department_ids):
                        is_primary = idx == 0  # First department is primary
                        await self.conn.execute(
                            insert_dept_query, profile_id, dept_id, is_primary
                        )
                elif request.department_ids == []:
                    # Empty array means remove all departments
                    delete_dept_query = """
                    DELETE FROM profile_departments WHERE profile_id = $1
                    """
                    await self.conn.execute(delete_dept_query, profile_id)

                # Update cohorts (handle array - only add new ones, don't remove existing)
                if request.cohort_ids:
                    # Get existing active cohorts for this profile
                    existing_cohorts_query = """
                    SELECT cohort_id FROM cohort_profiles 
                    WHERE profile_id = $1 AND active = true
                    """
                    existing = await self.conn.fetch(existing_cohorts_query, profile_id)
                    existing_cohort_ids = {row["cohort_id"] for row in existing}
                    
                    # Insert only cohorts that don't already exist
                    query, _ = self.cohort_queries.insert_cohort_profile()
                    for cohort_id in request.cohort_ids:
                        if cohort_id not in existing_cohort_ids:
                            await self.conn.execute(query, cohort_id, profile_id)

                created = False
                message = f"Staff '{request.firstName} {request.lastName}' updated successfully"
            else:
                # Create new profile
                editing_profile_id = str(uuid.uuid4())

                # Insert profile
                query, _ = self.queries.create_profile()
                await self.conn.execute(
                    query,
                    editing_profile_id,
                    request.firstName,
                    request.lastName,
                    request.alias,
                    request.role,
                    True,
                    False,
                    False,
                    False,
                )

                # Insert departments (first one as primary)
                if request.department_ids:
                    insert_dept_query = """
                    INSERT INTO profile_departments (profile_id, department_id, is_primary)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (profile_id, department_id) DO UPDATE SET
                        is_primary = EXCLUDED.is_primary,
                        active = true,
                        updated_at = NOW()
                    """
                    for idx, dept_id in enumerate(request.department_ids):
                        is_primary = idx == 0  # First department is primary
                        await self.conn.execute(
                            insert_dept_query, editing_profile_id, dept_id, is_primary
                        )

                # Insert cohorts
                if request.cohort_ids:
                    query, _ = self.cohort_queries.insert_cohort_profile()
                    for cohort_id in request.cohort_ids:
                        await self.conn.execute(query, cohort_id, editing_profile_id)

                profile_id = editing_profile_id
                created = True
                message = f"Staff '{request.firstName} {request.lastName}' created successfully"

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return CreateOrUpdateStaffResponse(
            success=True, profileId=profile_id, created=created, message=message
        )

    async def bulk_create_or_update_staff(
        self, request: BulkCreateOrUpdateStaffRequest
    ) -> BulkCreateOrUpdateStaffResponse:
        """Bulk create or update staff members."""
        profile_ids: list[str] = []
        created_count = 0
        updated_count = 0

        # Get current user's role for validation
        current_profile_id = request.currentProfileId
        query, params = self.queries.get_profile_role(current_profile_id)
        current_user = await self.conn.fetchrow(query, *params)
        
        if not current_user:
            raise ValueError(f"Current user profile not found: {current_profile_id}")
        
        current_user_role = current_user["role"]

        # Role hierarchy validation helper
        def can_assign_role(creator_role: str, target_role: str) -> bool:
            """Check if creator_role can assign target_role."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return target_role in role_hierarchy.get(creator_role, [])
        
        def get_assignable_roles(creator_role: str) -> list[str]:
            """Get list of roles that creator_role can assign."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return role_hierarchy.get(creator_role, [])

        async with transaction(self.conn):
            for profile_req in request.profiles:
                # Validate role assignment
                if not can_assign_role(current_user_role, profile_req.role):
                    assignable = get_assignable_roles(current_user_role)
                    raise ValueError(
                        f"Cannot assign role '{profile_req.role}' with current role '{current_user_role}'. "
                        f"Only roles: {', '.join(assignable)} can be assigned."
                    )
                # Check if alias exists
                query, params = self.queries.check_alias_exists(profile_req.alias)
                existing = await self.conn.fetchrow(query, *params)

                if existing:
                    # Update existing
                    profile_id = str(existing["id"])

                    # Update profile
                    query, _ = self.queries.update_profile()
                    await self.conn.execute(query, profile_id, profile_req.role, True)

                    # Update name
                    update_name_query = """
                    UPDATE profiles 
                    SET first_name = $2, last_name = $3, updated_at = NOW()
                    WHERE id = $1
                    """
                    await self.conn.execute(
                        update_name_query, profile_id, profile_req.firstName, profile_req.lastName
                    )

                    # Update departments (handle array)
                    if profile_req.department_ids:
                        # First, delete any existing department relationships
                        delete_dept_query = """
                        DELETE FROM profile_departments WHERE profile_id = $1
                        """
                        await self.conn.execute(delete_dept_query, profile_id)
                        # Then insert all new ones (first one as primary)
                        insert_dept_query = """
                        INSERT INTO profile_departments (profile_id, department_id, is_primary)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (profile_id, department_id) DO UPDATE SET
                            is_primary = EXCLUDED.is_primary,
                            active = true,
                            updated_at = NOW()
                        """
                        for idx, dept_id in enumerate(profile_req.department_ids):
                            is_primary = idx == 0  # First department is primary
                            await self.conn.execute(
                                insert_dept_query, profile_id, dept_id, is_primary
                            )
                    elif profile_req.department_ids == []:
                        # Empty array means remove all departments
                        delete_dept_query = """
                        DELETE FROM profile_departments WHERE profile_id = $1
                        """
                        await self.conn.execute(delete_dept_query, profile_id)

                    # Update cohorts (handle array - only add new ones, don't remove existing)
                    if profile_req.cohort_ids:
                        # Get existing active cohorts for this profile
                        existing_cohorts_query = """
                        SELECT cohort_id FROM cohort_profiles 
                        WHERE profile_id = $1 AND active = true
                        """
                        existing = await self.conn.fetch(existing_cohorts_query, profile_id)
                        existing_cohort_ids = {row["cohort_id"] for row in existing}
                        
                        # Insert only cohorts that don't already exist
                        query, _ = self.cohort_queries.insert_cohort_profile()
                        for cohort_id in profile_req.cohort_ids:
                            if cohort_id not in existing_cohort_ids:
                                await self.conn.execute(query, cohort_id, profile_id)

                    updated_count += 1
                else:
                    # Create new
                    profile_id = str(uuid.uuid4())

                    query, _ = self.queries.create_profile()
                    await self.conn.execute(
                        query,
                        profile_id,
                        profile_req.firstName,
                        profile_req.lastName,
                        profile_req.alias,
                        profile_req.role,
                        True,
                        False,
                        False,
                        False,
                    )

                    # Insert departments (first one as primary)
                    if profile_req.department_ids:
                        insert_dept_query = """
                        INSERT INTO profile_departments (profile_id, department_id, is_primary)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (profile_id, department_id) DO UPDATE SET
                            is_primary = EXCLUDED.is_primary,
                            active = true,
                            updated_at = NOW()
                        """
                        for idx, dept_id in enumerate(profile_req.department_ids):
                            is_primary = idx == 0  # First department is primary
                            await self.conn.execute(
                                insert_dept_query, profile_id, dept_id, is_primary
                            )

                    # Insert cohorts
                    if profile_req.cohort_ids:
                        query, _ = self.cohort_queries.insert_cohort_profile()
                        for cohort_id in profile_req.cohort_ids:
                            await self.conn.execute(query, cohort_id, profile_id)

                    created_count += 1

                profile_ids.append(str(profile_id))

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_staff_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ]
        )

        return BulkCreateOrUpdateStaffResponse(
            success=True,
            profileIds=profile_ids,
            created_count=created_count,
            updated_count=updated_count,
            message=f"{created_count} created, {updated_count} updated successfully",
        )


def get_staff_service(conn: asyncpg.Connection) -> StaffService:
    """Get staff service instance."""
    return StaffService(conn)
