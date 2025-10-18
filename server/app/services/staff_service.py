"""Staff service layer - business logic for staff operations."""

import os
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.staff_queries import StaffQueries
from app.schemas.base import CohortMappingItem, DepartmentMappingItem
from app.schemas.staff import (BulkCreateStaffRequest, BulkCreateStaffResponse,
                               BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               CreateStaffRequest, CreateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffItem, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from app.services.base import BaseService, with_cache


class StaffService(BaseService):
    """Service layer for staff operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = StaffQueries()

    @with_cache(lambda self, filters: keys.staff_list(filters))
    async def get_staff_list(self, filters: StaffFilters) -> StaffListResponse:
        """Get staff list with permissions using dynamic SQL."""
        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Get query from query builder
        query, params = self.queries.list_staff(
            filters.departmentIds, filters.profileId, campus_domain
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        staff = []
        cohort_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            cohort_ids = [str(cid) for cid in (row['cohort_ids'] or [])]

            staff.append(
                StaffItem(
                    profile_id=str(row['profile_id']),
                    first_name=row['first_name'],
                    last_name=row['last_name'],
                    alias=row['alias'],
                    name=row['name'],
                    role=row['role'],
                    email=row['email'],
                    initials=row['initials'],
                    active=row['active'],
                    lastActive=row['lastactive'].isoformat() if row['lastactive'] else None,
                    cohort_ids=cohort_ids,
                    requests_per_day=row['requests_per_day'],
                    default_profile=row['default_profile'],
                    requests_in_last_day=row['requests_in_last_day'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                )
            )

        # Get cohort names for mapping
        if cohort_ids_to_fetch := list(set([cid for s in staff for cid in s.cohort_ids])):
            query, params = self.queries.get_cohort_mapping(cohort_ids_to_fetch)
            cohort_result = await self.conn.fetch(query, *params)

            for row in cohort_result:
                cohort_mapping[str(row['id'])] = CohortMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Get department mapping from filter departmentIds
        department_mapping = {}
        if filters.departmentIds:
            query, params = self.queries.get_department_mapping(filters.departmentIds)
            dept_result = await self.conn.fetch(query, *params)

            for row in dept_result:
                department_mapping[str(row['id'])] = DepartmentMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        return StaffListResponse(
            staff=staff,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.staff_detail(request.profileId, request.currentProfileId))
    async def get_staff_detail(self, request: StaffDetailRequest) -> StaffDetailResponse:
        """Get detailed staff information using dynamic SQL."""
        # Get campus email domain from environment
        campus_email = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")

        # Get profile basic info
        query, params = self.queries.get_profile_by_id(request.profileId)
        profile = await self.conn.fetchrow(query, *params)

        if not profile:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Construct email
        email = profile['alias'] + campus_email

        # Get profile's department
        query, params = self.queries.get_profile_department(request.profileId)
        dept_result = await self.conn.fetchrow(query, *params)
        department_id = str(dept_result['department_id']) if dept_result else ""

        # Get profile's cohorts
        query, params = self.queries.get_profile_cohorts(request.profileId)
        cohort_result = await self.conn.fetch(query, *params)
        cohort_ids = [str(row['cohort_id']) for row in cohort_result]

        # Get valid departments
        query, params = self.queries.get_valid_departments_for_profile(
            request.currentProfileId
        )
        dept_list = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_list]

        # Get cohort mapping
        cohort_mapping = {}
        if cohort_ids:
            query, params = self.queries.get_cohort_mapping(cohort_ids)
            cohort_results = await self.conn.fetch(query, *params)
            for row in cohort_results:
                cohort_mapping[str(row['id'])] = CohortMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in dept_list
        }

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        return StaffDetailResponse(
            name=profile['name'],
            email=email,
            role=profile['role'],
            requests_per_day=profile['requests_per_day'],
            active=profile['active'],
            department_id=department_id,
            valid_department_ids=valid_department_ids,
            cohort_ids=cohort_ids,
            role_options=role_options,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.staff_detail_bulk(request.profileIds, request.currentProfileId))
    async def get_staff_detail_bulk(
        self, request: StaffDetailBulkRequest
    ) -> StaffDetailBulkResponse:
        """Get bulk staff detail information."""
        # Get profiles
        query, params = self.queries.get_profiles_by_ids(request.profileIds)
        profiles = await self.conn.fetch(query, *params)

        if not profiles:
            raise ValueError("No profiles found")

        # Check if roles are consistent
        roles = list(set([p['role'] for p in profiles]))
        role = roles[0] if len(roles) == 1 else None

        # Check if requests_per_day are consistent
        req_per_days = list(
            set([p['requests_per_day'] for p in profiles if p['requests_per_day'] is not None])
        )
        requests_per_day = req_per_days[0] if len(req_per_days) == 1 else None

        # Get all departments for these profiles
        query, params = self.queries.get_profile_departments_bulk(request.profileIds)
        dept_results = await self.conn.fetch(query, *params)
        department_ids = [str(row['department_id']) for row in dept_results]

        # Get valid departments
        query, params = self.queries.get_valid_departments_for_profile(
            request.currentProfileId
        )
        dept_list = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_list]

        # Get department mapping
        if department_ids:
            query, params = self.queries.get_departments_mapping(department_ids)
            dept_mapping_results = await self.conn.fetch(query, *params)
            department_mapping = {
                str(row['id']): DepartmentMappingItem(
                    name=row['name'], description=row['description']
                )
                for row in dept_mapping_results
            }
        else:
            department_mapping = {}

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
                None,
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
        await self._invalidate_cache([
            keys.tag_staff_all(),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

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
            existing_aliases = [row['alias'] for row in existing]
            raise ValueError(
                f"Aliases already exist: {', '.join(existing_aliases)}"
            )

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
                    "req_per_day": None,
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
        await self._invalidate_cache([
            keys.tag_staff_all(),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

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

        # Update profile
        query, _ = self.queries.update_profile()
        await self.conn.execute(
            {
                "profile_id": request.profileId,
                "role": request.role,
                "requests_per_day": request.requests_per_day,
                "active": request.active,
            },
        )

        # Update department
        query, _ = self.queries.update_profile_department()
        await self.conn.execute(
            {
                "profile_id": request.profileId,
                "department_id": request.department_id,
            },
        )

        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache([
            keys.tag_staff_by_id(request.profileId),
            keys.tag_staff_all(),
            keys.tag_profile_by_id(request.profileId),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

        return UpdateStaffResponse(
            success=True, message=f"Staff '{existing['name']}' updated successfully"
        )

    async def bulk_update_staff(
        self, request: BulkUpdateStaffRequest
    ) -> BulkUpdateStaffResponse:
        """Bulk update staff members."""

        # Build dynamic SET clauses
        set_clauses = []
        params: dict[str, Any] = {"profile_ids": request.profileIds}

        if request.role is not None:
            set_clauses.append("role = :role")
            params["role"] = request.role

        if request.requests_per_day is not None:
            set_clauses.append("req_per_day = :requests_per_day")
            params["requests_per_day"] = request.requests_per_day

        if request.active is not None:
            set_clauses.append("active = :active")
            params["active"] = request.active

        # Update profiles if there are fields to update
        if set_clauses:
            query, _ = self.queries.bulk_update_profiles()
            query = query.format(set_clauses=", ".join(set_clauses) + ",")

        # Update departments if provided
        if request.department_id is not None:
            query, _ = self.queries.bulk_update_profile_departments()
            await self.conn.execute(
                {
                    "profile_ids": request.profileIds,
                    "department_id": request.department_id,
                },
            )

        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache([
            keys.tag_staff_all(),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

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

        if result['default_profile']:
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
        await self._invalidate_cache([
            keys.tag_staff_by_id(request.profileId),
            keys.tag_staff_all(),
            keys.tag_profile_by_id(request.profileId),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

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
        default_ids = [str(row['id']) for row in default_profiles]

        # Filter out default profiles
        deletable_ids = [
            pid for pid in request.profileIds if pid not in default_ids
        ]

        if not deletable_ids:
            raise ValueError("No profiles can be deleted (all are default profiles)")

        # Delete profiles
        query, params = self.queries.bulk_delete_profiles(deletable_ids)
        # Transaction handled by context manager

        # Invalidate caches
        await self._invalidate_cache([
            keys.tag_staff_all(),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),
        ])

        message = f"{len(deletable_ids)} staff members deleted successfully"
        if default_ids:
            message += f" ({len(default_ids)} default profiles skipped)"

        return BulkDeleteStaffResponse(success=True, message=message)


def get_staff_service(conn: asyncpg.Connection) -> StaffService:
    """Get staff service instance."""
    return StaffService(conn)
