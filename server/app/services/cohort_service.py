"""Cohort service layer - business logic for cohort operations."""

import os
import uuid
from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.extensions import get_query_client
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
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize
from dotenv import load_dotenv

load_dotenv()


class CohortService:
    """Service layer for cohort operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.queries = CohortQueries()
        self.staff_queries = StaffQueries()

    async def get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Get cohorts list with permissions and relationships."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohorts_list(filters)
        
        key = keys.cohort_list(filters)
        
        async def fetcher() -> CohortsListResponse:
            return await self._execute_get_cohorts_list(filters)
        
        result: CohortsListResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohorts_list(self, filters: CohortsFilters) -> CohortsListResponse:
        """Execute the actual cohorts list query."""
        # Get campus domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")

        # Get query from query builder
        query, params = self.queries.list_cohorts(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        cohorts = []
        profile_mapping = {}
        simulation_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            profile_ids = [str(pid) for pid in (row['profile_ids'] or [])]
            simulation_ids = [str(sid) for sid in (row['simulation_ids'] or [])]

            cohorts.append(
                CohortItem(
                    cohort_id=str(row['cohort_id']),
                    name=row['name'],
                    description=row['description'],
                    active=row['active'],
                    default_cohort=row['default_cohort'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                    can_duplicate=row['can_duplicate'],
                    can_leave=row['can_leave'],
                    profile_ids=profile_ids,
                    simulation_ids=simulation_ids,
                    num_members=row['num_members'],
                )
            )

        # Get profile names for mapping
        if profile_ids_to_fetch := list(
            set([pid for c in cohorts for pid in c.profile_ids])
        ):
            query, params = self.queries.get_profile_mapping(profile_ids_to_fetch, campus_domain)
            profile_result = await self.conn.fetch(query, *params)

            for row in profile_result:
                profile_mapping[str(row['id'])] = ProfileMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Get simulation names for mapping
        if simulation_ids_to_fetch := list(
            set([sid for c in cohorts for sid in c.simulation_ids])
        ):
            query, params = self.queries.get_simulation_mapping(
                simulation_ids_to_fetch
            )
            simulation_result = await self.conn.fetch(query, *params)

            for row in simulation_result:
                simulation_mapping[str(row['id'])] = SimulationMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        return CohortsListResponse(
            cohorts=cohorts,
            profile_mapping=profile_mapping,
            simulation_mapping=simulation_mapping,
        )

    async def get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Get detailed cohort information using dynamic SQL."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohort_detail(request)
        
        key = keys.cohort_by_id(request.cohortId, request.profileId)
        
        async def fetcher() -> CohortDetailResponse:
            return await self._execute_get_cohort_detail(request)
        
        result: CohortDetailResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohort_detail(
        self, request: CohortDetailRequest
    ) -> CohortDetailResponse:
        """Execute the actual cohort detail query."""
        # Get campus domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.com")

        # Get cohort basic info
        query, params = self.queries.get_cohort_by_id(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Get profile IDs for this cohort
        query, params = self.queries.get_cohort_profiles(request.cohortId)
        profile_result = await self.conn.fetch(query, *params)
        profile_ids = [str(row['profile_id']) for row in profile_result]

        # Get simulation IDs for this cohort
        query, params = self.queries.get_cohort_simulations(request.cohortId)
        simulation_result = await self.conn.fetch(query, *params)
        simulation_ids = [str(row['simulation_id']) for row in simulation_result]

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_result]

        # Get valid simulations
        query, params = self.queries.get_valid_simulations(valid_department_ids)
        valid_simulation_ids = [
            str(row['id']) for row in await self.conn.fetch(query, *params)
        ]

        # Get valid profiles
        query, params = self.queries.get_valid_profiles(valid_department_ids)
        valid_profile_ids = [
            str(row['id']) for row in await self.conn.fetch(query, *params)
        ]

        # Get simulation mapping
        if simulation_ids:
            query, params = self.queries.get_simulation_mapping(simulation_ids)
            sim_mapping_result = await self.conn.fetch(query, *params)
            simulation_mapping = {
                str(row['id']): SimulationMappingItem(name=row['name'], description=row['description'])
                for row in sim_mapping_result
            }
        else:
            simulation_mapping = {}

        # Get profile mapping
        if profile_ids:
            query, params = self.queries.get_profile_mapping(profile_ids, campus_domain)
            prof_mapping_result = await self.conn.fetch(query, *params)
            profile_mapping = {
                str(row['id']): ProfileMappingItem(name=row['name'], description=row['description'])
                for row in prof_mapping_result
            }
        else:
            profile_mapping = {}

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in dept_result
        }

        return CohortDetailResponse(
            title=cohort['title'],
            description=cohort['description'],
            department_id=str(cohort.department_id),
            valid_department_ids=valid_department_ids,
            active=cohort['active'],
            default_cohort=cohort.default_cohort,
            simulation_ids=simulation_ids,
            valid_simulation_ids=valid_simulation_ids,
            profile_ids=profile_ids,
            valid_profile_ids=valid_profile_ids,
            simulation_mapping=simulation_mapping,
            profile_mapping=profile_mapping,
            department_mapping=department_mapping,
        )

    async def get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Get default cohort details based on profile."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohort_detail_default(request)
        
        key = keys.cohort_default(request.profileId)
        
        async def fetcher() -> CohortDetailResponse:
            return await self._execute_get_cohort_detail_default(request)
        
        result: CohortDetailResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohort_detail_default(
        self, request: CohortDetailDefaultRequest
    ) -> CohortDetailResponse:
        """Execute the actual default cohort detail query."""
        # Get default cohort for profile
        query, params = self.queries.get_default_cohort(request.profileId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError("No cohorts found for user's departments")

        # Reuse the detail logic with the found cohort_id
        detail_request = CohortDetailRequest(
            cohortId=str(cohort['id']), profileId=request.profileId
        )

        return await self.get_cohort_detail(detail_request)

    async def get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Get cohort detail with available profiles in one call."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohort_detail_with_profiles(request)
        
        key = keys.cohort_with_profiles(request.cohortId, request.departmentIds, request.currentProfileId)
        
        async def fetcher() -> CohortDetailWithProfilesResponse:
            return await self._execute_get_cohort_detail_with_profiles(request)
        
        result: CohortDetailWithProfilesResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohort_detail_with_profiles(
        self, request: CohortDetailWithProfilesRequest
    ) -> CohortDetailWithProfilesResponse:
        """Execute the actual cohort detail with profiles query."""
        # Get campus email domain
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # 1. Get cohort basic info
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # 2. Get profile IDs currently in this cohort
        query, params = self.queries.get_cohort_profiles(request.cohortId)
        profile_result = await self.conn.fetch(query, *params)
        current_profile_ids = [str(row['profile_id']) for row in profile_result]

        # 3. Get all staff for the departments using staff query
        query, params = self.staff_queries.list_staff(
            request.departmentIds, request.currentProfileId, campus_domain
        )
        result = await self.conn.fetch(query, *params)

        # 4. Filter to available profiles (instructional/ta, not in cohort, not default)
        available_profiles = []
        for row in result:
            profile_id = str(row['profile_id'])
            
            # Skip if already in cohort, is default, or not correct role
            if (
                profile_id not in current_profile_ids
                and not row['default_profile']
                and row['role'] in ["instructional", "ta"]
            ):
                cohort_ids = [str(cid) for cid in (row['cohort_ids'] or [])]
                available_profiles.append(
                    StaffItem(
                        profile_id=profile_id,
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

        # 5. Get department mapping
        department_mapping: DepartmentMapping = {}
        if request.departmentIds:
            query, params = self.staff_queries.get_department_mapping(request.departmentIds)
            dept_result = await self.conn.fetch(query, *params)
            for row in dept_result:
                department_mapping[str(row['id'])] = DepartmentMappingItem(
                    name=row['name'], description=row['description']
                )

        # 6. Get cohort mapping (just this cohort)
        cohort_mapping: CohortMapping = {
            str(cohort['id']): CohortMappingItem(
                name=cohort['title'],
                description=cohort['description'] or ""
            )
        }

        return CohortDetailWithProfilesResponse(
            cohort_id=str(cohort['id']),
            title=cohort['title'],
            description=cohort['description'],
            active=cohort['active'],
            current_profile_ids=current_profile_ids,
            available_profiles=available_profiles,
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

    async def create_cohort(self, request: CreateCohortRequest) -> CreateCohortResponse:
        """Create a new cohort with relationships."""

        async with transaction(self.conn):
            # Create cohort
            query, _ = self.queries.create_cohort()
            result = await self.conn.fetchrow(
                query,
                request.title,
                request.description,
                request.department_id,
                request.active,
                request.default_cohort,
            )

            if not result:
                raise ValueError("Failed to create cohort")

            cohort_id = str(result['id'])

            # Insert profile relationships
            query, _ = self.queries.insert_cohort_profile()
            for profile_id in request.profile_ids:
                await self.conn.execute(query, cohort_id, profile_id)

            # Insert simulation relationships
            query, _ = self.queries.insert_cohort_simulation()
            for simulation_id in request.simulation_ids:
                await self.conn.execute(query, cohort_id, simulation_id)

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_all(),
                keys.tag_profile_all(),  # Affects profile cohort lists
                keys.tag_analytics_all(),  # May affect analytics
            ])

        return CreateCohortResponse(
            success=True,
            cohortId=cohort_id,
            message=f"Cohort '{request.title}' created successfully",
        )

    async def update_cohort(self, request: UpdateCohortRequest) -> UpdateCohortResponse:
        """Update an existing cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        async with transaction(self.conn):
            # Update cohort
            query, _ = self.queries.update_cohort()
            await self.conn.execute(
                query,
                request.cohortId,
                request.title,
                request.description,
                request.department_id,
                request.active,
                request.default_cohort,
            )

            # Delete existing relationships
            query, params = self.queries.delete_cohort_profiles(request.cohortId)
            await self.conn.execute(query, *params)

            query, params = self.queries.delete_cohort_simulations(request.cohortId)
            await self.conn.execute(query, *params)

            # Insert new relationships
            query, _ = self.queries.insert_cohort_profile()
            for profile_id in request.profile_ids:
                await self.conn.execute(query, request.cohortId, profile_id)

            query, _ = self.queries.insert_cohort_simulation()
            for simulation_id in request.simulation_ids:
                await self.conn.execute(query, request.cohortId, simulation_id)

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        return UpdateCohortResponse(
            success=True, message=f"Cohort '{request.title}' updated successfully"
        )

    async def duplicate_cohort(
        self, request: DuplicateCohortRequest
    ) -> DuplicateCohortResponse:
        """Duplicate a cohort with relationships."""

        # Get original cohort data
        query, params = self.queries.get_cohort_for_duplicate(request.cohortId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        async with transaction(self.conn):
            # Insert duplicate
            query, _ = self.queries.insert_duplicate_cohort()
            new_cohort = await self.conn.fetchrow(
                query,
                result['title'],
                result['description'],
                result['department_id'],
            )

            if not new_cohort:
                raise ValueError("Failed to create duplicate cohort")

            # Copy relationships
            copy_profiles_query, _ = self.queries.copy_cohort_profiles()
            await self.conn.execute(copy_profiles_query, new_cohort['id'], request.cohortId)

            copy_simulations_query, _ = self.queries.copy_cohort_simulations()
            await self.conn.execute(copy_simulations_query, new_cohort['id'], request.cohortId)

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        return DuplicateCohortResponse(
            success=True,
            cohortId=str(new_cohort['id']),
            message=f"Cohort '{result['title']}' duplicated successfully",
        )

    async def delete_cohort(self, request: DeleteCohortRequest) -> DeleteCohortResponse:
        """Delete a cohort if not in use."""

        # Check if cohort is in use
        query, params = self.queries.check_cohort_usage(request.cohortId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check cohort usage")

        if usage['usage_count'] > 0:
            raise ValueError(
                "Cannot delete cohort that has profiles with attempts"
            )

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Delete cohort
        query, params = self.queries.delete_cohort(request.cohortId)
        await self.conn.execute(query, params)
        # Transaction handled

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        return DeleteCohortResponse(
            success=True, message=f"Cohort '{cohort['title']}' deleted successfully"
        )

    async def leave_cohort(self, request: LeaveCohortRequest) -> LeaveCohortResponse:
        """Remove profile from cohort."""

        # Get cohort title
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profile from cohort
        query, params = self.queries.leave_cohort(request.cohortId, request.profileId)
        await self.conn.execute(query, params)
        # Transaction handled

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        return LeaveCohortResponse(
            success=True, message=f"Left cohort '{cohort['title']}' successfully"
        )

    async def add_profiles_to_cohort(
        self, request: AddProfilesToCohortRequest
    ) -> AddProfilesToCohortResponse:
        """Add profiles to cohort (handles both existing and new profiles)."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

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
                existing = await self.conn.fetchrow(query, *params)

                if existing:
                    raise ValueError(f"Alias '{profile_req.alias}' already exists")

                # Generate new profile ID
                profile_id = str(uuid.uuid4())
                profile_ids_to_add.append(profile_id)

                # Insert profile
                query, _ = self.staff_queries.create_profile()
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
                    None,
                )

                # Insert profile-department relationships for all departments
                query, _ = self.staff_queries.insert_profile_department()
                for dept_id in request.departmentIds:
                    await self.conn.execute(query, profile_id, dept_id)

        # Add all profiles to cohort
        query, _ = self.queries.insert_cohort_profile()
        for profile_id in profile_ids_to_add:
            await self.conn.execute(query, request.cohortId, profile_id)

        # Transaction handled

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        total_count = len(profile_ids_to_add)
        new_count = len(request.newProfiles) if request.newProfiles else 0
        existing_count = len(request.existingProfileIds) if request.existingProfileIds else 0

        message = f"Added {total_count} profile(s) to cohort '{cohort['title']}'"
        if new_count > 0:
            message += f" ({new_count} newly created)"

        return AddProfilesToCohortResponse(success=True, message=message)

    async def remove_profiles_from_cohort(
        self, request: RemoveProfilesFromCohortRequest
    ) -> RemoveProfilesFromCohortResponse:
        """Remove profiles from cohort."""

        # Check if cohort exists
        query, params = self.queries.get_cohort_title(request.cohortId)
        cohort = await self.conn.fetchrow(query, *params)

        if not cohort:
            raise ValueError(f"Cohort not found: {request.cohortId}")

        # Remove profiles from cohort by setting active = false
        query, params = self.queries.remove_cohort_profiles()
        await self.conn.execute(query, request.cohortId, request.profileIds)

        # Transaction handled

        # Invalidate caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_cohort_by_id(request.cohortId),
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),
            ])

        return RemoveProfilesFromCohortResponse(
            success=True,
            message=f"Removed {len(request.profileIds)} profile(s) from cohort '{cohort['title']}' successfully",
        )

    async def search_cohorts(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Fuzzy search cohorts by title and description.
        Returns scored and sorted results with profile counts.
        
        Args:
            query: Search query string
            limit: Maximum number of results to return
            
        Returns:
            List of cohort dictionaries with scores
        """
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_search_cohorts(query, limit)
        
        key = keys.cohort_search(query, limit)
        
        async def fetcher() -> List[Dict[str, Any]]:
            return await self._execute_search_cohorts(query, limit)
        
        result: List[Dict[str, Any]] = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_search_cohorts(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Execute the actual cohort search query."""
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(
            ["c.title", "c.description"], query
        )

        # Build and execute query
        query_template, _ = self.queries.search_cohorts_fuzzy(where_clause, limit * 5)
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        cohorts = await self.conn.fetch(sql, *params)

        if not cohorts:
            return []

        # Get profile counts from junction table
        cohort_ids = [str(c["id"]) for c in cohorts]
        count_query, count_params = self.queries.get_cohort_profile_counts(cohort_ids)
        count_results = await self.conn.fetch(count_query, *count_params)
        cohort_profile_counts = {
            str(row["cohort_id"]): row["profile_count"]
            for row in count_results
        }

        # Score and build results
        results = []
        for c in cohorts:
            score = self._score_cohort(q_norm, toks, c["title"], c["description"])
            results.append({
                "id": str(c["id"]),
                "title": c["title"],
                "active": c["active"],
                "description": c["description"],
                "profile_count": cohort_profile_counts.get(str(c["id"]), 0),
                "score": score,
            })

        results.sort(key=lambda r: (-r["score"], r["title"] or ""))
        return results[:limit]

    def _score_cohort(
        self, q_norm: str, toks: List[str], title: str | None, desc: str | None
    ) -> int:
        """
        Rank cohort relevance. Title is much stronger than description.
        
        Args:
            q_norm: Normalized query string
            toks: Query tokens
            title: Cohort title
            desc: Cohort description
            
        Returns:
            Relevance score (higher is better)
        """
        t_norm = normalize_text(title or "")
        d_norm = normalize_text(desc or "")

        score = 0

        # Exact whole-title match
        if t_norm == q_norm:
            score += 100

        # Exact description match (rare, low weight)
        if d_norm and d_norm == q_norm:
            score += 40

        # Prefix on full query
        if t_norm.startswith(q_norm):
            score += 60
        if d_norm.startswith(q_norm):
            score += 20

        # Token boosts
        for tok in toks:
            if t_norm.startswith(tok):
                score += 25
            if tok in t_norm:
                score += 10

            if d_norm.startswith(tok):
                score += 8
            if tok in d_norm:
                score += 4

        # Whole query appears somewhere
        if q_norm in t_norm or q_norm in d_norm:
            score += 5

        # Length proximity bonus (favor tight title matches)
        gap = abs(len(t_norm) - len(q_norm))
        score += max(0, 10 - gap)

        return score

    # ===== Overview Methods for MCP Tools =====

    async def get_cohort_overview(self, cohort_id: str) -> Dict[str, Any]:
        """Get cohort overview with all related data in ONE optimized query.
        
        Returns cohort details, roster (profiles), and active simulations.
        
        Args:
            cohort_id: UUID string of the cohort
            
        Returns:
            Dict with cohort overview data or {"error": "..."}
        """
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohort_overview(cohort_id)
        
        key = keys.cohort_overview(cohort_id)
        
        async def fetcher() -> Dict[str, Any]:
            return await self._execute_get_cohort_overview(cohort_id)
        
        result: Dict[str, Any] = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohort_overview(self, cohort_id: str) -> Dict[str, Any]:
        """Execute the actual cohort overview query."""
        import uuid
        
        try:
            cohort_uuid = uuid.UUID(cohort_id)
        except ValueError:
            return {"error": f"Invalid cohort_id format: {cohort_id}"}

        try:
            query, params = self.queries.get_cohort_overview_complete(cohort_uuid)
            result = await self.conn.fetchrow(query, *params)
            
            if not result:
                return {"error": f"Cohort not found: {cohort_id}"}

            cohort_data = {
                "id": str(result["id"]),
                "title": result["title"],
                "description": result["description"],
                "active": result["active"],
                "created_at": result["created_at"].isoformat() if result["created_at"] else None,
            }

            # Transform roster (jsonb array to list of dicts)
            roster = []
            for profile in result["roster"]:
                roster.append({
                    "id": str(profile["id"]),
                    "first_name": profile["first_name"],
                    "last_name": profile["last_name"],
                    "alias": profile["alias"],
                    "role": profile["role"],
                })

            # Transform simulations (jsonb array to list of dicts)
            simulations_data = []
            for sim in result["simulations"]:
                simulations_data.append({
                    "id": str(sim["id"]),
                    "title": sim["title"],
                    "active": sim["active"],
                    "time_limit": sim["time_limit"],
                })

            return {
                "cohort": cohort_data,
                "roster": roster,
                "simulations": simulations_data,
                "stats": {
                    "total_students": len(roster),
                    "active_simulations": len(simulations_data),
                },
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    async def get_cohort_pass_matrix(self, cohort_id: str) -> Dict[str, Any]:
        """Get cohort pass/fail matrix across simulations.
        
        Show pass/fail rates for all students in a cohort.
        
        Args:
            cohort_id: UUID string of the cohort
            
        Returns:
            Dict with structure: {"cohort": {...}, "matrix": [...], "summary": {...}, "simulations": [...]}
            or {"error": "..."}
        """
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            return await self._execute_get_cohort_pass_matrix(cohort_id)
        
        key = keys.cohort_pass_matrix(cohort_id)
        
        async def fetcher() -> Dict[str, Any]:
            return await self._execute_get_cohort_pass_matrix(cohort_id)
        
        result: Dict[str, Any] = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def _execute_get_cohort_pass_matrix(self, cohort_id: str) -> Dict[str, Any]:
        """Execute the actual cohort pass matrix query."""
        try:
            cohort_uuid = uuid.UUID(cohort_id)
        except ValueError:
            return {"error": f"Invalid cohort_id format: {cohort_id}"}

        try:
            # Get cohort with members and simulations
            query, params = self.queries.get_cohort_with_members(str(cohort_uuid))
            cohort_data = await self.conn.fetchrow(query, *params)
            
            if not cohort_data:
                return {"error": f"Cohort not found: {cohort_id}"}

            # Parse JSON fields
            members = cohort_data["members"] if cohort_data["members"] else []
            simulations = cohort_data["simulations"] if cohort_data["simulations"] else []

            # Build pass/fail matrix
            matrix = []
            for student in members:
                student_name = f"{student['first_name'] or ''} {student['last_name'] or ''}".strip()
                if not student_name:
                    student_name = student["alias"] or "Unknown"

                student_results: Dict[str, Any] = {
                    "student_id": str(student["id"]),
                    "student_name": student_name,
                    "alias": student["alias"],
                    "simulations": {},
                }

                # Get results for each simulation
                for sim in simulations:
                    # Get best grade for this student and simulation
                    query, params = self.queries.get_student_simulation_best_result(
                        str(student["id"]),
                        str(sim["id"])
                    )
                    best_result_row = await self.conn.fetchrow(query, *params)

                    if best_result_row and best_result_row["best_score"] is not None:
                        best_result = {
                            "score": best_result_row["best_score"],
                            "passed": best_result_row["passed"],
                            "time_taken": best_result_row["time_taken"],
                            "attempt_count": best_result_row["attempt_count"],
                            "last_attempt": best_result_row["last_attempt"].isoformat()
                            if best_result_row["last_attempt"]
                            else None,
                        }
                    else:
                        best_result = None

                    student_results["simulations"][str(sim["id"])] = best_result

                matrix.append(student_results)

            # Calculate summary statistics
            summary: Dict[str, Any] = {
                "total_students": len(members),
                "total_simulations": len(simulations),
                "simulation_stats": {},
            }

            for sim in simulations:
                sim_id = str(sim["id"])
                passed_count = 0
                attempted_count = 0
                total_score = 0

                for student_result in matrix:
                    if (
                        sim_id in student_result["simulations"]
                        and student_result["simulations"][sim_id]
                    ):
                        attempted_count += 1
                        result = student_result["simulations"][sim_id]
                        if result["passed"]:
                            passed_count += 1
                        total_score += result["score"]

                summary["simulation_stats"][sim_id] = {
                    "simulation_title": sim["title"],
                    "attempted_count": attempted_count,
                    "passed_count": passed_count,
                    "pass_rate": round(passed_count / attempted_count * 100, 1)
                    if attempted_count > 0
                    else 0,
                    "average_score": round(total_score / attempted_count, 1)
                    if attempted_count > 0
                    else 0,
                }

            return {
                "cohort": {
                    "id": str(cohort_data["id"]),
                    "title": cohort_data["title"],
                    "description": cohort_data["description"],
                    "active": cohort_data["active"],
                    "created_at": cohort_data["created_at"].isoformat()
                    if cohort_data["created_at"]
                    else None,
                },
                "matrix": matrix,
                "summary": summary,
                "simulations": [
                    {
                        "id": str(sim["id"]),
                        "title": sim["title"],
                        "active": sim["active"],
                        "time_limit": sim["time_limit"],
                    }
                    for sim in simulations
                ],
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_cohort_service(conn: asyncpg.Connection) -> CohortService:
    """Get cohort service instance."""
    return CohortService(conn)
