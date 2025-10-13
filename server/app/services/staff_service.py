"""Staff service layer - business logic for staff operations."""

import os
from typing import Any, Dict, List, Optional

from app.queries.staff_queries import StaffQueries
from app.schemas.personas import DepartmentMappingItem
from app.schemas.staff import (BulkDeleteStaffRequest, BulkDeleteStaffResponse,
                               BulkUpdateStaffRequest, BulkUpdateStaffResponse,
                               DeleteStaffRequest, DeleteStaffResponse,
                               StaffDetailBulkRequest, StaffDetailBulkResponse,
                               StaffDetailRequest, StaffDetailResponse,
                               StaffFilters, StaffItem, StaffListResponse,
                               UpdateStaffRequest, UpdateStaffResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class StaffService:
    """Service layer for staff operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = StaffQueries()

    def get_staff_list(self, filters: StaffFilters) -> StaffListResponse:
        """Get staff list with permissions using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_staff(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Get campus email domain from environment
        campus_email = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")

        # Build response
        staff = []
        cohort_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            cohort_ids = [str(cid) for cid in (row.cohort_ids or [])]

            # Construct email from alias + campus email domain
            email = row.alias + campus_email

            staff.append(
                StaffItem(
                    profile_id=str(row.profile_id),
                    name=row.name,
                    role=row.role,
                    email=email,
                    initials=row.initials,
                    active=row.active,
                    lastActive=row.lastActive.isoformat() if row.lastActive else None,
                    cohort_ids=cohort_ids,
                    requests_per_day=row.requests_per_day,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                )
            )

        # Get cohort names for mapping
        if cohort_ids_to_fetch := list(set([cid for s in staff for cid in s.cohort_ids])):
            query, params = self.queries.get_cohort_mapping(cohort_ids_to_fetch)
            cohort_result = self.db.execute(text(query), params).fetchall()

            for row in cohort_result:
                cohort_mapping[str(row.id)] = row.name

        return StaffListResponse(
            staff=staff,
            cohort_mapping=cohort_mapping,
        )

    def get_staff_detail(self, request: StaffDetailRequest) -> StaffDetailResponse:
        """Get detailed staff information using dynamic SQL."""

        # Get campus email domain from environment
        campus_email = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "@example.edu")

        # Get profile basic info
        query, params = self.queries.get_profile_by_id(request.profileId)
        profile = self.db.execute(text(query), params).fetchone()

        if not profile:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Construct email
        email = profile.alias + campus_email

        # Get profile's department
        query, params = self.queries.get_profile_department(request.profileId)
        dept_result = self.db.execute(text(query), params).fetchone()
        department_id = str(dept_result.department_id) if dept_result else ""

        # Get profile's cohorts
        query, params = self.queries.get_profile_cohorts(request.profileId)
        cohort_result = self.db.execute(text(query), params).fetchall()
        cohort_ids = [str(row.cohort_id) for row in cohort_result]

        # Get valid departments
        query, params = self.queries.get_valid_departments_for_profile(
            request.currentProfileId
        )
        dept_list = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_list]

        # Get cohort mapping
        cohort_mapping = {}
        if cohort_ids:
            query, params = self.queries.get_cohort_mapping(cohort_ids)
            cohort_results = self.db.execute(text(query), params).fetchall()
            for row in cohort_results:
                cohort_mapping[str(row.id)] = row.name

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description
            )
            for row in dept_list
        }

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        return StaffDetailResponse(
            name=profile.name,
            email=email,
            role=profile.role,
            requests_per_day=profile.requests_per_day,
            active=profile.active,
            department_id=department_id,
            valid_department_ids=valid_department_ids,
            cohort_ids=cohort_ids,
            role_options=role_options,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
        )

    def get_staff_detail_bulk(
        self, request: StaffDetailBulkRequest
    ) -> StaffDetailBulkResponse:
        """Get bulk staff detail information."""

        # Get profiles
        query, params = self.queries.get_profiles_by_ids(request.profileIds)
        profiles = self.db.execute(text(query), params).fetchall()

        if not profiles:
            raise ValueError("No profiles found")

        # Check if roles are consistent
        roles = list(set([p.role for p in profiles]))
        role = roles[0] if len(roles) == 1 else None

        # Check if requests_per_day are consistent
        req_per_days = list(
            set([p.requests_per_day for p in profiles if p.requests_per_day is not None])
        )
        requests_per_day = req_per_days[0] if len(req_per_days) == 1 else None

        # Get all departments for these profiles
        query, params = self.queries.get_profile_departments_bulk(request.profileIds)
        dept_results = self.db.execute(text(query), params).fetchall()
        department_ids = [str(row.department_id) for row in dept_results]

        # Get valid departments
        query, params = self.queries.get_valid_departments_for_profile(
            request.currentProfileId
        )
        dept_list = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_list]

        # Get department mapping
        if department_ids:
            query, params = self.queries.get_departments_mapping(department_ids)
            dept_mapping_results = self.db.execute(text(query), params).fetchall()
            department_mapping = {
                str(row.id): DepartmentMappingItem(
                    name=row.name, description=row.description
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

    def update_staff(self, request: UpdateStaffRequest) -> UpdateStaffResponse:
        """Update a staff member."""

        # Check if profile exists
        query, params = self.queries.get_profile_name(request.profileId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Update profile
        query, _ = self.queries.update_profile()
        self.db.execute(
            text(query),
            {
                "profile_id": request.profileId,
                "role": request.role,
                "requests_per_day": request.requests_per_day,
                "active": request.active,
            },
        )

        # Update department
        query, _ = self.queries.update_profile_department()
        self.db.execute(
            text(query),
            {
                "profile_id": request.profileId,
                "department_id": request.department_id,
            },
        )

        self.db.commit()

        return UpdateStaffResponse(
            success=True, message=f"Staff '{existing.name}' updated successfully"
        )

    def bulk_update_staff(
        self, request: BulkUpdateStaffRequest
    ) -> BulkUpdateStaffResponse:
        """Bulk update staff members."""

        # Build dynamic SET clauses
        set_clauses = []
        params: Dict[str, Any] = {"profile_ids": request.profileIds}

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
            self.db.execute(text(query), params)

        # Update departments if provided
        if request.department_id is not None:
            query, _ = self.queries.bulk_update_profile_departments()
            self.db.execute(
                text(query),
                {
                    "profile_ids": request.profileIds,
                    "department_id": request.department_id,
                },
            )

        self.db.commit()

        return BulkUpdateStaffResponse(
            success=True,
            message=f"{len(request.profileIds)} staff members updated successfully",
        )

    def delete_staff(self, request: DeleteStaffRequest) -> DeleteStaffResponse:
        """Delete a staff member."""

        # Check if profile is default
        query, params = self.queries.check_default_profile(request.profileId)
        result = self.db.execute(text(query), params).fetchone()

        if not result:
            raise ValueError(f"Profile not found: {request.profileId}")

        if result.default_profile:
            raise ValueError("Cannot delete default profile")

        # Get profile name
        query, params = self.queries.get_profile_name(request.profileId)
        profile = self.db.execute(text(query), params).fetchone()

        if not profile:
            raise ValueError(f"Profile not found: {request.profileId}")

        # Delete profile
        query, params = self.queries.delete_profile(request.profileId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteStaffResponse(
            success=True, message=f"Staff '{profile.name}' deleted successfully"
        )

    def bulk_delete_staff(
        self, request: BulkDeleteStaffRequest
    ) -> BulkDeleteStaffResponse:
        """Bulk delete staff members."""

        # Check for default profiles
        query, params = self.queries.bulk_check_default_profiles(request.profileIds)
        default_profiles = self.db.execute(text(query), params).fetchall()
        default_ids = [str(row.id) for row in default_profiles]

        # Filter out default profiles
        deletable_ids = [
            pid for pid in request.profileIds if pid not in default_ids
        ]

        if not deletable_ids:
            raise ValueError("No profiles can be deleted (all are default profiles)")

        # Delete profiles
        query, params = self.queries.bulk_delete_profiles(deletable_ids)
        self.db.execute(text(query), params)
        self.db.commit()

        message = f"{len(deletable_ids)} staff members deleted successfully"
        if default_ids:
            message += f" ({len(default_ids)} default profiles skipped)"

        return BulkDeleteStaffResponse(success=True, message=message)

