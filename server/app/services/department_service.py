"""Department service with business logic and dynamic SQL."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.department_queries import DepartmentQueries
from app.schemas.departments import (CreateDepartmentRequest,
                                     CreateDepartmentResponse,
                                     DeleteDepartmentRequest,
                                     DeleteDepartmentResponse,
                                     DepartmentDetailRequest,
                                     DepartmentDetailResponse, DepartmentItem,
                                     DepartmentsFilters,
                                     DepartmentsListResponse,
                                     DuplicateDepartmentRequest,
                                     DuplicateDepartmentResponse,
                                     RemoveProfilesFromDepartmentRequest,
                                     RemoveProfilesFromDepartmentResponse,
                                     UpdateDepartmentRequest,
                                     UpdateDepartmentResponse)
from app.schemas.staff import StaffItem
from app.services.base_service import BaseService, with_cache


class DepartmentService(BaseService):
    """Service for department operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = DepartmentQueries()

    @with_cache(lambda self, filters: keys.department_list(filters))
    async def get_departments_list(
        self, filters: DepartmentsFilters
    ) -> DepartmentsListResponse:
        """
        Get list of departments with computed fields.

        Args:
            filters: Department filters

        Returns:
            DepartmentsListResponse
        """
        query, params = self.queries.get_departments_list(
            filters.profileId
        )
        rows = await self.conn.fetch(query, *params)
        return self._build_departments_list(rows)

    def _build_departments_list(self, rows: list[Any]) -> DepartmentsListResponse:
        """Build departments list response from query rows."""
        departments: list[DepartmentItem] = []
        for row in rows:
            departments.append(
                DepartmentItem(
                    department_id=row["department_id"],
                    title=row["title"],
                    description=row["description"],
                    active=row["active"],
                    updated_at=row["updated_at"].isoformat(),
                    total_price_spent=float(row["total_price_spent"]),
                    staff_count=int(row["staff_count"]),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )
        return DepartmentsListResponse(departments=departments)

    @with_cache(lambda self, request: keys.department_by_id(request.departmentId))
    async def get_department_detail(
        self, request: DepartmentDetailRequest
    ) -> DepartmentDetailResponse:
        """
        Get department detail with permissions, stats, and staff list.

        Args:
            request: Detail request

        Returns:
            DepartmentDetailResponse with staff list and mappings
        """
        import json
        import os

        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Get complete department data with staff (consolidated query)
        query, params = self.queries.get_department_detail_with_staff(
            request.departmentId, request.profileId, campus_domain
        )
        dept_row = await self.conn.fetchrow(query, *params)

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        # Parse staff list from JSONB (may be string or list)
        staff_list: list[StaffItem] = []
        staff_data = dept_row.get("staff")
        if isinstance(staff_data, str):
            staff_data = json.loads(staff_data)
        if staff_data and isinstance(staff_data, list):
            for staff_row in staff_data:
                if isinstance(staff_row, dict):
                    # Convert cohort_ids from array
                    cohort_ids = staff_row.get("cohort_ids") or []
                    cohort_ids = [str(cid) for cid in cohort_ids]
                    # department_ids is already text[]
                    department_ids = staff_row.get("department_ids") or []
                    # Convert lastActive timestamp (may be string from JSONB or datetime)
                    last_active = None
                    if staff_row.get("lastActive"):
                        last_active_val = staff_row["lastActive"]
                        if isinstance(last_active_val, str):
                            last_active = last_active_val
                        elif hasattr(last_active_val, "isoformat"):
                            last_active = last_active_val.isoformat()
                        else:
                            last_active = str(last_active_val)

                    staff_list.append(
                        StaffItem(
                            profile_id=str(staff_row["profile_id"]),
                            first_name=staff_row["first_name"],
                            last_name=staff_row["last_name"],
                            alias=staff_row["alias"],
                            name=staff_row["name"],
                            role=staff_row["role"],
                            email=staff_row["email"],
                            initials=staff_row["initials"],
                            active=staff_row["active"],
                            last_active=last_active,
                            cohort_ids=cohort_ids,
                            department_ids=department_ids,
                            requests_per_day=staff_row.get("requests_per_day"),
                            total_requests=staff_row.get("total_requests", 0),
                            default_profile=staff_row["default_profile"],
                            requests_in_last_day=staff_row.get("requests_in_last_day", 0),
                            can_edit=staff_row["can_edit"],
                            can_delete=staff_row["can_delete"],
                        )
                    )

        # Parse cohort mapping from JSONB (may be string or dict)
        cohort_mapping = {}
        cohort_mapping_data = dept_row.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            from app.schemas.base import CohortMappingItem

            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse department mapping from JSONB (may be string or dict)
        department_mapping = {}
        dept_mapping_data = dept_row.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            from app.schemas.base import DepartmentMappingItem

            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        return DepartmentDetailResponse(
            title=dept_row["title"],
            description=dept_row["description"],
            active=dept_row["active"],
            # Permissions
            can_edit=dept_row["can_edit"],
            can_duplicate=dept_row["can_duplicate"],
            can_delete=dept_row["can_delete"],
            # Usage/Stats
            in_use=dept_row["in_use"],
            staff_count=int(dept_row["staff_count"]),
            total_price_spent=float(dept_row["total_price_spent"]),
            # Staff list and mappings
            staff=staff_list,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, profile_id: keys.department_default(profile_id))
    async def get_department_detail_default(
        self, profile_id: str
    ) -> DepartmentDetailResponse:
        """
        Get default department detail for creation mode.

        Args:
            profile_id: Profile ID

        Returns:
            DepartmentDetailResponse with defaults
        """
        # Get all data in ONE consolidated query (C3 consolidation)
        query, params = self.queries.get_department_default_complete(profile_id)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Profile {profile_id} not found")

        is_superadmin = result["profile_role"] == "superadmin"

        # Return defaults for creation
        return DepartmentDetailResponse(
            title="",
            description="",
            active=True,
            # Permissions (only superadmin can create)
            can_edit=is_superadmin,
            can_duplicate=False,  # Can't duplicate when creating
            can_delete=False,  # Can't delete when creating
            # Usage/Stats (all zero for new department)
            in_use=False,
            staff_count=0,
            total_price_spent=0.0,
            # Empty mappings and staff for new department
            staff=[],
            cohort_mapping={},
            department_mapping={},
        )

    async def create_department(
        self, request: CreateDepartmentRequest
    ) -> CreateDepartmentResponse:
        """
        Create a new department.

        Args:
            request: Create request

        Returns:
            CreateDepartmentResponse
        """
        async with transaction(self.conn):
            # Create department
            query, params = self.queries.create_department(
                request.title, request.description, request.active
            )
            dept_row = await self.conn.fetchrow(query, *params)

            if not dept_row:
                raise ValueError("Failed to create department")

            department_id = dept_row["department_id"]

            # Automatically link all superadmins, default profiles, and the creator to this new department
            auto_link_query = """
            SELECT id FROM profiles 
            WHERE role = 'superadmin' OR default_profile = true OR id = $1
            """
            profiles_to_link = await self.conn.fetch(auto_link_query, request.profile_id)
            
            for profile in profiles_to_link:
                profile_dept_query = """
                INSERT INTO profile_departments (profile_id, department_id)
                VALUES ($1, $2)
                ON CONFLICT (profile_id, department_id) DO NOTHING
                """
                await self.conn.execute(
                    profile_dept_query,
                    profile["id"],
                    department_id
                )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return CreateDepartmentResponse(
            success=True,
            departmentId=department_id,
            message="Department created successfully",
        )

    async def update_department(
        self, request: UpdateDepartmentRequest
    ) -> UpdateDepartmentResponse:
        """
        Update a department.

        Args:
            request: Update request

        Returns:
            UpdateDepartmentResponse
        """
        async with transaction(self.conn):
            # Update department
            query, params = self.queries.update_department(
                request.departmentId, request.title, request.description, request.active
            )
            await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_by_id(request.departmentId),
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return UpdateDepartmentResponse(
            success=True, message="Department updated successfully"
        )

    async def duplicate_department(
        self, request: DuplicateDepartmentRequest
    ) -> DuplicateDepartmentResponse:
        """
        Duplicate a department.

        Args:
            request: Duplicate request

        Returns:
            DuplicateDepartmentResponse
        """
        # Get original department title
        query, params = self.queries.get_department_basic(request.departmentId)
        dept_row = await self.conn.fetchrow(query, *params)

        if not dept_row:
            raise ValueError(f"Department {request.departmentId} not found")

        new_title = f"{dept_row['title']} Copy"

        async with transaction(self.conn):
            # Duplicate department
            query, params = self.queries.duplicate_department(
                request.departmentId, new_title
            )
            new_dept_row = await self.conn.fetchrow(query, *params)

            if not new_dept_row:
                raise ValueError("Failed to duplicate department")

            new_department_id = new_dept_row["department_id"]

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return DuplicateDepartmentResponse(
            success=True,
            departmentId=new_department_id,
            message="Department duplicated successfully",
        )

    async def delete_department(
        self, request: DeleteDepartmentRequest
    ) -> DeleteDepartmentResponse:
        """
        Delete a department (with usage check).

        Args:
            request: Delete request

        Returns:
            DeleteDepartmentResponse
        """
        # Check if department is in use
        query, params = self.queries.check_department_usage(request.departmentId)
        usage_row = await self.conn.fetchrow(query, *params)

        if not usage_row:
            raise ValueError(f"Department {request.departmentId} not found")

        # Only count actual data dependencies (not profile links which are just access permissions)
        total_usage = (
            usage_row["simulation_count"]
            + usage_row["scenario_count"]
            + usage_row["persona_count"]
            + usage_row["document_count"]
            + usage_row["cohort_count"]
        )

        if total_usage > 0:
            raise ValueError(
                f"Cannot delete department: in use by {total_usage} entities (simulations, scenarios, personas, documents, or cohorts)"
            )

        # Delete department (cascade deletes department_agents)
        query, params = self.queries.delete_department(request.departmentId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_by_id(request.departmentId),
                keys.tag_department_all(),
                keys.tag_profile_all(),
            ]
        )

        return DeleteDepartmentResponse(
            success=True, message="Department deleted successfully"
        )

    async def remove_profiles_from_department(
        self, request: RemoveProfilesFromDepartmentRequest
    ) -> RemoveProfilesFromDepartmentResponse:
        """
        Remove profiles from department by setting active = false in junction table.
        
        NOTE: This does NOT delete profiles from the database, only removes the relationship.
        Profiles remain in the system but are no longer associated with this department.
        
        Args:
            request: Remove request with departmentId and profileIds
            
        Returns:
            RemoveProfilesFromDepartmentResponse
        """
        # Get department title for message
        query, params = self.queries.get_department_basic(request.departmentId)
        dept = await self.conn.fetchrow(query, *params)

        if not dept:
            raise ValueError(f"Department {request.departmentId} not found")

        async with transaction(self.conn):
            # Remove profiles from department by setting active = false
            query, params = self.queries.remove_department_profiles()
            await self.conn.execute(query, request.departmentId, request.profileIds)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_department_by_id(request.departmentId),
                keys.tag_department_all(),
                keys.tag_staff_all(),
                keys.tag_profile_all(),
            ]
        )

        return RemoveProfilesFromDepartmentResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from department '{dept['title']}' successfully",
        )


def get_department_service(conn: asyncpg.Connection) -> DepartmentService:
    """Get department service instance."""
    return DepartmentService(conn)
