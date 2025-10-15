"""Cohort service layer - business logic for cohort operations."""

from typing import Any, Dict, List

from app.queries.cohort_queries import CohortQueries
from app.schemas.base import (DepartmentMappingItem, ProfileMappingItem,
                              SimulationMappingItem)
from app.schemas.cohorts import (AddProfilesToCohortRequest,
                                 AddProfilesToCohortResponse,
                                 CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortItem, CohortsFilters,
                                 CohortsListResponse, CreateCohortRequest,
                                 CreateCohortResponse, DeleteCohortRequest,
                                 DeleteCohortResponse, DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse,
                                 RemoveProfilesFromCohortRequest,
                                 RemoveProfilesFromCohortResponse,
                                 UpdateCohortRequest, UpdateCohortResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class CohortService:
    """Service layer for cohort operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = CohortQueries()

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
        """Add profiles to cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = self.db.execute(text(query), params).fetchone()

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Add profiles to cohort
        query, _ = self.queries.insert_cohort_profile()
        for profile_id in request.profileIds:
            self.db.execute(
                text(query),
                {"cohort_id": request.cohortId, "profile_id": profile_id},
            )

        self.db.commit()

        return AddProfilesToCohortResponse(
            success=True,
            message=f"Added {len(request.profileIds)} profile(s) to cohort '{cohort.title}' successfully",
        )

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

