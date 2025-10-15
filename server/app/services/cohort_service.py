"""Cohort service layer - business logic for cohort operations."""

import os
import uuid
from typing import Any, Dict, List

from app.queries.cohort_queries import CohortQueries
from app.queries.staff_queries import StaffQueries
from app.schemas.base import (CohortMapping, CohortMappingItem,
                              DepartmentMapping, DepartmentMappingItem,
                              ProfileMappingItem, SimulationMappingItem)
from app.schemas.cohorts import (AddProfilesToCohortRequest,
                                 AddProfilesToCohortResponse,
                                 CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortDetailWithProfilesRequest,
                                 CohortDetailWithProfilesResponse, CohortItem,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse,
                                 RemoveProfilesFromCohortRequest,
                                 RemoveProfilesFromCohortResponse,
                                 UpdateCohortRequest, UpdateCohortResponse)
from app.schemas.staff import StaffItem
from sqlalchemy import text
from sqlalchemy.orm import Session


class CohortService:
    """Service layer for cohort operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = CohortQueries()
        self.staff_queries = StaffQueries()

    def get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Get cohorts list with permissions and relationships."""

        # Get query from query builder
        query, params = self.queries.list_cohorts(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Build response
        cohorts = []
        profile_mapping = {}
        simulation_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            profile_ids = [str(pid) for pid in (row.profile_ids or [])]
            simulation_ids = [str(sid) for sid in (row.simulation_ids or [])]

            cohorts.append(
                CohortItem(
                    cohort_id=str(row.cohort_id),
                    name=row.name,
                    description=row.description,
                    active=row.active,
                    default_cohort=row.default_cohort,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    can_duplicate=row.can_duplicate,
                    can_leave=row.can_leave,
                    profile_ids=profile_ids,
                    simulation_ids=simulation_ids,
                    num_members=row.num_members,
                )
            )

        # Get profile names for mapping
        if profile_ids_to_fetch := list(
            set([pid for c in cohorts for pid in c.profile_ids])
        ):
            query, params = self.queries.get_profile_mapping(profile_ids_to_fetch)
            profile_result = self.db.execute(text(query), params).fetchall()

            for row in profile_result:
                profile_mapping[str(row.id)] = ProfileMappingItem(
                    name=row.name,
                    description=row.description
                )

        # Get simulation names for mapping
        if simulation_ids_to_fetch := list(
            set([sid for c in cohorts for sid in c.simulation_ids])
        ):
            query, params = self.queries.get_simulation_mapping(
                simulation_ids_to_fetch
            )
            simulation_result = self.db.execute(text(query), params).fetchall()

            for row in simulation_result:
                simulation_mapping[str(row.id)] = SimulationMappingItem(
                    name=row.name,
                    description=row.description
                )

        return CohortsListResponse(
            cohorts=cohorts,
            profile_mapping=profile_mapping,
            simulation_mapping=simulation_mapping,
        )

    def get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Get detailed cohort information using dynamic SQL."""

        # Get cohort basic info
        query, params = self.queries.get_cohort_by_id(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Get profile IDs for this cohort
        query, params = self.queries.get_cohort_profiles(request.cohortId)
        profile_result = self.db.execute(text(query), params).fetchall()
        profile_ids = [str(row.profile_id) for row in profile_result]

        # Get simulation IDs for this cohort
        query, params = self.queries.get_cohort_simulations(request.cohortId)
        simulation_result = self.db.execute(text(query), params).fetchall()
        simulation_ids = [str(row.simulation_id) for row in simulation_result]

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_result]

        # Get valid simulations
        query, params = self.queries.get_valid_simulations(valid_department_ids)
        valid_simulation_ids = [
            str(row.id) for row in self.db.execute(text(query), params).fetchall()
        ]

        # Get valid profiles
        query, params = self.queries.get_valid_profiles(valid_department_ids)
        valid_profile_ids = [
            str(row.id) for row in self.db.execute(text(query), params).fetchall()
        ]

        # Get simulation mapping
        if simulation_ids:
            query, params = self.queries.get_simulation_mapping(simulation_ids)
            sim_mapping_result = self.db.execute(text(query), params).fetchall()
            simulation_mapping = {
                str(row.id): SimulationMappingItem(name=row.name, description=row.description)
                for row in sim_mapping_result
            }
        else:
            simulation_mapping = {}

        # Get profile mapping
        if profile_ids:
            query, params = self.queries.get_profile_mapping(profile_ids)
            prof_mapping_result = self.db.execute(text(query), params).fetchall()
            profile_mapping = {
                str(row.id): ProfileMappingItem(name=row.name, description=row.description)
                for row in prof_mapping_result
            }
        else:
            profile_mapping = {}

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description or ''
            )
            for row in dept_result
        }

        return CohortDetailResponse(
            title=cohort.title,
            description=cohort.description,
            department_id=str(cohort.department_id),
            valid_department_ids=valid_department_ids,
            active=cohort.active,
            default_cohort=cohort.default_cohort,
            simulation_ids=simulation_ids,
            valid_simulation_ids=valid_simulation_ids,
            profile_ids=profile_ids,
            valid_profile_ids=valid_profile_ids,
            simulation_mapping=simulation_mapping,
            profile_mapping=profile_mapping,
            department_mapping=department_mapping,
        )

    def get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Get default cohort details based on profile."""

        # Get default cohort for profile
        query, params = self.queries.get_default_cohort(request.profileId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError("No cohorts found for user's departments")

        # Reuse the detail logic with the found cohort_id
        detail_request = CohortDetailRequest(
            cohortId=str(cohort.id), profileId=request.profileId
        )

        return self.get_cohort_detail(detail_request)

    def get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Get cohort detail with available profiles in one call."""

        # Get campus email domain
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # 1. Get cohort basic info
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # 2. Get profile IDs currently in this cohort
        query, params = self.queries.get_cohort_profiles(request.cohortId)
        profile_result = self.db.execute(text(query), params).fetchall()
        current_profile_ids = [str(row.profile_id) for row in profile_result]

        # 3. Get all staff for the departments using staff query
        query, params = self.staff_queries.list_staff(
            request.departmentIds, request.currentProfileId, campus_domain
        )
        result = self.db.execute(text(query), params).fetchall()

        # 4. Filter to available profiles (instructional/ta, not in cohort, not default)
        available_profiles = []
        for row in result:
            profile_id = str(row.profile_id)
            
            # Skip if already in cohort, is default, or not correct role
            if (
                profile_id not in current_profile_ids
                and not row.default_profile
                and row.role in ["instructional", "ta"]
            ):
                cohort_ids = [str(cid) for cid in (row.cohort_ids or [])]
                available_profiles.append(
                    StaffItem(
                        profile_id=profile_id,
                        first_name=row.first_name,
                        last_name=row.last_name,
                        alias=row.alias,
                        name=row.name,
                        role=row.role,
                        email=row.email,
                        initials=row.initials,
                        active=row.active,
                        lastActive=row.lastActive.isoformat() if row.lastActive else None,
                        cohort_ids=cohort_ids,
                        requests_per_day=row.requests_per_day,
                        default_profile=row.default_profile,
                        requests_in_last_day=row.requests_in_last_day,
                        can_edit=row.can_edit,
                        can_delete=row.can_delete,
                    )
                )

        # 5. Get department mapping
        department_mapping: DepartmentMapping = {}
        if request.departmentIds:
            query, params = self.staff_queries.get_department_mapping(request.departmentIds)
            dept_result = self.db.execute(text(query), params).fetchall()
            for row in dept_result:
                department_mapping[str(row.id)] = DepartmentMappingItem(
                    name=row.name, description=row.description
                )

        # 6. Get cohort mapping (just this cohort)
        cohort_mapping: CohortMapping = {
            str(cohort.id): CohortMappingItem(
                name=cohort.title,
                description=cohort.description or ""
            )
        }

        return CohortDetailWithProfilesResponse(
            cohort_id=str(cohort.id),
            title=cohort.title,
            description=cohort.description,
            active=cohort.active,
            current_profile_ids=current_profile_ids,
            available_profiles=available_profiles,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

    def create_cohort(self, request: CreateCohortRequest) -> CreateCohortResponse:
        """Create a new cohort with relationships."""

        query, _ = self.queries.create_cohort()
        result = self.db.execute(
            text(query),
            {
                "title": request.title,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_cohort": request.default_cohort,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create cohort")

        cohort_id = str(result.id)

        # Insert profile relationships
        profile_query, _ = self.queries.insert_cohort_profile()
        for profile_id in request.profile_ids:
            self.db.execute(
                text(profile_query),
                {"cohort_id": cohort_id, "profile_id": profile_id},
            )

        # Insert simulation relationships
        simulation_query, _ = self.queries.insert_cohort_simulation()
        for simulation_id in request.simulation_ids:
            self.db.execute(
                text(simulation_query),
                {"cohort_id": cohort_id, "simulation_id": simulation_id},
            )

        self.db.commit()

        return CreateCohortResponse(
            success=True,
            cohortId=cohort_id,
            message=f"Cohort '{request.title}' created successfully",
        )

    def update_cohort(self, request: UpdateCohortRequest) -> UpdateCohortResponse:
        """Update an existing cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Update cohort
        query, _ = self.queries.update_cohort()
        self.db.execute(
            text(query),
            {
                "cohort_id": request.cohortId,
                "title": request.title,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_cohort": request.default_cohort,
            },
        )

        # Delete existing relationships
        query, params = self.queries.delete_cohort_profiles(request.cohortId)
        self.db.execute(text(query), params)

        query, params = self.queries.delete_cohort_simulations(request.cohortId)
        self.db.execute(text(query), params)

        # Insert new relationships
        profile_query, _ = self.queries.insert_cohort_profile()
        for profile_id in request.profile_ids:
            self.db.execute(
                text(profile_query),
                {"cohort_id": request.cohortId, "profile_id": profile_id},
            )

        simulation_query, _ = self.queries.insert_cohort_simulation()
        for simulation_id in request.simulation_ids:
            self.db.execute(
                text(simulation_query),
                {"cohort_id": request.cohortId, "simulation_id": simulation_id},
            )

        self.db.commit()

        return UpdateCohortResponse(
            success=True, message=f"Cohort '{request.title}' updated successfully"
        )

    def duplicate_cohort(
        self, request: DuplicateCohortRequest
    ) -> DuplicateCohortResponse:
        """Duplicate a cohort with relationships."""

        # Get original cohort data
        query, params = self.queries.get_cohort_for_duplicate(request.cohortId)
        result = self.db.execute(text(query), params).fetchone()

        if not result:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Insert duplicate
        duplicate_query, _ = self.queries.insert_duplicate_cohort()
        new_cohort = self.db.execute(
            text(duplicate_query),
            {
                "title": result.title,
                "description": result.description,
                "department_id": result.department_id,
            },
        ).fetchone()

        if not new_cohort:
            raise ValueError("Failed to create duplicate cohort")

        # Copy relationships
        copy_profiles_query, _ = self.queries.copy_cohort_profiles()
        self.db.execute(
            text(copy_profiles_query),
            {
                "new_cohort_id": new_cohort.id,
                "original_cohort_id": request.cohortId,
            },
        )

        copy_simulations_query, _ = self.queries.copy_cohort_simulations()
        self.db.execute(
            text(copy_simulations_query),
            {
                "new_cohort_id": new_cohort.id,
                "original_cohort_id": request.cohortId,
            },
        )

        self.db.commit()

        return DuplicateCohortResponse(
            success=True,
            cohortId=str(new_cohort.id),
            message=f"Cohort '{result.title}' duplicated successfully",
        )

    def delete_cohort(self, request: DeleteCohortRequest) -> DeleteCohortResponse:
        """Delete a cohort if not in use."""

        # Check if cohort is in use
        query, params = self.queries.check_cohort_usage(request.cohortId)
        usage = self.db.execute(text(query), params).fetchone()

        if not usage:
            raise ValueError("Failed to check cohort usage")

        if usage.usage_count > 0:
            raise ValueError(
                "Cannot delete cohort that has profiles with attempts"
            )

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Delete cohort
        query, params = self.queries.delete_cohort(request.cohortId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteCohortResponse(
            success=True, message=f"Cohort '{cohort.title}' deleted successfully"
        )

    def leave_cohort(self, request: LeaveCohortRequest) -> LeaveCohortResponse:
        """Remove profile from cohort."""

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profile from cohort
        query, params = self.queries.leave_cohort(request.cohortId, request.profileId)
        self.db.execute(text(query), params)
        self.db.commit()

        return LeaveCohortResponse(
            success=True, message=f"Left cohort '{cohort.title}' successfully"
        )

    def add_profiles_to_cohort(
        self, request: AddProfilesToCohortRequest
    ) -> AddProfilesToCohortResponse:
        """Add profiles to cohort (handles both existing and new profiles)."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        profile_ids_to_add = []

        # Handle existing profile IDs
        if request.existingProfileIds:
            profile_ids_to_add.extend(request.existingProfileIds)

        # Handle new profiles (create them first)
        if request.newProfiles:
            for profile_req in request.newProfiles:
                # Check if alias already exists
                query, params = self.staff_queries.check_alias_exists(profile_req.alias)
                existing = self.db.execute(text(query), params).fetchone()

                if existing:
                    raise ValueError(f"Alias '{profile_req.alias}' already exists")

                # Generate new profile ID
                profile_id = str(uuid.uuid4())
                profile_ids_to_add.append(profile_id)

                # Insert profile
                query, _ = self.staff_queries.create_profile()
                self.db.execute(
                    text(query),
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

                # Insert profile-department relationships for all departments
                for dept_id in request.departmentIds:
                    query, _ = self.staff_queries.insert_profile_department()
                    self.db.execute(
                        text(query),
                        {"profile_id": profile_id, "department_id": dept_id},
                    )

        # Add all profiles to cohort
        query, _ = self.queries.insert_cohort_profile()
        for profile_id in profile_ids_to_add:
            self.db.execute(
                text(query),
                {"cohort_id": request.cohortId, "profile_id": profile_id},
            )

        self.db.commit()

        total_count = len(profile_ids_to_add)
        new_count = len(request.newProfiles) if request.newProfiles else 0
        existing_count = len(request.existingProfileIds) if request.existingProfileIds else 0

        message = f"Added {total_count} profile(s) to cohort '{cohort.title}'"
        if new_count > 0:
            message += f" ({new_count} newly created)"

        return AddProfilesToCohortResponse(success=True, message=message)

    def remove_profiles_from_cohort(
        self, request: RemoveProfilesFromCohortRequest
    ) -> RemoveProfilesFromCohortResponse:
        """Remove profiles from cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profiles from cohort by setting active = false
        query, _ = self.queries.remove_cohort_profiles()
        self.db.execute(
            text(query),
            {"cohort_id": request.cohortId, "profile_ids": request.profileIds},
        )

        self.db.commit()

        return RemoveProfilesFromCohortResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from cohort '{cohort.title}' successfully",
        )

